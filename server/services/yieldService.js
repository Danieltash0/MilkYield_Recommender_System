// Connects the recommender to the database: loads what it needs for a cow,
// judges saved milking records and forecasts the next session.
const Cattle = require('../models/Cattle');
const MilkingRecord = require('../models/MilkingRecord');
const HealthRecord = require('../models/HealthRecord');
const FeedRecord = require('../models/FeedRecord');
const BreedBaseline = require('../models/BreedBaseline');
const YieldFactor = require('../models/YieldFactor');
const YieldPrediction = require('../models/YieldPrediction');
const { recommend } = require('./recommender');
const knowledgeGraph = require('./knowledgeGraph');
const { buildFacts, templateText, explain, llmConfigured } = require('./explain');
const { sortRecords, priorRecords, pickBaseline, baselinePerSession, buildContext } = require('./features');

const HISTORY_LIMIT = 100;

// Today's date in the server's local timezone, as YYYY-MM-DD
const localToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// The knowledge graph only refines cold starts, so a missing yield_factors
// table (migration not run yet) means no factors rather than an error
let warnedFactors = false;
const loadFactors = () =>
  YieldFactor.getActive().catch((err) => {
    if (!warnedFactors) {
      warnedFactors = true;
      console.warn(`Recommender: yield factors unavailable (${err.message}); cold starts use the plain breed baseline.`);
    }
    return [];
  });

const cowLabel = (cow) => cow.name || `Tag ${cow.tag_number}`;

// Everything the recommender needs about one cow as of `asOf`
const gather = async (cattleId, asOf) => {
  const cow = await Cattle.getCattleById(cattleId);
  if (!cow) return null;
  const [records, feedByDate, healthEvents, baselines, factors] = await Promise.all([
    MilkingRecord.getRecords({ cattleId, to: asOf, limit: HISTORY_LIMIT }),
    FeedRecord.getConcentrateMap(cattleId, { to: asOf }),
    HealthRecord.getRecords({ cattleId }),
    BreedBaseline.getAll(),
    loadFactors()
  ]);
  const baselineRow = pickBaseline(cow.breed, baselines);
  const context = buildContext({ cow, asOf, feedByDate, healthEvents });
  return {
    cow,
    history: sortRecords(records),
    context,
    baselineRow,
    baseline: baselinePerSession(baselineRow),
    knowledge: knowledgeGraph.estimate({ cowLabel: cowLabel(cow), breed: cow.breed, baselineRow, context, factors })
  };
};

// Judges one saved milking record against the sessions before it and stores the
// result. Returns null for non-cows or when there is nothing to compare against.
const evaluateRecord = async (rec) => {
  const data = await gather(rec.cattle_id, rec.milking_date);
  if (!data || data.cow.category !== 'Cow') return null;

  let result;
  try {
    result = await recommend({
      history: priorRecords(data.history, rec),
      context: data.context,
      baseline: data.baseline,
      knowledge: data.knowledge,
      actual: Number(rec.quantity)
    });
  } catch (err) {
    return null; // no history and no breed baseline
  }

  const facts = buildFacts(result, cowLabel(data.cow));
  const message = templateText(facts);
  await YieldPrediction.save({
    cattle_id: rec.cattle_id,
    record_id: rec.record_id,
    milking_date: rec.milking_date,
    session: rec.session,
    expected_litres: result.expected,
    actual_litres: result.actual,
    ratio: result.ratio,
    method: result.method,
    status: result.status,
    reason: result.reason,
    message,
    model_source: result.modelSource
  });

  // Rewording by an LLM is slow and optional, so it happens after the response
  if (llmConfigured()) {
    explain(facts)
      .then((text) => (text !== message ? YieldPrediction.updateMessage(rec.record_id, text) : null))
      .catch((err) => console.warn(`Recommender: could not store LLM note (${err.message}).`));
  }

  return { ...result, message };
};

// Expected yield for the cow's next session, and the factors behind it
const forecastNext = async (cattleId) => {
  const today = localToday();
  const data = await gather(cattleId, today);
  if (!data) return null;
  const { cow, history, context, baselineRow, baseline, knowledge } = data;

  const factors = {
    as_of: today,
    days_in_milk: context.daysInMilk,
    parity: context.parity,
    age_months: context.ageMonths,
    days_pregnant: context.daysPregnant,
    concentrate_kg: context.concentrateKg,
    usual_concentrate_kg: context.feed ? context.feed.usual : null,
    prev_lactation_l: context.prevLactationL,
    health_active: context.healthActive,
    days_since_illness: context.daysSinceIllness,
    breed: cow.breed || null,
    baseline_breed: baselineRow ? baselineRow.breed : null,
    baseline_per_session: baseline === null ? null : Math.round(baseline * 100) / 100,
    flags: context.flags
  };
  const last = history[history.length - 1];
  const lastRecord = last ? { milking_date: last.milking_date, session: last.session, quantity: last.quantity } : null;
  // What the knowledge graph would expect from the cow's profile alone, shown
  // even when history gives a better answer
  const profileEstimate = knowledge && {
    expected: knowledge.perSession,
    breed: knowledge.breed,
    baseline_per_session: knowledge.baselinePerSession,
    multiplier: knowledge.multiplier,
    clamped: knowledge.clamped,
    applied: knowledge.applied,
    path: knowledge.path
  };

  try {
    const result = await recommend({ history, context, baseline, knowledge });
    return {
      expected: result.expected,
      range: result.range,
      advice: result.advice,
      method: result.method,
      history_used: result.historyUsed,
      model_source: result.modelSource,
      last_record: lastRecord,
      factors,
      knowledge_graph: profileEstimate
    };
  } catch (err) {
    return {
      expected: null, range: null, advice: [], method: null, history_used: 0, model_source: null, last_record: lastRecord, factors,
      knowledge_graph: profileEstimate, note: err.message
    };
  }
};

module.exports = { gather, evaluateRecord, forecastNext, localToday };

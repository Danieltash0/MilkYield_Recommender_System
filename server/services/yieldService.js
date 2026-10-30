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
const projection = require('./projection');
const {
  sortRecords, priorRecords, pickBaseline, baselinePerSession, buildContext, milkingsPerDay, daysBetween
} = require('./features');

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

// History older than this makes the starting level stale
const STALE_DAYS = 14;

// What the projection holds constant, in words for the farm user
const assumptionsFor = (context, lastDate, today) => {
  const usual = context.feed ? context.feed.usual : null;
  const list = [
    usual !== null ? `Concentrate stays at about ${usual} kg a day.` : 'Feeding stays as it has been.',
    `She is milked ${milkingsPerDay()} times a day, as now.`,
    context.healthActive
      ? 'She is unwell or under treatment now, and the projection does not assume she recovers, so it may be low.'
      : 'She stays healthy; an illness would lower yield.'
  ];
  const age = lastDate ? daysBetween(lastDate, today) : null;
  if (age !== null && age > STALE_DAYS) list.push(`Her last milking record is ${age} days old, so the starting level may be out of date.`);
  return list;
};

// Expected daily yield for the next `days` days (up to two months), along the
// lactation curve from the cow's current level
const projectAhead = async (cattleId, days = projection.MAX_DAYS) => {
  const today = localToday();
  const data = await gather(cattleId, today);
  if (!data) return null;
  const { history, context, baseline, knowledge } = data;
  const base = { as_of: today, days_in_milk: context.daysInMilk, days_pregnant: context.daysPregnant || 0 };
  if (context.daysInMilk === null) {
    return { ...base, available: false, note: 'Add her last calving date to project yield along the lactation curve.' };
  }

  let first;
  let second;
  try {
    // The predictor's next two sessions, so the level does not depend on which session comes next
    first = await recommend({ history, context, baseline, knowledge });
    second = await recommend({ history: [...history, { quantity: first.expected }], context, baseline, knowledge });
  } catch (err) {
    return { ...base, available: false, note: err.message };
  }
  const dailyLevel = ((first.expected + second.expected) / 2) * milkingsPerDay();
  const result = projection.project({
    asOf: today, dailyLevel, daysInMilk: context.daysInMilk, daysPregnant: context.daysPregnant || 0, days
  });
  if (!result) return { ...base, available: false, note: 'Not enough information to project her yield.' };

  const last = history[history.length - 1];
  return {
    ...base,
    available: true,
    method: first.method,
    history_used: first.historyUsed,
    ...result,
    assumptions: assumptionsFor(context, last && last.milking_date, today)
  };
};

// Cows projected at once when summing the herd
const HERD_BATCH = 5;
const HERD_EVENTS = ['Expected dry-off (about two months before calving)', 'Calving due'];

// The herd's expected daily yield for the next `days` days: every cow's
// projection added up. Optionally only one breed or one cow. Cows that cannot
// be projected (no calving date, no history or baseline) are listed, not guessed.
const projectHerd = async ({ days = projection.MAX_DAYS, breed = null, cattleId = null } = {}) => {
  const all = await Cattle.getAllCattle();
  const cows = all.filter((c) => c.category === 'Cow' &&
    (!breed || c.breed === breed) && (!cattleId || Number(c.cattle_id) === Number(cattleId)));

  const results = [];
  for (let i = 0; i < cows.length; i += HERD_BATCH) {
    const batch = cows.slice(i, i + HERD_BATCH);
    const done = await Promise.all(batch.map((c) => projectAhead(c.cattle_id, days)));
    batch.forEach((cow, j) => results.push({ cow, p: done[j] }));
  }

  const projected = results.filter((r) => r.p && r.p.available);
  const leftOut = results
    .filter((r) => !r.p || !r.p.available)
    .map((r) => ({ cattle_id: r.cow.cattle_id, name: cowLabel(r.cow), reason: r.p ? r.p.note : 'Not found' }));
  if (!projected.length) return { as_of: localToday(), cows: 0, left_out: leftOut, series: [], months: [], events: [] };

  const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
  // Adding the cows' ranges assumes their errors all go the same way, so the
  // herd range is on the wide side
  const series = projected[0].p.series.map((day, i) => {
    const rows = projected.map((r) => r.p.series[i]);
    return {
      date: day.date,
      day: day.day,
      expected: round(rows.reduce((s, d) => s + d.expected, 0)),
      low: round(rows.reduce((s, d) => s + d.low, 0)),
      high: round(rows.reduce((s, d) => s + d.high, 0)),
      cows_milking: rows.filter((d) => !d.dry).length
    };
  });
  const months = projected[0].p.months.map((m, i) => {
    const total = projected.reduce((s, r) => s + r.p.months[i].total, 0);
    return { from: m.from, to: m.to, avg_daily: round(total / 30), total: round(total, 1) };
  });
  const events = projected
    .flatMap((r) => r.p.events.filter((e) => HERD_EVENTS.includes(e.label))
      .map((e) => ({ ...e, cattle_id: r.cow.cattle_id, name: cowLabel(r.cow) })))
    .sort((a, b) => a.day - b.day);

  return {
    as_of: projected[0].p.as_of,
    cows: projected.length,
    left_out: leftOut,
    daily_level: round(projected.reduce((s, r) => s + r.p.daily_level, 0)),
    series,
    months,
    events
  };
};

module.exports = { gather, evaluateRecord, forecastNext, projectAhead, projectHerd, localToday };

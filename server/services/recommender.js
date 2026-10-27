// Expected yield for a milking session, and how an actual reading compares.
// Tiers, first one with what it needs wins:
//   1. ONNX model    PREDICTOR=lr|nn|auto, model files present, 7+ records, every input known
//   2. moving average of the last 7 sessions (needs 3+)
//   3. knowledge graph: breed baseline x the factors the cow meets (cold start)
//   4. breed baseline per session (cold start, no factor applies)
// Any model problem falls back to the moving average.
const { WINDOW, MIN_RECORDS, buildFeatureRow } = require('./features');
const defaultModel = require('./nnModel');

const LOW = 0.8;
const HIGH = 1.2;
// A model answer outside this band around the reference is treated as broken
const SANE_MIN = 0.25;
const SANE_MAX = 3;

const METHOD = { nn: 'neural_net', lr: 'linear_regression' };

const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;

const movingAverage = (history) => {
  if (history.length < MIN_RECORDS) return null;
  const window = history.slice(-WINDOW);
  return window.reduce((s, r) => s + Number(r.quantity), 0) / window.length;
};

// Which ONNX model PREDICTOR asks for, or null for none
const modelName = (predictor, model) => {
  if (predictor === 'lr' || predictor === 'nn') return predictor;
  if (predictor === 'auto') {
    const meta = model.getMeta();
    return meta && (meta.best === 'lr' || meta.best === 'nn') ? meta.best : null;
  }
  return null;
};

const tryModel = async ({ name, history, context, baseline, reference, model }) => {
  if (!name || history.length < WINDOW || !model.isAvailable(name)) return null;
  const meta = model.getMeta();
  const features = buildFeatureRow(meta.features, history, context, baseline, meta.defaults || {});
  if (!features) return null;
  try {
    const out = await model.predict(name, features);
    if (!Number.isFinite(out) || out <= 0) throw new Error(`implausible output ${out}`);
    if (reference && (out < reference * SANE_MIN || out > reference * SANE_MAX)) {
      throw new Error(`output ${out.toFixed(2)} L is far from the reference ${reference.toFixed(2)} L`);
    }
    return { expected: out, method: METHOD[name], modelSource: meta.data_source || null };
  } catch (err) {
    console.warn(`Recommender: ${name} model skipped (${err.message}); using the moving average.`);
    return null;
  }
};

// Why an out-of-band reading should not raise an alert, or null
const suppressionReason = (flags = {}) => {
  if (flags.sick) return 'illness or injury recorded recently';
  if (flags.inTreatment) return 'under treatment';
  if (flags.recentCalving) return 'recently calved';
  return null;
};

const judge = (expected, actual, flags) => {
  if (actual === null || actual === undefined) return { actual: null, ratio: null, status: null, reason: null };
  const ratio = Number(actual) / expected;
  let status = 'normal';
  if (ratio < LOW) status = 'low';
  else if (ratio > HIGH) status = 'high';
  const reason = status === 'normal' ? null : suppressionReason(flags);
  return { actual: Number(actual), ratio: round(ratio, 3), status: reason ? 'suppressed' : status, reason };
};

// history: sessions before the one being judged, oldest first
// baseline: breed baseline in litres per session (or null)
// knowledge: knowledgeGraph.estimate() for the cow (or null)
// actual: the reading to judge (omit for a plain forecast)
const recommend = async ({ history = [], context = {}, baseline = null, knowledge = null, actual = null }, options = {}) => {
  const model = options.model || defaultModel;
  const predictor = (options.predictor || process.env.PREDICTOR || 'ma').toLowerCase();
  const ma = movingAverage(history);

  let pick = await tryModel({
    name: modelName(predictor, model),
    history,
    context,
    baseline,
    reference: ma ?? baseline,
    model
  });
  if (pick) pick.historyUsed = Math.min(history.length, WINDOW);
  else if (ma !== null) pick = { expected: ma, method: 'moving_average', modelSource: null, historyUsed: Math.min(history.length, WINDOW) };
  else if (knowledge && knowledge.applied.length) {
    pick = { expected: knowledge.perSession, method: 'knowledge_graph', modelSource: null, historyUsed: 0, adjustments: knowledge.applied };
  } else if (baseline) pick = { expected: baseline, method: 'breed_baseline', modelSource: null, historyUsed: 0 };
  else throw new Error('No milking history or breed baseline to compare against');

  const expected = round(pick.expected, 2);
  return {
    expected,
    method: pick.method,
    historyUsed: pick.historyUsed,
    modelSource: pick.modelSource,
    adjustments: pick.adjustments || null,
    ...judge(expected, actual, context.flags)
  };
};

module.exports = { recommend, movingAverage, suppressionReason, LOW, HIGH };

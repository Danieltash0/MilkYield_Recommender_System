// Cold-start knowledge graph for the milk yield recommender. Pure functions, no
// database. The graph links a cow to its breed, the breed to its baseline
// yield, and what is known about the cow (lactation stage, parity, pregnancy,
// feed, health, age) to the yield factors whose conditions it meets:
//
//   Cow --is_a--> Breed --has_baseline--> L/day
//   Cow --meets (parity = 1)--> first lactation --multiplies_yield_by--> 0.8
//
// The estimate is the baseline times every factor reached, and the path that
// produced it is returned so the answer can be explained.
const { baselinePerSession } = require('./features');

// Factor attribute -> key in the context from features.buildContext
const ATTRIBUTES = {
  days_in_milk: 'daysInMilk',
  parity: 'parity',
  days_pregnant: 'daysPregnant',
  concentrate_kg: 'concentrateKg',
  health_active: 'healthActive',
  age_months: 'ageMonths'
};

// Bounds on the combined multiplier, so stacked factors stay plausible
const MIN_MULTIPLIER = 0.3;
const MAX_MULTIPLIER = 1.6;

const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;
const numberOrNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// min_value inclusive, max_value exclusive, null = unbounded
const meets = (factor, value) =>
  value !== null &&
  (factor.min_value === null || factor.min_value === undefined || value >= Number(factor.min_value)) &&
  (factor.max_value === null || factor.max_value === undefined || value < Number(factor.max_value));

// Factors the cow meets, at most one per attribute (the first by min_value),
// so overlapping rows never compound. Unknown values meet nothing.
const applicableFactors = (context = {}, factors = []) => {
  const sorted = [...factors].sort(
    (a, b) => String(a.attribute).localeCompare(String(b.attribute)) || (a.min_value ?? -Infinity) - (b.min_value ?? -Infinity)
  );
  const seen = new Set();
  const applied = [];
  for (const factor of sorted) {
    const key = ATTRIBUTES[factor.attribute];
    if (!key || seen.has(factor.attribute)) continue;
    const value = numberOrNull(context[key]);
    const multiplier = numberOrNull(factor.multiplier);
    if (multiplier === null || multiplier <= 0 || !meets(factor, value)) continue;
    seen.add(factor.attribute);
    applied.push({
      key: factor.factor_key,
      attribute: factor.attribute,
      value,
      multiplier,
      label: factor.label,
      source: factor.source || null
    });
  }
  return applied;
};

// Expected yield for a cow with no usable history.
// Returns null when there is no breed baseline to start from.
const estimate = ({ cowLabel = 'Cow', breed = null, baselineRow, context = {}, factors = [] }) => {
  const perSessionBase = baselinePerSession(baselineRow);
  if (perSessionBase === null) return null;

  const applied = applicableFactors(context, factors);
  const raw = applied.reduce((product, f) => product * f.multiplier, 1);
  const multiplier = Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, raw));

  const path = [
    { from: cowLabel, relation: 'is_a', to: breed || baselineRow.breed },
    ...(breed && breed !== baselineRow.breed ? [{ from: breed, relation: 'uses_baseline_of', to: baselineRow.breed }] : []),
    { from: baselineRow.breed, relation: 'has_baseline', to: `${Number(baselineRow.avg_daily_yield)} L/day` },
    ...applied.flatMap((f) => [
      { from: cowLabel, relation: 'meets', to: f.label, because: `${f.attribute} = ${f.value}` },
      { from: f.label, relation: 'multiplies_yield_by', to: String(f.multiplier) }
    ])
  ];

  return {
    breed: baselineRow.breed,
    dailyBaseline: Number(baselineRow.avg_daily_yield),
    baselinePerSession: round(perSessionBase, 2),
    multiplier: round(multiplier, 3),
    clamped: multiplier !== raw,
    perSession: round(perSessionBase * multiplier, 2),
    applied,
    path
  };
};

module.exports = { ATTRIBUTES, MIN_MULTIPLIER, MAX_MULTIPLIER, meets, applicableFactors, estimate };

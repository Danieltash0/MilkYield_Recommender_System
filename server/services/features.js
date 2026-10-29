// Feature building for the milk yield recommender. Pure functions, no database:
// the live API (yieldService) and the training export (scripts/exportTrainingData)
// both describe a milking record through this file, so a model is served exactly
// the inputs it was trained on. Every value is computed "as of" a date, and
// nothing recorded after that date is allowed to leak in.

const DAY_MS = 24 * 60 * 60 * 1000;

const SESSION_ORDER = { Morning: 0, Afternoon: 1, Evening: 2 };
const WINDOW = 7; // sessions in the moving average and the model's lag features
const MIN_RECORDS = 3; // fewest sessions the moving average will work from
const HEALTH_WINDOW_DAYS = 7;
const DAYS_SINCE_CAP = 30;
const RECENT_CALVING_DAYS = 7;
const FEED_USUAL_DAYS = 7; // days before asOf that make up a cow's usual ration

const SICK_TYPES = ['Illness', 'Injury'];
const TREATMENT_TYPES = ['Treatment'];

const milkingsPerDay = () => {
  const n = Number(process.env.MILKINGS_PER_DAY);
  return Number.isFinite(n) && n > 0 ? n : 2;
};

// 'YYYY-MM-DD' (or a longer timestamp string) -> whole days since the epoch, in UTC
const dayNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
};

// Days from `from` to `to` (negative when `to` is earlier); null if either is missing
const daysBetween = (from, to) => {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a;
};

// Whole calendar months from `from` to `to`; null if unknown or negative
const monthsBetween = (from, to) => {
  if (dayNumber(from) === null || dayNumber(to) === null) return null;
  const [y1, m1, d1] = String(from).slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = String(to).slice(0, 10).split('-').map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  return months < 0 ? null : months;
};

// Position of a record in time: day, then session within the day
const recordKey = (r) => dayNumber(r.milking_date) * 3 + (SESSION_ORDER[r.session] ?? 0);

// Oldest first
const sortRecords = (records) => [...records].sort((a, b) => recordKey(a) - recordKey(b));

// Records strictly before the target session, oldest first
const priorRecords = (records, target) => {
  const cutoff = recordKey(target);
  return sortRecords(records).filter((r) => recordKey(r) < cutoff);
};

const normaliseBreed = (breed) => String(breed || '').toLowerCase().replace(/[^a-z]/g, '');

// Best baseline row for a breed: exact match, then the longest partial match,
// then the 'Other' row, else null
const pickBaseline = (breed, rows = []) => {
  const key = normaliseBreed(breed);
  const keyed = rows.map((row) => ({ row, k: normaliseBreed(row.breed) }));
  if (key) {
    const exact = keyed.find((r) => r.k === key);
    if (exact) return exact.row;
    if (key.length >= 4) {
      const partial = keyed
        .filter((r) => r.k !== 'other' && r.k.length >= 4 && (r.k.includes(key) || key.includes(r.k)))
        .sort((a, b) => b.k.length - a.k.length)[0];
      if (partial) return partial.row;
    }
  }
  const other = keyed.find((r) => r.k === 'other');
  return other ? other.row : null;
};

// Baselines are litres per day; the recommender works per session
const baselinePerSession = (row) => {
  if (!row) return null;
  const daily = Number(row.avg_daily_yield);
  return Number.isFinite(daily) && daily > 0 ? daily / milkingsPerDay() : null;
};

// Health picture on `asOf`, from events on or before that day only
const healthSignals = (events = [], asOf) => {
  const today = dayNumber(asOf);
  const past = events
    .map((e) => ({ type: e.record_type, day: dayNumber(e.record_date) }))
    .filter((e) => e.day !== null && e.day <= today);
  const recent = (types) => past.some((e) => types.includes(e.type) && today - e.day <= HEALTH_WINDOW_DAYS);

  const sick = recent(SICK_TYPES);
  const inTreatment = recent(TREATMENT_TYPES);
  const lastEvent = past
    .filter((e) => SICK_TYPES.includes(e.type) || TREATMENT_TYPES.includes(e.type))
    .reduce((latest, e) => Math.max(latest, e.day), -Infinity);

  return {
    sick,
    inTreatment,
    healthActive: sick || inTreatment ? 1 : 0,
    daysSinceIllness: lastEvent === -Infinity ? DAYS_SINCE_CAP : Math.min(today - lastEvent, DAYS_SINCE_CAP)
  };
};

const numberOrNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

const feedOn = (feedByDate, date) => {
  if (!feedByDate) return null;
  const key = String(date).slice(0, 10);
  return numberOrNull(feedByDate instanceof Map ? feedByDate.get(key) : feedByDate[key]);
};

// Concentrate fed on `asOf` against the cow's usual ration: the average of
// the feed logged in the FEED_USUAL_DAYS days before it. Nulls when unknown.
const feedSignals = (feedByDate, asOf) => {
  const today = feedOn(feedByDate, asOf);
  const day = dayNumber(asOf);
  const entries = feedByDate instanceof Map ? [...feedByDate.entries()] : Object.entries(feedByDate || {});
  const before = entries
    .map(([date, kg]) => ({ ago: day - dayNumber(date), kg: numberOrNull(kg) }))
    .filter((e) => e.kg !== null && e.ago >= 1 && e.ago <= FEED_USUAL_DAYS);
  const usual = before.length ? Math.round((before.reduce((s, e) => s + e.kg, 0) / before.length) * 100) / 100 : null;
  return { today, usual, daysLogged: before.length };
};

// Everything known about a cow on `asOf`. Unknown values are null.
// Lactation details describe the cow's current lactation, so for a date before
// its last calving they are unknown rather than borrowed from the future.
const buildContext = ({ cow, asOf, feedByDate, healthEvents }) => {
  const sinceCalving = daysBetween(cow.last_calving_date, asOf);
  const inThisLactation = sinceCalving !== null && sinceCalving >= 0;
  const sinceConception = daysBetween(cow.conception_date, asOf);
  const health = healthSignals(healthEvents, asOf);
  const daysInMilk = inThisLactation ? sinceCalving : null;

  return {
    ageMonths: monthsBetween(cow.date_of_birth, asOf),
    daysInMilk,
    parity: inThisLactation ? numberOrNull(cow.parity) : null,
    daysPregnant: sinceConception !== null && sinceConception >= 0 ? sinceConception : 0,
    concentrateKg: feedOn(feedByDate, asOf),
    prevLactationL: inThisLactation ? numberOrNull(cow.prev_lactation_yield_l) : null,
    healthActive: health.healthActive,
    daysSinceIllness: health.daysSinceIllness,
    feed: feedSignals(feedByDate, asOf),
    flags: {
      sick: health.sick,
      inTreatment: health.inTreatment,
      recentCalving: daysInMilk !== null && daysInMilk < RECENT_CALVING_DAYS
    }
  };
};

const camelCase = (name) => name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Model input vector, in the order of model_meta.json "features".
// `records` are the sessions before the one being predicted, oldest first.
// Returns null when there are too few records or a value is unknown with no default.
const buildFeatureRow = (featureNames, records, ctx, basePerSession, defaults = {}) => {
  if (!records || records.length < WINDOW) return null;
  const window = records.slice(-WINDOW).map((r) => Number(r.quantity));
  const mean7 = window.reduce((s, q) => s + q, 0) / WINDOW;

  const row = [];
  for (const name of featureNames) {
    let value;
    const lag = /^lag(\d+)$/.exec(name);
    if (lag) value = window[WINDOW - Number(lag[1])];
    else if (name === 'mean7') value = mean7;
    else if (name === 'breed_baseline') value = basePerSession;
    else value = ctx ? ctx[camelCase(name)] : undefined;

    value = numberOrNull(value);
    if (value === null) value = numberOrNull(defaults[name]);
    if (value === null) return null;
    row.push(value);
  }
  return row;
};

module.exports = {
  SESSION_ORDER,
  WINDOW,
  MIN_RECORDS,
  HEALTH_WINDOW_DAYS,
  DAYS_SINCE_CAP,
  RECENT_CALVING_DAYS,
  FEED_USUAL_DAYS,
  milkingsPerDay,
  dayNumber,
  daysBetween,
  monthsBetween,
  sortRecords,
  priorRecords,
  normaliseBreed,
  pickBaseline,
  baselinePerSession,
  healthSignals,
  feedSignals,
  buildContext,
  buildFeatureRow
};

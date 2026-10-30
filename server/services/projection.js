// Two-month yield projection for one cow. Pure functions, no database.
// Starts from the cow's current daily level and moves it along the Wood (1967)
// lactation curve and the late-pregnancy decline. Everything else (feed,
// health, parity, milkings per day) is held at its recent values. Backtested
// in recommender/notebooks/dairydan_yield_models.py; see
// recommender/TRAINING_RESULTS.md section 5.
const { dayNumber } = require('./features');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 60;

// Wood curve y = a * t^b * e^(-c*t); peaks at t = b / c = 50 days in milk
const WOOD_B = 0.2;
const WOOD_C = 0.004;
// Yield falls about 0.2% a day after day 120 of pregnancy
const PREGNANCY_DECLINE_FROM = 120;
const PREGNANCY_DECLINE_PER_DAY = 0.002;
// Cows are dried off about two months before calving
const DRY_OFF_PREGNANT_DAYS = 220;
const GESTATION_DAYS = 283;

// The range widens from +/-20% tomorrow to +/-30% at day 60, the band that held
// about 90% of daily totals in the backtest with a mismatched curve
const RANGE_START = 0.2;
const RANGE_END = 0.3;

const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

const wood = (daysInMilk) => {
  const t = Math.max(daysInMilk, 1);
  return t ** WOOD_B * Math.exp(-WOOD_C * t);
};

const pregnancyFactor = (daysPregnant) => 1 - PREGNANCY_DECLINE_PER_DAY * Math.max(0, daysPregnant - PREGNANCY_DECLINE_FROM);

const spread = (day) => RANGE_START + ((RANGE_END - RANGE_START) * (Math.min(day, MAX_DAYS) - 1)) / (MAX_DAYS - 1);

const addDays = (date, n) => new Date((dayNumber(date) + n) * DAY_MS).toISOString().slice(0, 10);

// Milestones crossed between day 1 and the last day: [{ attribute, at, label }]
const MILESTONES = [
  { attribute: 'dim', at: Math.round(WOOD_B / WOOD_C), label: 'Peak of the lactation curve' },
  { attribute: 'dim', at: 200, label: 'Late lactation: yield falls faster' },
  { attribute: 'dim', at: 305, label: 'End of a standard 305-day lactation' },
  { attribute: 'dp', at: PREGNANCY_DECLINE_FROM, label: 'Pregnancy starts to lower yield' },
  { attribute: 'dp', at: DRY_OFF_PREGNANT_DAYS, label: 'Expected dry-off (about two months before calving)' },
  { attribute: 'dp', at: GESTATION_DAYS, label: 'Calving due' }
];

// dailyLevel: litres per day now. daysInMilk is required; daysPregnant is 0 when
// not pregnant. Returns null when there is nothing to project from.
const project = ({ asOf, dailyLevel, daysInMilk, daysPregnant = 0, days = MAX_DAYS }) => {
  if (!(dailyLevel > 0) || daysInMilk === null || daysInMilk === undefined || daysInMilk < 0) return null;
  const horizon = Math.min(Math.max(Math.round(days) || MAX_DAYS, 1), MAX_DAYS);
  const pregnant = daysPregnant > 0;
  const now = wood(daysInMilk) * pregnancyFactor(daysPregnant);

  const series = [];
  for (let d = 1; d <= horizon; d++) {
    const dim = daysInMilk + d;
    const dp = pregnant ? daysPregnant + d : 0;
    const dry = pregnant && dp >= DRY_OFF_PREGNANT_DAYS;
    const expected = dry ? 0 : dailyLevel * ((wood(dim) * pregnancyFactor(dp)) / now);
    const s = spread(d);
    series.push({
      date: addDays(asOf, d),
      day: d,
      days_in_milk: dim,
      days_pregnant: pregnant ? dp : null,
      expected: round(expected),
      low: round(expected * (1 - s)),
      high: round(expected * (1 + s)),
      dry
    });
  }

  const events = MILESTONES.flatMap((m) => {
    const start = m.attribute === 'dim' ? daysInMilk : pregnant ? daysPregnant : null;
    if (start === null || start >= m.at || start + horizon < m.at) return [];
    const day = m.at - start;
    return [{ date: addDays(asOf, day), day, label: m.label }];
  }).sort((a, b) => a.day - b.day);

  const months = [];
  for (let m = 0; (m + 1) * 30 <= horizon; m++) {
    const slice = series.slice(m * 30, (m + 1) * 30);
    const total = slice.reduce((s, p) => s + p.expected, 0);
    months.push({ from: slice[0].date, to: slice[slice.length - 1].date, avg_daily: round(total / slice.length), total: round(total, 1) });
  }

  const last = series[series.length - 1];
  return {
    daily_level: round(dailyLevel),
    series,
    events,
    months,
    change_pct: Math.round((last.expected / dailyLevel - 1) * 100)
  };
};

module.exports = {
  MAX_DAYS,
  DRY_OFF_PREGNANT_DAYS,
  GESTATION_DAYS,
  RANGE_START,
  RANGE_END,
  wood,
  pregnancyFactor,
  spread,
  project
};

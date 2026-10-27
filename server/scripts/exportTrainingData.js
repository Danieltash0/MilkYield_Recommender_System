// Exports milking history as training data for recommender/notebooks.
// Run with:  npm run export:training   (from server/)
// Writes recommender/data/milk_records.csv. Every row is described with
// features.js exactly as the live API would describe it on that record's own
// date, so the trained model sees the same inputs it is later served.
const fs = require('fs');
const path = require('path');
const {
  SESSION_ORDER,
  sortRecords,
  pickBaseline,
  baselinePerSession,
  buildContext
} = require('../services/features');

const OUT_FILE = path.join(__dirname, '..', '..', 'recommender', 'data', 'milk_records.csv');

const COLUMNS = [
  'cow_id', 'date', 'session_idx', 'litres', 'parity', 'days_in_milk', 'breed_baseline', 'age_months',
  'days_pregnant', 'concentrate_kg', 'prev_lactation_l', 'health_active', 'days_since_illness'
];
const SMALL_DATASET_ROWS = 500;
const SMALL_DATASET_COWS = 10;

const groupBy = (rows, key) =>
  rows.reduce((acc, r) => {
    (acc[r[key]] = acc[r[key]] || []).push(r);
    return acc;
  }, {});

const round = (n, dp) => (n === null || n === undefined ? null : Math.round(n * 10 ** dp) / 10 ** dp);

// cows: cattle rows; records: milking rows; feed: { cattle_id, fed_on, concentrate_kg };
// health: { cattle_id, record_date, record_type }; baselines: breed_yield_baselines rows.
// Returns one object per milking record of a cow, keyed by COLUMNS (null = unknown).
const buildExportRows = ({ cows, records, feed = [], health = [], baselines = [] }) => {
  const recordsByCow = groupBy(records, 'cattle_id');
  const feedByCow = groupBy(feed, 'cattle_id');
  const healthByCow = groupBy(health, 'cattle_id');
  const rows = [];

  cows
    .filter((cow) => cow.category === 'Cow')
    .forEach((cow) => {
      const feedByDate = new Map(
        (feedByCow[cow.cattle_id] || []).map((f) => [String(f.fed_on).slice(0, 10), Number(f.concentrate_kg)])
      );
      const healthEvents = healthByCow[cow.cattle_id] || [];
      const baseline = baselinePerSession(pickBaseline(cow.breed, baselines));

      sortRecords(recordsByCow[cow.cattle_id] || []).forEach((r) => {
        const date = String(r.milking_date).slice(0, 10);
        const ctx = buildContext({ cow, asOf: date, feedByDate, healthEvents });
        rows.push({
          cow_id: cow.cattle_id,
          date,
          session_idx: SESSION_ORDER[r.session],
          litres: Number(r.quantity),
          parity: ctx.parity,
          days_in_milk: ctx.daysInMilk,
          breed_baseline: round(baseline, 4),
          age_months: ctx.ageMonths,
          days_pregnant: ctx.daysPregnant,
          concentrate_kg: ctx.concentrateKg,
          prev_lactation_l: ctx.prevLactationL,
          health_active: ctx.healthActive,
          days_since_illness: ctx.daysSinceIllness
        });
      });
    });
  return rows;
};

const toCsv = (rows) =>
  [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => (r[c] === null || r[c] === undefined ? '' : r[c])).join(','))]
    .join('\n') + '\n';

// Row and cow counts plus unknown values per column, for the console
const summarise = (rows) => {
  const missing = Object.fromEntries(COLUMNS.map((c) => [c, rows.filter((r) => r[c] === null || r[c] === undefined).length]));
  return { rows: rows.length, cows: new Set(rows.map((r) => r.cow_id)).size, missing };
};

const main = async () => {
  const db = require('../utils/database');
  try {
    const [cows] = await db.query('SELECT * FROM cattle');
    const [records] = await db.query('SELECT cattle_id, milking_date, session, quantity FROM milking_records');
    const [feed] = await db.query('SELECT cattle_id, fed_on, concentrate_kg FROM feed_records');
    const [health] = await db.query('SELECT cattle_id, record_date, record_type FROM health_records');
    const [baselines] = await db.query('SELECT breed, avg_daily_yield FROM breed_yield_baselines');

    const rows = buildExportRows({ cows, records, feed, health, baselines });
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, toCsv(rows));

    const s = summarise(rows);
    console.log(`Wrote ${s.rows} rows for ${s.cows} cows to ${OUT_FILE}`);
    console.log('Unknown values per column (blank in the CSV):');
    Object.entries(s.missing).forEach(([c, n]) => n && console.log(`  ${c}: ${n}`));
    if (s.rows < SMALL_DATASET_ROWS || s.cows < SMALL_DATASET_COWS) {
      console.warn(
        `WARNING: only ${s.rows} rows from ${s.cows} cows. A model trained on this little data will not ` +
          `generalise; keep PREDICTOR=ma until there are at least ${SMALL_DATASET_ROWS} rows from ${SMALL_DATASET_COWS}+ cows.`
      );
    }
  } finally {
    await db.end();
  }
};

if (require.main === module) {
  main().catch((err) => {
    console.error('Export failed:', err.message);
    process.exit(1);
  });
}

module.exports = { COLUMNS, buildExportRows, toCsv, summarise };

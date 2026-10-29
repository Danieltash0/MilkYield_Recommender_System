const db = require('../utils/database');
const { rangeFor } = require('../services/recommender');

const SELECT = `
  SELECT p.prediction_id, p.cattle_id, p.record_id, p.milking_date, p.session, p.expected_litres, p.actual_litres,
         p.ratio, p.method, p.status, p.reason, p.message, p.model_source, p.created_at,
         c.name AS cattle_name, c.tag_number AS cattle_tag
  FROM milk_yield_predictions p
  JOIN cattle c ON c.cattle_id = p.cattle_id`;

const NEWEST_FIRST = `ORDER BY p.milking_date DESC, FIELD(p.session, 'Evening', 'Afternoon', 'Morning')`;

// mysql2 returns DECIMAL columns as strings
const toNumbers = (r) => ({
  ...r,
  expected_litres: Number(r.expected_litres),
  // The normal range is not stored: it always follows from the expected yield
  expected_range: rangeFor(Number(r.expected_litres)),
  actual_litres: r.actual_litres === null ? null : Number(r.actual_litres),
  ratio: r.ratio === null ? null : Number(r.ratio)
});

// One judgement per milking record; re-evaluating the record replaces it
exports.save = async (p) => {
  await db.execute(
    `INSERT INTO milk_yield_predictions
       (cattle_id, record_id, milking_date, session, expected_litres, actual_litres, ratio, method, status, reason, message, model_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
     ON DUPLICATE KEY UPDATE
       cattle_id = incoming.cattle_id, milking_date = incoming.milking_date, session = incoming.session,
       expected_litres = incoming.expected_litres, actual_litres = incoming.actual_litres, ratio = incoming.ratio,
       method = incoming.method, status = incoming.status, reason = incoming.reason,
       message = incoming.message, model_source = incoming.model_source`,
    [
      p.cattle_id,
      p.record_id,
      p.milking_date,
      p.session,
      p.expected_litres,
      p.actual_litres ?? null,
      p.ratio ?? null,
      p.method,
      p.status || 'normal',
      p.reason || null,
      p.message || null,
      p.model_source || null
    ]
  );
};

exports.updateMessage = async (recordId, message) => {
  await db.execute('UPDATE milk_yield_predictions SET message = ? WHERE record_id = ?', [message, recordId]);
};

exports.forCattle = async (cattleId, limit = 30) => {
  // LIMIT is inlined: prepared statements reject a bound LIMIT on some MySQL versions
  const [rows] = await db.execute(`${SELECT} WHERE p.cattle_id = ? ${NEWEST_FIRST} LIMIT ${Number(limit)}`, [cattleId]);
  return rows.map(toNumbers);
};

// Low and high readings over the last `days` days, today included
exports.recentAlerts = async (days = 7) => {
  const [rows] = await db.execute(
    `${SELECT} WHERE p.status IN ('low', 'high') AND p.milking_date >= CURDATE() - INTERVAL ? DAY ${NEWEST_FIRST} LIMIT 200`,
    [days - 1]
  );
  return rows.map(toNumbers);
};

// Expected vs actual litres per day over the last `days` days (today included),
// for the whole herd or one cow / breed. Only judged sessions count, so both
// totals cover the same milkings.
exports.dailyTrend = async ({ days = 30, cattleId = null, breed = null } = {}) => {
  const where = ['p.milking_date >= CURDATE() - INTERVAL ? DAY'];
  const params = [days - 1];
  if (cattleId) {
    where.push('p.cattle_id = ?');
    params.push(cattleId);
  }
  if (breed) {
    where.push('c.breed = ?');
    params.push(breed);
  }
  const [rows] = await db.execute(
    `SELECT p.milking_date AS date,
            SUM(p.expected_litres) AS expected,
            SUM(p.actual_litres) AS actual,
            COUNT(DISTINCT p.cattle_id) AS cows,
            COUNT(*) AS sessions,
            SUM(p.status = 'low') AS low,
            SUM(p.status = 'high') AS high,
            SUM(p.status = 'suppressed') AS suppressed
     FROM milk_yield_predictions p
     JOIN cattle c ON c.cattle_id = p.cattle_id
     WHERE ${where.join(' AND ')}
     GROUP BY p.milking_date
     ORDER BY p.milking_date`,
    params
  );
  const litres = (v) => (v === null ? null : Math.round(Number(v) * 100) / 100);
  return rows.map((r) => ({
    date: r.date,
    expected: litres(r.expected),
    actual: litres(r.actual),
    cows: Number(r.cows),
    sessions: Number(r.sessions),
    low: Number(r.low),
    high: Number(r.high),
    suppressed: Number(r.suppressed)
  }));
};

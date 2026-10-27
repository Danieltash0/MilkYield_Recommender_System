const db = require('../utils/database');

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

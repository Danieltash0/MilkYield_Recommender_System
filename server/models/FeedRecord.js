const db = require('../utils/database');

const SELECT = `
  SELECT f.feed_id, f.cattle_id, f.fed_on, f.concentrate_kg, f.forage_kg, f.notes, f.recorded_by, f.created_at,
         c.name AS cattle_name, c.tag_number AS cattle_tag, u.name AS recorded_by_name
  FROM feed_records f
  JOIN cattle c ON c.cattle_id = f.cattle_id
  LEFT JOIN users u ON u.user_id = f.recorded_by`;

// mysql2 returns DECIMAL columns as strings
const toNumbers = (r) => ({
  ...r,
  concentrate_kg: Number(r.concentrate_kg),
  forage_kg: r.forage_kg === null ? null : Number(r.forage_kg)
});

const filters = ({ cattleId, from, to }, alias = 'f.') => {
  const where = [];
  const params = [];
  if (cattleId) {
    where.push(`${alias}cattle_id = ?`);
    params.push(cattleId);
  }
  if (from) {
    where.push(`${alias}fed_on >= ?`);
    params.push(from);
  }
  if (to) {
    where.push(`${alias}fed_on <= ?`);
    params.push(to);
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

exports.getRecords = async (opts = {}) => {
  const { clause, params } = filters(opts);
  const [rows] = await db.execute(`${SELECT} ${clause} ORDER BY f.fed_on DESC, c.tag_number LIMIT 500`, params);
  return rows.map(toNumbers);
};

// One row per cow per day: saving the same day again replaces it.
// LAST_INSERT_ID(feed_id) makes insertId the existing row's id on an update.
exports.saveRecord = async (r, recordedBy) => {
  const [result] = await db.execute(
    `INSERT INTO feed_records (cattle_id, fed_on, concentrate_kg, forage_kg, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?) AS incoming
     ON DUPLICATE KEY UPDATE feed_id = LAST_INSERT_ID(feed_records.feed_id),
       concentrate_kg = incoming.concentrate_kg, forage_kg = incoming.forage_kg,
       notes = incoming.notes, recorded_by = incoming.recorded_by`,
    [r.cattle_id, r.fed_on, r.concentrate_kg, r.forage_kg ?? null, r.notes || null, recordedBy]
  );
  // affectedRows is 1 for a new row, 2 for a replaced one
  return { id: result.insertId, replaced: result.affectedRows === 2 };
};

exports.deleteRecord = async (id) => {
  const [result] = await db.execute('DELETE FROM feed_records WHERE feed_id = ?', [id]);
  return result.affectedRows;
};

// Map of 'YYYY-MM-DD' -> concentrate kg for one cow
exports.getConcentrateMap = async (cattleId, { from, to } = {}) => {
  const { clause, params } = filters({ cattleId, from, to }, '');
  const [rows] = await db.execute(`SELECT fed_on, concentrate_kg FROM feed_records ${clause}`, params);
  return new Map(rows.map((r) => [String(r.fed_on).slice(0, 10), Number(r.concentrate_kg)]));
};

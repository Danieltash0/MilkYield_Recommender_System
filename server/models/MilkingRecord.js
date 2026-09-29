const db = require('../utils/database');

const SELECT = `
  SELECT m.record_id, m.cattle_id, m.recorded_by, m.milking_date, m.session, m.quantity,
         m.fat_percentage, m.notes, m.created_at,
         c.name AS cattle_name, c.tag_number AS cattle_tag, u.name AS recorded_by_name
  FROM milking_records m
  JOIN cattle c ON c.cattle_id = m.cattle_id
  LEFT JOIN users u ON u.user_id = m.recorded_by`;

// Newest session first: by date, then Evening > Afternoon > Morning
const NEWEST_FIRST = `ORDER BY m.milking_date DESC, FIELD(m.session, 'Evening', 'Afternoon', 'Morning'), m.cattle_id`;

// mysql2 returns DECIMAL columns as strings
const toNumbers = (r) => ({
  ...r,
  quantity: Number(r.quantity),
  fat_percentage: r.fat_percentage === null ? null : Number(r.fat_percentage)
});

exports.getRecords = async ({ cattleId, from, to, limit = 500 } = {}) => {
  const where = [];
  const params = [];
  if (cattleId) {
    where.push('m.cattle_id = ?');
    params.push(cattleId);
  }
  if (from) {
    where.push('m.milking_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('m.milking_date <= ?');
    params.push(to);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  // LIMIT is inlined: prepared statements reject a bound LIMIT on some MySQL versions
  const [rows] = await db.execute(`${SELECT} ${clause} ${NEWEST_FIRST} LIMIT ${Number(limit)}`, params);
  return rows.map(toNumbers);
};

exports.getRecordById = async (id) => {
  const [rows] = await db.execute(`${SELECT} WHERE m.record_id = ?`, [id]);
  return rows[0] && toNumbers(rows[0]);
};

exports.createRecord = async (r, recordedBy) => {
  const [result] = await db.execute(
    `INSERT INTO milking_records (cattle_id, recorded_by, milking_date, session, quantity, fat_percentage, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [r.cattle_id, recordedBy, r.milking_date, r.session, r.quantity, r.fat_percentage ?? null, r.notes || null]
  );
  return result.insertId;
};

exports.updateRecord = async (id, r) => {
  const [result] = await db.execute(
    `UPDATE milking_records SET cattle_id=?, milking_date=?, session=?, quantity=?, fat_percentage=?, notes=?
     WHERE record_id=?`,
    [r.cattle_id, r.milking_date, r.session, r.quantity, r.fat_percentage ?? null, r.notes || null, id]
  );
  return result.affectedRows;
};

exports.deleteRecord = async (id) => {
  const [result] = await db.execute('DELETE FROM milking_records WHERE record_id = ?', [id]);
  return result.affectedRows;
};

// Herd totals for the last `days` days, today included
exports.getSummary = async (days) => {
  const since = days - 1;
  const [daily] = await db.execute(
    `SELECT milking_date AS date, SUM(quantity) AS total, COUNT(DISTINCT cattle_id) AS cows
     FROM milking_records WHERE milking_date >= CURDATE() - INTERVAL ? DAY
     GROUP BY milking_date ORDER BY milking_date`,
    [since]
  );
  const [top] = await db.execute(
    `SELECT c.cattle_id, c.name, c.tag_number, SUM(m.quantity) AS total, COUNT(*) AS sessions
     FROM milking_records m JOIN cattle c ON c.cattle_id = m.cattle_id
     WHERE m.milking_date >= CURDATE() - INTERVAL ? DAY
     GROUP BY c.cattle_id, c.name, c.tag_number ORDER BY total DESC LIMIT 5`,
    [since]
  );
  return {
    daily: daily.map((d) => ({ ...d, total: Number(d.total) })),
    top: top.map((t) => ({ ...t, total: Number(t.total) }))
  };
};

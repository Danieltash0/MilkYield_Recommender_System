const db = require('../utils/database');

const SELECT = `
  SELECT f.record_id, f.record_type, f.category, f.amount, f.record_date, f.description, f.cattle_id,
         f.recorded_by, f.created_at, c.name AS cattle_name, c.tag_number AS cattle_tag, u.name AS recorded_by_name
  FROM financial_records f
  LEFT JOIN cattle c ON c.cattle_id = f.cattle_id
  LEFT JOIN users u ON u.user_id = f.recorded_by`;

// mysql2 returns DECIMAL columns as strings
const withNumber = (r) => ({ ...r, amount: Number(r.amount) });

const filters = ({ type, category, from, to }) => {
  const where = [];
  const params = [];
  if (type) {
    where.push('f.record_type = ?');
    params.push(type);
  }
  if (category) {
    where.push('f.category = ?');
    params.push(category);
  }
  if (from) {
    where.push('f.record_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('f.record_date <= ?');
    params.push(to);
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

exports.getRecords = async (opts = {}) => {
  const { clause, params } = filters(opts);
  const [rows] = await db.execute(`${SELECT} ${clause} ORDER BY f.record_date DESC, f.record_id DESC LIMIT 1000`, params);
  return rows.map(withNumber);
};

exports.getRecordById = async (id) => {
  const [rows] = await db.execute(`${SELECT} WHERE f.record_id = ?`, [id]);
  return rows[0] && withNumber(rows[0]);
};

exports.createRecord = async (r, recordedBy) => {
  const [result] = await db.execute(
    `INSERT INTO financial_records (record_type, category, amount, record_date, description, cattle_id, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [r.record_type, r.category, r.amount, r.record_date, r.description || null, r.cattle_id || null, recordedBy]
  );
  return result.insertId;
};

exports.updateRecord = async (id, r) => {
  const [result] = await db.execute(
    `UPDATE financial_records SET record_type=?, category=?, amount=?, record_date=?, description=?, cattle_id=?
     WHERE record_id=?`,
    [r.record_type, r.category, r.amount, r.record_date, r.description || null, r.cattle_id || null, id]
  );
  return result.affectedRows;
};

exports.deleteRecord = async (id) => {
  const [result] = await db.execute('DELETE FROM financial_records WHERE record_id = ?', [id]);
  return result.affectedRows;
};

// Totals, per-category and per-month breakdowns for a date range
exports.getSummary = async ({ from, to }) => {
  const { clause, params } = filters({ from, to });
  const [byCategory] = await db.execute(
    `SELECT f.record_type, f.category, SUM(f.amount) AS total, COUNT(*) AS entries
     FROM financial_records f ${clause}
     GROUP BY f.record_type, f.category ORDER BY f.record_type DESC, total DESC`,
    params
  );
  const [byMonth] = await db.execute(
    `SELECT DATE_FORMAT(f.record_date, '%Y-%m') AS month,
            SUM(CASE WHEN f.record_type = 'Income' THEN f.amount ELSE 0 END) AS income,
            SUM(CASE WHEN f.record_type = 'Expense' THEN f.amount ELSE 0 END) AS expense
     FROM financial_records f ${clause}
     GROUP BY month ORDER BY month`,
    params
  );
  const categories = byCategory.map((c) => ({ ...c, total: Number(c.total) }));
  const sum = (type) => categories.filter((c) => c.record_type === type).reduce((s, c) => s + c.total, 0);
  const income = Math.round(sum('Income') * 100) / 100;
  const expense = Math.round(sum('Expense') * 100) / 100;
  return {
    income,
    expense,
    net: Math.round((income - expense) * 100) / 100,
    by_category: categories,
    by_month: byMonth.map((m) => ({ month: m.month, income: Number(m.income), expense: Number(m.expense) }))
  };
};

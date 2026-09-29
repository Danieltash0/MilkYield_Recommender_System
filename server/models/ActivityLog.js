const db = require('../utils/database');

// Logging must never break the request that triggered it
exports.createLog = async ({ user_id, action, description, ip_address, user_agent }) => {
  try {
    await db.execute(
      'INSERT INTO activity_logs (user_id, action, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [user_id || null, action, description || null, ip_address || null, user_agent || null]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

const filters = ({ userId, action, from, to, search }) => {
  const where = [];
  const params = [];
  if (userId) {
    where.push('l.user_id = ?');
    params.push(userId);
  }
  if (action) {
    where.push('l.action = ?');
    params.push(action);
  }
  if (from) {
    where.push('l.timestamp >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push('l.timestamp <= ?');
    params.push(`${to} 23:59:59`);
  }
  if (search) {
    where.push('(l.description LIKE ? OR u.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

// One page of logs, newest first, plus the total for paging
exports.getLogs = async (opts = {}, { page = 1, pageSize = 50 } = {}) => {
  const { clause, params } = filters(opts);
  const from = `FROM activity_logs l LEFT JOIN users u ON u.user_id = l.user_id ${clause}`;
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total ${from}`, params);
  // LIMIT/OFFSET are inlined: prepared statements reject bound values there on some MySQL versions
  const [rows] = await db.execute(
    `SELECT l.log_id, l.user_id, l.action, l.description, l.ip_address, l.user_agent, l.timestamp,
            u.name AS user_name, u.role AS user_role
     ${from} ORDER BY l.timestamp DESC, l.log_id DESC
     LIMIT ${Number(pageSize)} OFFSET ${(Number(page) - 1) * Number(pageSize)}`,
    params
  );
  return { total: Number(total), rows };
};

// Distinct action names, for the filter dropdown
exports.getActions = async () => {
  const [rows] = await db.execute('SELECT DISTINCT action FROM activity_logs ORDER BY action');
  return rows.map((r) => r.action);
};

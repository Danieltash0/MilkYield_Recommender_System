const db = require('../utils/database');

// User queries for the admin panel (User.js keeps the auth-facing ones)
const PUBLIC = 'user_id, name, email, role, status, last_login, created_at';

exports.getUsers = async ({ role, status, search } = {}) => {
  const where = [];
  const params = [];
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await db.execute(`SELECT ${PUBLIC} FROM users ${clause} ORDER BY created_at DESC`, params);
  return rows;
};

exports.getUserById = async (id) => {
  const [rows] = await db.execute(`SELECT ${PUBLIC} FROM users WHERE user_id = ?`, [id]);
  return rows[0];
};

exports.createUser = async ({ name, email, password_hash, role, status }) => {
  const [result] = await db.execute(
    'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
    [name, email, password_hash, role, status]
  );
  return result.insertId;
};

exports.updateUser = async (id, { name, email, role, status }) => {
  const [result] = await db.execute(
    'UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE user_id = ?',
    [name, email, role, status, id]
  );
  return result.affectedRows;
};

exports.setPassword = async (id, passwordHash) => {
  const [result] = await db.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, id]);
  return result.affectedRows;
};

exports.deleteUser = async (id) => {
  const [result] = await db.execute('DELETE FROM users WHERE user_id = ?', [id]);
  return result.affectedRows;
};

exports.countActiveAdmins = async () => {
  const [rows] = await db.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'");
  return rows[0].n;
};

// Headline numbers for the admin overview
exports.getStats = async () => {
  const [byRole] = await db.execute(
    "SELECT role, COUNT(*) AS total, SUM(status = 'active') AS active FROM users GROUP BY role"
  );
  const [[recent]] = await db.execute(
    'SELECT COUNT(DISTINCT user_id) AS n FROM activity_logs WHERE timestamp >= NOW() - INTERVAL 7 DAY'
  );
  const [[today]] = await db.execute('SELECT COUNT(*) AS n FROM activity_logs WHERE DATE(timestamp) = CURDATE()');
  return {
    by_role: byRole.map((r) => ({ role: r.role, total: Number(r.total), active: Number(r.active) })),
    active_last_7_days: Number(recent.n),
    actions_today: Number(today.n)
  };
};

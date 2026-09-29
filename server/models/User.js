const db = require('../utils/database');

exports.getUserByEmail = async (email) => {
  const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
};

exports.getUserById = async (id) => {
  const [rows] = await db.execute(
    'SELECT user_id, name, email, role, status, last_login, created_at FROM users WHERE user_id = ?',
    [id]
  );
  return rows[0];
};

exports.createUser = async ({ name, email, password_hash, role }) => {
  const [result] = await db.execute(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, password_hash, role]
  );
  return result.insertId;
};

exports.updateLastLogin = async (id) => {
  await db.execute('UPDATE users SET last_login = NOW() WHERE user_id = ?', [id]);
};

// Active non-admin accounts that work can be assigned to
exports.getAssignableUsers = async () => {
  const [rows] = await db.execute(
    "SELECT user_id, name, role FROM users WHERE status = 'active' AND role <> 'admin' ORDER BY name"
  );
  return rows;
};

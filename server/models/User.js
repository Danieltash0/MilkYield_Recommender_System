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

exports.createUser = async ({ name, email, password_hash, role, status = 'active' }) => {
  const [result] = await db.execute(
    'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
    [name, email, password_hash, role, status]
  );
  return result.insertId;
};

// What every authenticated request is checked against (middleware/auth.js)
exports.getAuthState = async (id) => {
  const [rows] = await db.execute(
    'SELECT user_id, email, role, status, token_version FROM users WHERE user_id = ?',
    [id]
  );
  return rows[0];
};

// Invalidates every token already issued to this user (they must sign in again)
exports.bumpTokenVersion = async (id) => {
  await db.execute('UPDATE users SET token_version = token_version + 1 WHERE user_id = ?', [id]);
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

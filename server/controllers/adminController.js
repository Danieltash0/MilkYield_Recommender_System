const UserAdmin = require('../models/UserAdmin');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const Setting = require('../models/Setting');
const { hashPassword } = require('../utils/bcrypt');
const logActivity = require('../utils/logActivity');

const ROLES = ['admin', 'manager', 'vet', 'worker'];
const STATUSES = ['active', 'inactive'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Returns an error message, or null when the payload is valid
const validateUser = (b, { isNew }) => {
  if (!b.name || !b.name.trim()) return 'Name is required';
  if (b.name.trim().length > 100) return 'Name must be 100 characters or fewer';
  if (!b.email || !EMAIL_RE.test(b.email.trim())) return 'Enter a valid email address';
  if (!ROLES.includes(b.role)) return 'Invalid role';
  if (b.status && !STATUSES.includes(b.status)) return 'Invalid status';
  if (isNew && (!b.password || b.password.length < 8)) return 'Password must be at least 8 characters';
  return null;
};

const isDuplicate = (err) => err && err.code === 'ER_DUP_ENTRY';

// Removing, demoting or deactivating an admin must leave at least one active admin
const wouldRemoveLastAdmin = async (user, next) => {
  const stillActiveAdmin = next && next.role === 'admin' && next.status === 'active';
  if (user.role !== 'admin' || user.status !== 'active' || stillActiveAdmin) return false;
  return (await UserAdmin.countActiveAdmins()) <= 1;
};

// ---- Overview --------------------------------------------------------------

exports.getStats = async (req, res) => {
  try {
    res.json(await UserAdmin.getStats());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load admin overview' });
  }
};

// ---- Users -----------------------------------------------------------------

exports.getUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    res.json(await UserAdmin.getUsers({ role, status, search: search && search.trim() }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load users' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await UserAdmin.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load user' });
  }
};

// Unlike public signup, the admin can create any role, including admin
exports.createUser = async (req, res) => {
  try {
    const problem = validateUser(req.body, { isNew: true });
    if (problem) return res.status(400).json({ error: problem });
    const email = req.body.email.trim().toLowerCase();
    if (await User.getUserByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists' });
    const id = await UserAdmin.createUser({
      name: req.body.name.trim(),
      email,
      password_hash: await hashPassword(req.body.password),
      role: req.body.role,
      status: req.body.status || 'active'
    });
    await logActivity(req, 'user_created', `Created ${req.body.role} account for ${email}`);
    res.status(201).json({ user_id: id });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: 'An account with this email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Could not create user' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await UserAdmin.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const problem = validateUser(req.body, { isNew: false });
    if (problem) return res.status(400).json({ error: problem });

    const next = {
      name: req.body.name.trim(),
      email: req.body.email.trim().toLowerCase(),
      role: req.body.role,
      status: req.body.status || user.status
    };
    const isSelf = user.user_id === req.user.userId;
    if (isSelf && (next.role !== user.role || next.status !== 'active')) {
      return res.status(400).json({ error: 'You cannot change your own role or deactivate your own account' });
    }
    if (await wouldRemoveLastAdmin(user, next)) {
      return res.status(400).json({ error: 'There must always be at least one active admin' });
    }

    await UserAdmin.updateUser(user.user_id, next);
    const changes = [
      next.role !== user.role && `role ${user.role} -> ${next.role}`,
      next.status !== user.status && `status ${user.status} -> ${next.status}`
    ].filter(Boolean);
    await logActivity(req, 'user_updated', `Updated ${next.email}${changes.length ? ` (${changes.join(', ')})` : ''}`);
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: 'An account with this email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Could not update user' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const user = await UserAdmin.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await UserAdmin.setPassword(user.user_id, await hashPassword(password));
    await logActivity(req, 'password_reset', `Reset the password for ${user.email}`);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reset password' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await UserAdmin.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.user_id === req.user.userId) return res.status(400).json({ error: 'You cannot delete your own account' });
    if (await wouldRemoveLastAdmin(user, null)) {
      return res.status(400).json({ error: 'There must always be at least one active admin' });
    }
    await UserAdmin.deleteUser(user.user_id);
    await logActivity(req, 'user_deleted', `Deleted the account for ${user.email}`);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete user' });
  }
};

// ---- Activity logs ---------------------------------------------------------

exports.getLogs = async (req, res) => {
  try {
    const { user_id, action, from, to, search } = req.query;
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 50, 1), 200);
    const { total, rows } = await ActivityLog.getLogs(
      { userId: user_id, action, from, to, search: search && search.trim() },
      { page, pageSize }
    );
    res.json({ logs: rows, total, page, page_size: pageSize, pages: Math.max(Math.ceil(total / pageSize), 1) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load activity logs' });
  }
};

exports.getLogActions = async (req, res) => {
  try {
    res.json(await ActivityLog.getActions());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load log actions' });
  }
};

// ---- Settings --------------------------------------------------------------

exports.getSettings = async (req, res) => {
  try {
    const labels = Object.fromEntries(Object.entries(Setting.DEFINITIONS).map(([k, d]) => [k, d.label]));
    res.json({ values: await Setting.getAll(), labels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load settings' });
  }
};

// Accepts any subset of the known settings; rejects unknown keys
exports.updateSettings = async (req, res) => {
  try {
    const values = {};
    for (const [key, raw] of Object.entries(req.body || {})) {
      const def = Setting.DEFINITIONS[key];
      if (!def) return res.status(400).json({ error: `Unknown setting: ${key}` });
      const value = String(raw ?? '').trim();
      if (def.required && !value) return res.status(400).json({ error: `${def.label} is required` });
      if (value.length > def.max) return res.status(400).json({ error: `${def.label} must be ${def.max} characters or fewer` });
      if (value && def.pattern && !def.pattern.test(value)) return res.status(400).json({ error: `${def.label} is not valid` });
      values[key] = value;
    }
    if (!Object.keys(values).length) return res.status(400).json({ error: 'No settings to update' });
    await Setting.saveMany(values, req.user.userId);
    await logActivity(req, 'settings_updated', `Updated settings: ${Object.keys(values).join(', ')}`);
    res.json({ values: await Setting.getAll() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save settings' });
  }
};

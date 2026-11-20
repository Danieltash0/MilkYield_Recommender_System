const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const crypto = require('crypto');
const { comparePassword, hashPasswordSync } = require('../utils/bcrypt');
const { getSecret } = require('../middleware/auth');

// A real hash of a random string (same cost as user hashes), compared when the email is unknown
const DUMMY_HASH = hashPasswordSync(crypto.randomBytes(16).toString('hex'));

// DB role value -> label shown in the UI
const roleMapping = {
  manager: 'Farm Manager',
  vet: 'Veterinarian',
  worker: 'Worker',
  admin: 'Admin'
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalisedEmail = String(email).trim().toLowerCase();
    const user = await User.getUserByEmail(normalisedEmail);
    // Compare against a dummy hash when there is no such user, so the response
    // takes as long either way and does not reveal which emails are registered
    const valid = await comparePassword(String(password), user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid) {
      await ActivityLog.createLog({
        user_id: user && user.user_id,
        action: 'login_failed',
        description: `Failed sign-in for ${normalisedEmail.slice(0, 100)}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    // Status is only revealed once the password is right
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'This account has been deactivated. Contact the administrator.', code: 'inactive' });
    }

    await User.updateLastLogin(user.user_id);
    await ActivityLog.createLog({
      user_id: user.user_id,
      action: 'login',
      description: `${user.name} logged in`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role, tv: user.token_version || 0 },
      getSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h', algorithm: 'HS256' }
    );

    const { password_hash, token_version, ...safeUser } = user;
    res.json({
      token,
      user: { ...safeUser, role: roleMapping[user.role] || user.role, roleKey: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.logout = async (req, res) => {
  await ActivityLog.createLog({
    user_id: req.user.userId,
    action: 'logout',
    description: 'User logged out',
    ip_address: req.ip,
    user_agent: req.get('User-Agent')
  });
  res.json({ message: 'Logged out successfully' });
};

// Returns the current user; lets the client re-validate a stored token
exports.me = async (req, res) => {
  try {
    const user = await User.getUserById(req.user.userId);
    if (!user || user.status === 'inactive') {
      return res.status(401).json({ error: 'Account not available' });
    }
    res.json({ ...user, role: roleMapping[user.role] || user.role, roleKey: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Could not load profile' });
  }
};

// Always responds the same way whether or not the account exists, so this
// endpoint can't be used to enumerate registered emails.
// TODO: wire up real email delivery once a mail provider is chosen.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    await User.getUserByEmail(email.trim().toLowerCase());
    res.json({ message: 'If an account with that email exists, password reset instructions have been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
};

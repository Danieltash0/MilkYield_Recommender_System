const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { hashPassword } = require('../utils/bcrypt');

// Roles a person can pick when signing up. 'admin' is never self-assignable.
const SIGNUP_ROLES = {
  'Farm Manager': 'manager',
  Veterinarian: 'vet',
  Worker: 'worker'
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password and role are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const dbRole = SIGNUP_ROLES[role];
    if (!dbRole) {
      return res.status(400).json({ error: 'Invalid role selected' });
    }

    const normalisedEmail = email.trim().toLowerCase();
    if (await User.getUserByEmail(normalisedEmail)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const userId = await User.createUser({
      name: name.trim(),
      email: normalisedEmail,
      password_hash: await hashPassword(password),
      role: dbRole
    });

    await ActivityLog.createLog({
      user_id: userId,
      action: 'signup',
      description: `New ${dbRole} account created for ${normalisedEmail}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.status(201).json({ userId });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
};

exports.getAssignableUsers = async (req, res) => {
  try {
    res.json(await User.getAssignableUsers());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load users' });
  }
};

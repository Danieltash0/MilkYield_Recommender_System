const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getSecret = () => process.env.JWT_SECRET || 'dev-only-secret';

// Verifies the Bearer token, then checks the account against the database so a
// deactivated user, a changed role or a password reset takes effect at once
// rather than when the token expires. Attaches { userId, email, role } to req.user.
const authenticateToken = async (req, res, next) => {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  let claims;
  try {
    claims = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
  try {
    const account = await User.getAuthState(claims.userId);
    if (!account || account.status !== 'active') {
      return res.status(401).json({ error: 'Your account is no longer active. Contact the administrator.' });
    }
    if ((claims.tv || 0) !== (account.token_version || 0)) {
      return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
    }
    req.user = { userId: account.user_id, email: account.email, role: account.role };
    next();
  } catch (err) {
    console.error('Auth check failed:', err.message);
    return res.status(500).json({ error: 'Could not verify your session' });
  }
};

// RBAC guard. Roles are the DB values: 'admin' | 'manager' | 'vet' | 'worker'
const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
  }
  next();
};

module.exports = { authenticateToken, requireRole, getSecret };

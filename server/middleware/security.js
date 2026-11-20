const rateLimit = require('express-rate-limit');

const isProduction = () => process.env.NODE_ENV === 'production';

// The JWT secret must be set (and long) in production; refuse to start otherwise.
// In development a missing secret falls back to a fixed value, with a warning.
const checkSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (isProduction() && (!secret || secret.length < 32 || secret === 'change-this-secret')) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');
  }
  if (!secret && process.env.NODE_ENV !== 'test') {
    console.warn('JWT_SECRET is not set; using a development-only secret. Never do this in production.');
  }
};

// Browser origins allowed to call the API directly. In development the React
// app goes through the CRA proxy, so its requests are not cross-origin at all.
const allowedOrigins = () =>
  (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const corsOptions = {
  origin: (origin, done) => done(null, !origin || allowedOrigins().includes(origin))
};

// Only a wrong email/password (401) counts as a failed sign-in; a correct password
// on a deactivated account (403) does not
const wrongPasswordOnly = (req, res) => res.statusCode !== 401;

const limiter = ({ windowMinutes, max, message, skipSuccessfulRequests = false, key }) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    skipSuccessfulRequests,
    requestWasSuccessful: skipSuccessfulRequests ? wrongPasswordOnly : undefined,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: key,
    message: { error: message },
    skip: () => process.env.NODE_ENV === 'test'
  });

const emailOf = (req) => String((req.body && req.body.email) || '').trim().toLowerCase();

// Failed sign-ins per address from one IP: wrong passwords count, successful ones do not
const loginLimiter = limiter({
  windowMinutes: 15,
  max: 5,
  skipSuccessfulRequests: true,
  key: (req) => `${req.ip}|${emailOf(req)}`,
  message: 'Too many failed sign-in attempts. Wait 15 minutes and try again, or ask an admin to reset your password.'
});

// Any sign-in traffic from one IP, whatever the address (stops spraying many accounts)
const loginIpLimiter = limiter({
  windowMinutes: 15,
  max: 50,
  skipSuccessfulRequests: true,
  message: 'Too many sign-in attempts from this network. Try again in 15 minutes.'
});

// Generous enough for a farm team signing up together on one network
const signupLimiter = limiter({
  windowMinutes: 60,
  max: 10,
  message: 'Too many accounts created from this network. Try again in an hour.'
});

const resetLimiter = limiter({
  windowMinutes: 15,
  max: 5,
  message: 'Too many password reset requests. Try again in 15 minutes.'
});

module.exports = { checkSecret, corsOptions, allowedOrigins, loginLimiter, loginIpLimiter, signupLimiter, resetLimiter };

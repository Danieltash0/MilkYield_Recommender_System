jest.mock('../models/User');
jest.mock('../models/ActivityLog', () => ({ createLog: jest.fn(async () => {}) }));

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { hashPasswordSync } = require('../utils/bcrypt');
const { passwordProblem } = require('../utils/password');
const { authenticateToken, getSecret } = require('../middleware/auth');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const request = (extra = {}) => ({ body: {}, headers: {}, ip: '127.0.0.1', get: () => 'jest', header: () => '', ...extra });

const HASH = hashPasswordSync('Pasture42');
const account = (extra = {}) => ({
  user_id: 7, name: 'Achieng', email: 'achieng@farm.co.ke', role: 'worker', status: 'active',
  token_version: 0, password_hash: HASH, ...extra
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

describe('passwordProblem', () => {
  test.each([
    ['ab12', /at least 5/],
    ['onlyletters', /letter and one number/],
    ['1234567', /letter and one number/]
  ])('rejects %s', (pw, msg) => {
    expect(passwordProblem(pw)).toMatch(msg);
  });

  test('accepts 5+ characters with a letter and a number, common or not', () => {
    for (const pw of ['cow12', 'Password1', 'achieng2026', 'Dairy@123']) expect(passwordProblem(pw)).toBeNull();
  });

  test('rejects passwords longer than bcrypt can use', () => {
    expect(passwordProblem(`a1${'x'.repeat(80)}`)).toMatch(/or fewer/);
  });
});

describe('login', () => {
  const login = async (body, user) => {
    User.getUserByEmail.mockResolvedValue(user);
    const res = response();
    await authController.login(request({ body }), res);
    return res;
  };

  test('signs in an active user with a token carrying the token version', async () => {
    const res = await login({ email: ' Achieng@Farm.co.ke ', password: 'Pasture42' }, account({ token_version: 3 }));
    expect(User.getUserByEmail).toHaveBeenCalledWith('achieng@farm.co.ke');
    const { token, user } = res.json.mock.calls[0][0];
    expect(jwt.verify(token, getSecret())).toMatchObject({ userId: 7, role: 'worker', tv: 3 });
    expect(user).not.toHaveProperty('password_hash');
    expect(user).not.toHaveProperty('token_version');
  });

  test('a wrong password and an unknown email get the same answer, and are logged', async () => {
    const wrong = await login({ email: 'achieng@farm.co.ke', password: 'Nope12345' }, account());
    const unknown = await login({ email: 'nobody@farm.co.ke', password: 'Nope12345' }, undefined);
    for (const res of [wrong, unknown]) {
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Incorrect email or password' });
    }
    expect(ActivityLog.createLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'login_failed', user_id: 7 }));
    expect(ActivityLog.createLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'login_failed', user_id: undefined }));
  });

  test('a deactivated account cannot sign in, and is only told so with the right password', async () => {
    const res = await login({ email: 'achieng@farm.co.ke', password: 'Pasture42' }, account({ status: 'inactive' }));
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toMatchObject({ code: 'inactive' });

    const guess = await login({ email: 'achieng@farm.co.ke', password: 'Guess1234' }, account({ status: 'inactive' }));
    expect(guess.status).toHaveBeenCalledWith(401);
  });
});

describe('authenticateToken', () => {
  const run = async (token, state) => {
    User.getAuthState.mockResolvedValue(state);
    const req = request({ header: () => (token ? `Bearer ${token}` : '') });
    const res = response();
    const next = jest.fn();
    await authenticateToken(req, res, next);
    return { req, res, next };
  };
  const sign = (claims, opts = {}) => jwt.sign({ userId: 7, role: 'worker', tv: 0, ...claims }, getSecret(), opts);

  test('lets an active user through, with the role from the database', async () => {
    const { req, next } = await run(sign({}), account({ role: 'manager' }));
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ userId: 7, email: 'achieng@farm.co.ke', role: 'manager' });
  });

  test('rejects a missing, forged or expired token', async () => {
    expect((await run(null, account())).res.status).toHaveBeenCalledWith(401);
    expect((await run(jwt.sign({ userId: 7 }, 'not-the-secret'), account())).res.status).toHaveBeenCalledWith(401);
    expect((await run(sign({}, { expiresIn: -10 }), account())).res.status).toHaveBeenCalledWith(401);
  });

  test('a deactivated or deleted user is locked out straight away', async () => {
    for (const state of [account({ status: 'inactive' }), undefined]) {
      const { res, next } = await run(sign({}), state);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    }
  });

  test('a token from before a password reset no longer works', async () => {
    const { res, next } = await run(sign({ tv: 0 }), account({ token_version: 1 }));
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ error: 'Your session has ended. Please sign in again.' });
  });
});

describe('signup', () => {
  const signup = async (body) => {
    const res = response();
    await userController.signup(request({ body }), res);
    return res;
  };
  const valid = { name: 'Baraka Otieno', email: 'baraka@farm.co.ke', password: 'Milking2026', role: 'Farm Manager' };

  test('creates an account straight away, with no approval step', async () => {
    User.getUserByEmail.mockResolvedValue(undefined);
    User.createUser.mockResolvedValue(12);
    const res = await signup(valid);
    const created = User.createUser.mock.calls[0][0];
    expect(created).toMatchObject({ role: 'manager' });
    expect(created.status).toBeUndefined(); // the model's default, 'active'
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ userId: 12 });
  });

  test('applies the password rule', async () => {
    const res = await signup({ ...valid, password: 'abc1' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.createUser).not.toHaveBeenCalled();
  });

  test('admin cannot be chosen at signup', async () => {
    const res = await signup({ ...valid, role: 'Admin' });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

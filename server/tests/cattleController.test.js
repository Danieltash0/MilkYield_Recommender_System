jest.mock('../models/Cattle');

const Cattle = require('../models/Cattle');
const cattleController = require('../controllers/cattleController');

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const cow = {
  tag_number: 'CT010', name: 'Nala', gender: 'Female', category: 'Cow', date_of_birth: '2021-02-01',
  last_calving_date: '2026-06-01', parity: 2, conception_date: '2026-09-01', prev_lactation_yield_l: 5100
};

const create = async (overrides) => {
  const res = response();
  await cattleController.createCattle({ body: { ...cow, ...overrides }, user: { userId: 1 } }, res);
  return res;
};

const errorOf = (res) => res.json.mock.calls[0][0].error;

beforeEach(() => {
  jest.clearAllMocks();
  Cattle.createCattle.mockResolvedValue(10);
  Cattle.updateCattle.mockResolvedValue(1);
});

describe('lactation validation', () => {
  test('accepts a complete, sensible cow', async () => {
    const res = await create({});
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Cattle.createCattle).toHaveBeenCalledWith(expect.objectContaining({ parity: 2, prev_lactation_yield_l: 5100 }), 1);
  });

  test('blank values mean not recorded', async () => {
    const res = await create({ last_calving_date: '', parity: '', conception_date: null, prev_lactation_yield_l: '' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test.each([
    [{ parity: 2.5 }, /Parity must be a whole number/],
    [{ parity: -1 }, /Parity/],
    [{ parity: 21 }, /Parity/],
    [{ parity: 'two' }, /Parity/],
    [{ prev_lactation_yield_l: -5 }, /Previous lactation yield/],
    [{ prev_lactation_yield_l: 20001 }, /Previous lactation yield/],
    [{ last_calving_date: '2026-13-40' }, /Last calving date must be a valid date/],
    [{ last_calving_date: '2999-01-01' }, /Last calving date cannot be in the future/],
    [{ conception_date: '2999-01-01' }, /Conception date cannot be in the future/],
    [{ last_calving_date: '2020-01-01' }, /Last calving date cannot be before the date of birth/],
    [{ conception_date: '2021-01-01' }, /Conception date cannot be before the date of birth/]
  ])('rejects %j', async (overrides, message) => {
    const res = await create(overrides);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(errorOf(res)).toMatch(message);
    expect(Cattle.createCattle).not.toHaveBeenCalled();
  });

  test('accepts the limits', async () => {
    expect((await create({ parity: 0, prev_lactation_yield_l: 0 })).status).toHaveBeenCalledWith(201);
    expect((await create({ parity: 20, prev_lactation_yield_l: 20000 })).status).toHaveBeenCalledWith(201);
  });

  test('applies on update as well', async () => {
    const res = response();
    await cattleController.updateCattle({ params: { id: '3' }, body: { ...cow, parity: 50 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Cattle.updateCattle).not.toHaveBeenCalled();
  });
});

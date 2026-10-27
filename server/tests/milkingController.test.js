jest.mock('../models/MilkingRecord');
jest.mock('../models/Cattle');
jest.mock('../utils/logActivity', () => jest.fn(async () => {}));
jest.mock('../services/yieldService', () => ({ evaluateRecord: jest.fn() }));

const MilkingRecord = require('../models/MilkingRecord');
const Cattle = require('../models/Cattle');
const yieldService = require('../services/yieldService');
const milkingController = require('../controllers/milkingController');

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const body = { cattle_id: 1, milking_date: '2026-10-01', session: 'Morning', quantity: 9.5 };
const request = (extra = {}) => ({ body: { ...body }, user: { userId: 1 }, params: {}, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  Cattle.getCattleById.mockResolvedValue({ cattle_id: 1, category: 'Cow' });
  MilkingRecord.createRecord.mockResolvedValue(42);
  MilkingRecord.updateRecord.mockResolvedValue(1);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

describe('createRecord', () => {
  test('still returns 201 when the recommender throws', async () => {
    yieldService.evaluateRecord.mockRejectedValue(new Error('database went away'));
    const res = response();
    await milkingController.createRecord(request(), res);
    expect(MilkingRecord.createRecord).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ record_id: 42, recommendation: null });
  });

  test('includes the recommendation when there is one', async () => {
    const recommendation = { expected: 10, status: 'normal', message: 'ok' };
    yieldService.evaluateRecord.mockResolvedValue(recommendation);
    const res = response();
    await milkingController.createRecord(request(), res);
    expect(yieldService.evaluateRecord).toHaveBeenCalledWith(expect.objectContaining({ record_id: 42, cattle_id: 1, quantity: 9.5 }));
    expect(res.json).toHaveBeenCalledWith({ record_id: 42, recommendation });
  });

  test('validation still runs first', async () => {
    Cattle.getCattleById.mockResolvedValue({ cattle_id: 1, category: 'Heifer' });
    const res = response();
    await milkingController.createRecord(request(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(yieldService.evaluateRecord).not.toHaveBeenCalled();
  });
});

describe('updateRecord', () => {
  test('still succeeds when the recommender throws', async () => {
    yieldService.evaluateRecord.mockRejectedValue(new Error('boom'));
    const res = response();
    await milkingController.updateRecord(request({ params: { id: '7' } }), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Milking record updated successfully', recommendation: null });
  });

  test('re-evaluates the updated record', async () => {
    yieldService.evaluateRecord.mockResolvedValue({ status: 'low' });
    const res = response();
    await milkingController.updateRecord(request({ params: { id: '7' } }), res);
    expect(yieldService.evaluateRecord).toHaveBeenCalledWith(expect.objectContaining({ record_id: 7 }));
    expect(res.json).toHaveBeenCalledWith({ message: 'Milking record updated successfully', recommendation: { status: 'low' } });
  });
});

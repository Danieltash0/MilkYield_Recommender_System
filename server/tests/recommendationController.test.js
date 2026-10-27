jest.mock('../models/Cattle');
jest.mock('../models/YieldPrediction');
jest.mock('../services/yieldService');

const YieldPrediction = require('../models/YieldPrediction');
const controller = require('../controllers/recommendationController');

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const SERIES = [{ date: '2026-10-27', expected: 40, actual: 36, cows: 4, sessions: 8, low: 1, high: 0, suppressed: 0 }];

beforeEach(() => {
  jest.resetAllMocks();
  YieldPrediction.dailyTrend.mockResolvedValue(SERIES);
});

describe('getTrend', () => {
  test('defaults to the whole herd over 30 days', async () => {
    const res = response();
    await controller.getTrend({ query: {} }, res);
    expect(YieldPrediction.dailyTrend).toHaveBeenCalledWith({ days: 30, cattleId: null, breed: null });
    expect(res.json).toHaveBeenCalledWith({ days: 30, cattle_id: null, breed: null, series: SERIES });
  });

  test('passes the cow and breed filters through', async () => {
    const res = response();
    await controller.getTrend({ query: { days: '14', cattle_id: '3', breed: 'Jersey' } }, res);
    expect(YieldPrediction.dailyTrend).toHaveBeenCalledWith({ days: 14, cattleId: 3, breed: 'Jersey' });
  });

  test('keeps days between 1 and 365', async () => {
    await controller.getTrend({ query: { days: '5000' } }, response());
    expect(YieldPrediction.dailyTrend).toHaveBeenLastCalledWith(expect.objectContaining({ days: 365 }));
    await controller.getTrend({ query: { days: '-4' } }, response());
    expect(YieldPrediction.dailyTrend).toHaveBeenLastCalledWith(expect.objectContaining({ days: 1 }));
    await controller.getTrend({ query: { days: 'abc' } }, response());
    expect(YieldPrediction.dailyTrend).toHaveBeenLastCalledWith(expect.objectContaining({ days: 30 }));
  });

  test('rejects a cattle_id that is not a positive whole number', async () => {
    for (const bad of ['abc', '0', '-2']) {
      const res = response();
      await controller.getTrend({ query: { cattle_id: bad } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(YieldPrediction.dailyTrend).not.toHaveBeenCalled();
  });

  test('a database error gives a 500', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    YieldPrediction.dailyTrend.mockRejectedValue(new Error('down'));
    const res = response();
    await controller.getTrend({ query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    console.error.mockRestore();
  });
});

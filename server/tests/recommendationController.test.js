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

describe('getProjection', () => {
  const Cattle = require('../models/Cattle');
  const yieldService = require('../services/yieldService');
  const PROJECTION = { available: true, series: [] };

  beforeEach(() => {
    Cattle.getCattleById.mockResolvedValue({ cattle_id: 4, category: 'Cow' });
    yieldService.projectAhead.mockResolvedValue(PROJECTION);
  });

  test('defaults to 60 days', async () => {
    const res = response();
    await controller.getProjection({ params: { id: '4' }, query: {} }, res);
    expect(yieldService.projectAhead).toHaveBeenCalledWith(4, 60);
    expect(res.json).toHaveBeenCalledWith({ cattle_id: 4, days: 60, projection: PROJECTION });
  });

  test('keeps days between 1 and 60', async () => {
    await controller.getProjection({ params: { id: '4' }, query: { days: '400' } }, response());
    expect(yieldService.projectAhead).toHaveBeenLastCalledWith(4, 60);
    await controller.getProjection({ params: { id: '4' }, query: { days: '-3' } }, response());
    expect(yieldService.projectAhead).toHaveBeenLastCalledWith(4, 1);
  });

  test('404 for a missing cow and 400 for a heifer', async () => {
    Cattle.getCattleById.mockResolvedValueOnce(undefined);
    const missing = response();
    await controller.getProjection({ params: { id: '9' }, query: {} }, missing);
    expect(missing.status).toHaveBeenCalledWith(404);
    Cattle.getCattleById.mockResolvedValueOnce({ cattle_id: 5, category: 'Heifer' });
    const heifer = response();
    await controller.getProjection({ params: { id: '5' }, query: {} }, heifer);
    expect(heifer.status).toHaveBeenCalledWith(400);
    expect(yieldService.projectAhead).not.toHaveBeenCalled();
  });
});

describe('getHerdProjection', () => {
  const yieldService = require('../services/yieldService');
  const HERD = { cows: 3, series: [] };

  beforeEach(() => yieldService.projectHerd.mockResolvedValue(HERD));

  test('defaults to the whole herd over 60 days', async () => {
    const res = response();
    await controller.getHerdProjection({ query: {} }, res);
    expect(yieldService.projectHerd).toHaveBeenCalledWith({ days: 60, breed: null, cattleId: null });
    expect(res.json).toHaveBeenCalledWith({ days: 60, cattle_id: null, breed: null, projection: HERD });
  });

  test('passes filters through and keeps days between 1 and 60', async () => {
    await controller.getHerdProjection({ query: { days: '90', breed: 'Jersey', cattle_id: '2' } }, response());
    expect(yieldService.projectHerd).toHaveBeenLastCalledWith({ days: 60, breed: 'Jersey', cattleId: 2 });
  });

  test('rejects a bad cattle_id', async () => {
    const res = response();
    await controller.getHerdProjection({ query: { cattle_id: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(yieldService.projectHerd).not.toHaveBeenCalled();
  });
});

jest.mock('../models/Cattle');
jest.mock('../models/MilkingRecord');
jest.mock('../models/HealthRecord');
jest.mock('../models/FeedRecord');
jest.mock('../models/BreedBaseline');
jest.mock('../models/YieldFactor');
jest.mock('../models/YieldPrediction');
jest.mock('../services/nnModel', () => ({
  getMeta: jest.fn(() => null),
  isAvailable: jest.fn(() => false),
  predict: jest.fn()
}));

const Cattle = require('../models/Cattle');
const MilkingRecord = require('../models/MilkingRecord');
const HealthRecord = require('../models/HealthRecord');
const FeedRecord = require('../models/FeedRecord');
const BreedBaseline = require('../models/BreedBaseline');
const YieldFactor = require('../models/YieldFactor');
const YieldPrediction = require('../models/YieldPrediction');
const yieldService = require('../services/yieldService');

const COW = {
  cattle_id: 1, tag_number: 'CT001', name: 'Bessie', breed: 'Holstein-Friesian', category: 'Cow',
  date_of_birth: '2020-03-15', last_calving_date: '2026-07-01', parity: 3, conception_date: null, prev_lactation_yield_l: 6200
};

// Newest first, as MilkingRecord.getRecords returns them
const records = [
  { record_id: 9, cattle_id: 1, milking_date: '2026-10-05', session: 'Morning', quantity: 50 }, // later: must be ignored
  { record_id: 8, cattle_id: 1, milking_date: '2026-10-04', session: 'Evening', quantity: 6 }, // the record being judged
  { record_id: 7, cattle_id: 1, milking_date: '2026-10-04', session: 'Morning', quantity: 10 },
  { record_id: 6, cattle_id: 1, milking_date: '2026-10-03', session: 'Evening', quantity: 10 },
  { record_id: 5, cattle_id: 1, milking_date: '2026-10-03', session: 'Morning', quantity: 10 }
];
const judged = records[1];

beforeEach(() => {
  jest.resetAllMocks();
  Cattle.getCattleById.mockResolvedValue(COW);
  MilkingRecord.getRecords.mockResolvedValue(records);
  HealthRecord.getRecords.mockResolvedValue([]);
  FeedRecord.getConcentrateMap.mockResolvedValue(new Map([['2026-10-04', 6]]));
  BreedBaseline.getAll.mockResolvedValue([{ breed: 'Holstein-Friesian', avg_daily_yield: 18 }]);
  YieldFactor.getActive.mockResolvedValue([]);
  YieldPrediction.save.mockResolvedValue();
  YieldPrediction.updateMessage.mockResolvedValue();
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;
});

describe('evaluateRecord', () => {
  test('judges a record against the sessions before it and stores the result', async () => {
    const r = await yieldService.evaluateRecord(judged);
    expect(MilkingRecord.getRecords).toHaveBeenCalledWith({ cattleId: 1, to: '2026-10-04', limit: 100 });
    expect(r).toMatchObject({ expected: 10, method: 'moving_average', historyUsed: 3, actual: 6, ratio: 0.6, status: 'low' });
    expect(r.message).toMatch(/Bessie gave 6 L, about 40% below the expected 10 L/);
    expect(YieldPrediction.save).toHaveBeenCalledWith(expect.objectContaining({
      cattle_id: 1, record_id: 8, milking_date: '2026-10-04', session: 'Evening',
      expected_litres: 10, actual_litres: 6, ratio: 0.6, method: 'moving_average', status: 'low', message: r.message
    }));
  });

  test('a recent illness suppresses the alert', async () => {
    HealthRecord.getRecords.mockResolvedValue([{ record_type: 'Illness', record_date: '2026-10-02' }]);
    const r = await yieldService.evaluateRecord(judged);
    expect(r).toMatchObject({ status: 'suppressed', reason: 'illness or injury recorded recently' });
  });

  test('cold start falls back to the per-session breed baseline', async () => {
    MilkingRecord.getRecords.mockResolvedValue([judged]);
    const r = await yieldService.evaluateRecord(judged);
    expect(r).toMatchObject({ expected: 9, method: 'breed_baseline', status: 'low' });
  });

  test('cold start uses the knowledge graph when a factor applies', async () => {
    // Bessie is 95 days in milk on 2026-10-04 and in her 3rd lactation
    YieldFactor.getActive.mockResolvedValue([
      { factor_key: 'stage_peak', attribute: 'days_in_milk', min_value: 45, max_value: 100, multiplier: 1.2, label: 'peak lactation' },
      { factor_key: 'parity_first', attribute: 'parity', min_value: 1, max_value: 2, multiplier: 0.8, label: 'first lactation' }
    ]);
    MilkingRecord.getRecords.mockResolvedValue([judged]);
    const r = await yieldService.evaluateRecord(judged);
    expect(r).toMatchObject({ expected: 10.8, method: 'knowledge_graph', status: 'low' });
    expect(r.adjustments.map((a) => a.key)).toEqual(['stage_peak']);
    expect(r.message).toMatch(/breed average adjusted for peak lactation/);
    expect(YieldPrediction.save).toHaveBeenCalledWith(expect.objectContaining({ method: 'knowledge_graph', expected_litres: 10.8 }));
  });

  test('a missing yield_factors table falls back to the breed baseline', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    YieldFactor.getActive.mockRejectedValue(new Error("Table 'yield_factors' doesn't exist"));
    MilkingRecord.getRecords.mockResolvedValue([judged]);
    const r = await yieldService.evaluateRecord(judged);
    expect(r).toMatchObject({ expected: 9, method: 'breed_baseline' });
    console.warn.mockRestore();
  });

  test('returns null for cattle that are not cows', async () => {
    Cattle.getCattleById.mockResolvedValue({ ...COW, category: 'Heifer' });
    expect(await yieldService.evaluateRecord(judged)).toBeNull();
    expect(YieldPrediction.save).not.toHaveBeenCalled();
  });

  test('returns null when there is nothing to compare against', async () => {
    MilkingRecord.getRecords.mockResolvedValue([judged]);
    BreedBaseline.getAll.mockResolvedValue([]);
    expect(await yieldService.evaluateRecord(judged)).toBeNull();
    expect(YieldPrediction.save).not.toHaveBeenCalled();
  });

  test('with an LLM configured, rewords the note in the background', async () => {
    process.env.LLM_API_KEY = 'k';
    process.env.LLM_MODEL = 'm';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Bessie gave 6 L, 40% under the expected 10 L.' } }] })
    });
    const r = await yieldService.evaluateRecord(judged);
    expect(r.message).toMatch(/^Bessie gave 6 L, about 40% below/); // the response carries the template
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(YieldPrediction.updateMessage).toHaveBeenCalledWith(8, 'Bessie gave 6 L, 40% under the expected 10 L.');
    fetchMock.mockRestore();
  });
});

describe('forecastNext', () => {
  test('forecasts from all history with the factors used', async () => {
    const f = await yieldService.forecastNext(1);
    expect(f.expected).toBeCloseTo((50 + 6 + 10 + 10 + 10) / 5, 2);
    expect(f).toMatchObject({
      method: 'moving_average',
      history_used: 5,
      last_record: { milking_date: '2026-10-05', session: 'Morning', quantity: 50 },
      factors: { parity: 3, baseline_breed: 'Holstein-Friesian', baseline_per_session: 9, breed: 'Holstein-Friesian' }
    });
  });

  test('includes the profile-only knowledge graph estimate and its path', async () => {
    YieldFactor.getActive.mockResolvedValue([
      { factor_key: 'parity_mature', attribute: 'parity', min_value: 3, max_value: null, multiplier: 1, label: 'mature cow' }
    ]);
    const f = await yieldService.forecastNext(1);
    expect(f.method).toBe('moving_average'); // history still wins
    expect(f.knowledge_graph).toMatchObject({
      expected: 9, breed: 'Holstein-Friesian', baseline_per_session: 9, multiplier: 1, clamped: false
    });
    expect(f.knowledge_graph.applied.map((a) => a.key)).toEqual(['parity_mature']);
    expect(f.knowledge_graph.path[0]).toEqual({ from: 'Bessie', relation: 'is_a', to: 'Holstein-Friesian' });
  });

  test('reports why when nothing can be forecast', async () => {
    MilkingRecord.getRecords.mockResolvedValue([]);
    BreedBaseline.getAll.mockResolvedValue([]);
    const f = await yieldService.forecastNext(1);
    expect(f).toMatchObject({ expected: null, method: null, last_record: null });
    expect(f.note).toMatch(/No milking history/);
  });

  test('null for a missing cow', async () => {
    Cattle.getCattleById.mockResolvedValue(undefined);
    expect(await yieldService.forecastNext(99)).toBeNull();
  });
});

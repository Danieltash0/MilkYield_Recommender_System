const { recommend } = require('../services/recommender');

const history = (quantities) =>
  quantities.map((quantity, i) => ({ milking_date: `2026-10-${String(i + 1).padStart(2, '0')}`, session: 'Morning', quantity }));

const ctx = (flags = {}) => ({ daysInMilk: 60, parity: 2, flags: { sick: false, inTreatment: false, recentCalving: false, ...flags } });

const FEATURES = ['lag1', 'lag2', 'lag3', 'lag4', 'lag5', 'lag6', 'lag7', 'mean7', 'days_in_milk', 'parity', 'breed_baseline'];

// Stands in for nnModel
const fakeModel = ({ output = 11, available = true, best = 'nn', features = FEATURES } = {}) => ({
  getMeta: jest.fn(() => ({ features, defaults: {}, best, data_source: 'synthetic' })),
  isAvailable: jest.fn(() => available),
  predict: jest.fn(async () => (output instanceof Error ? Promise.reject(output) : output))
});

const tenTen = history(Array(10).fill(10));

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('tiers', () => {
  test('cold start uses the breed baseline with fewer than 3 records', async () => {
    const r = await recommend({ history: history([9, 9]), context: ctx(), baseline: 8 }, { predictor: 'ma' });
    expect(r).toMatchObject({ expected: 8, method: 'breed_baseline', historyUsed: 0, modelSource: null, status: null });
  });

  test('cold start uses the knowledge graph when the cow meets a factor', async () => {
    const applied = [{ key: 'parity_first', label: 'first lactation', multiplier: 0.8 }];
    const knowledge = { perSession: 6.4, applied };
    const r = await recommend({ history: history([9]), context: ctx(), baseline: 8, knowledge, actual: 4 }, { predictor: 'ma' });
    expect(r).toMatchObject({ expected: 6.4, method: 'knowledge_graph', historyUsed: 0, adjustments: applied, status: 'low' });
  });

  test('a knowledge graph with no factor met falls back to the breed baseline', async () => {
    const r = await recommend({ history: [], context: ctx(), baseline: 8, knowledge: { perSession: 8, applied: [] } }, { predictor: 'ma' });
    expect(r).toMatchObject({ expected: 8, method: 'breed_baseline', adjustments: null });
  });

  test('the knowledge graph never overrides 3+ records', async () => {
    const knowledge = { perSession: 2, applied: [{ label: 'x', multiplier: 0.25 }] };
    const r = await recommend({ history: history([9, 9, 9]), context: ctx(), baseline: 8, knowledge }, { predictor: 'ma' });
    expect(r).toMatchObject({ expected: 9, method: 'moving_average', adjustments: null });
  });

  test('throws with no history and no baseline', async () => {
    await expect(recommend({ history: [], context: ctx(), baseline: null })).rejects.toThrow(/No milking history/);
  });

  test('moving average from 3 records', async () => {
    const r = await recommend({ history: history([9, 10, 11]), context: ctx(), baseline: 8 }, { predictor: 'ma' });
    expect(r).toMatchObject({ expected: 10, method: 'moving_average', historyUsed: 3 });
  });

  test('moving average uses only the last 7 records', async () => {
    const r = await recommend({ history: history([100, 100, 7, 7, 7, 7, 7, 7, 7]), context: ctx() }, { predictor: 'ma' });
    expect(r).toMatchObject({ expected: 7, historyUsed: 7 });
  });

  test('uses the model when asked for and everything is known', async () => {
    const model = fakeModel({ output: 11.234 });
    const r = await recommend({ history: tenTen, context: ctx(), baseline: 9, actual: 11 }, { predictor: 'nn', model });
    expect(r).toMatchObject({ expected: 11.23, method: 'neural_net', modelSource: 'synthetic', historyUsed: 7, status: 'normal' });
    expect(model.predict).toHaveBeenCalledWith('nn', [10, 10, 10, 10, 10, 10, 10, 10, 60, 2, 9]);
  });

  test('lr picks the linear model', async () => {
    const model = fakeModel();
    const r = await recommend({ history: tenTen, context: ctx(), baseline: 9 }, { predictor: 'lr', model });
    expect(r.method).toBe('linear_regression');
    expect(model.predict.mock.calls[0][0]).toBe('lr');
  });

  test('auto follows model_meta best, and best=ma means no model', async () => {
    const lr = fakeModel({ best: 'lr' });
    expect((await recommend({ history: tenTen, context: ctx(), baseline: 9 }, { predictor: 'auto', model: lr })).method).toBe('linear_regression');
    const ma = fakeModel({ best: 'ma' });
    expect((await recommend({ history: tenTen, context: ctx(), baseline: 9 }, { predictor: 'auto', model: ma })).method).toBe('moving_average');
    expect(ma.predict).not.toHaveBeenCalled();
  });

  test('PREDICTOR=ma never touches the model', async () => {
    const model = fakeModel();
    const r = await recommend({ history: tenTen, context: ctx(), baseline: 9 }, { predictor: 'ma', model });
    expect(r.method).toBe('moving_average');
    expect(model.isAvailable).not.toHaveBeenCalled();
  });

  test('defaults to PREDICTOR from the environment, else ma', async () => {
    const before = process.env.PREDICTOR;
    const model = fakeModel();
    delete process.env.PREDICTOR;
    expect((await recommend({ history: tenTen, context: ctx(), baseline: 9 }, { model })).method).toBe('moving_average');
    process.env.PREDICTOR = 'nn';
    expect((await recommend({ history: tenTen, context: ctx(), baseline: 9 }, { model })).method).toBe('neural_net');
    if (before === undefined) delete process.env.PREDICTOR;
    else process.env.PREDICTOR = before;
  });
});

describe('model fallbacks to the moving average', () => {
  const run = (model, opts = {}) =>
    recommend({ history: opts.history || tenTen, context: opts.context || ctx(), baseline: 'baseline' in opts ? opts.baseline : 9 }, { predictor: 'nn', model });

  test.each([
    ['model files missing', fakeModel({ available: false })],
    ['model throws', fakeModel({ output: new Error('boom') })],
    ['output is NaN', fakeModel({ output: NaN })],
    ['output is Infinity', fakeModel({ output: Infinity })],
    ['output is zero', fakeModel({ output: 0 })],
    ['output is negative', fakeModel({ output: -4 })],
    ['output is absurdly high (over 3x)', fakeModel({ output: 30.1 })],
    ['output is absurdly low (under 0.25x)', fakeModel({ output: 2.4 })]
  ])('%s', async (_, model) => {
    const r = await run(model);
    expect(r).toMatchObject({ method: 'moving_average', expected: 10, modelSource: null });
  });

  test('fewer than 7 records', async () => {
    const model = fakeModel();
    const r = await run(model, { history: history([10, 10, 10, 10, 10, 10]) });
    expect(r.method).toBe('moving_average');
    expect(model.predict).not.toHaveBeenCalled();
  });

  test('an input is unknown and has no default', async () => {
    const model = fakeModel();
    const r = await run(model, { context: { ...ctx(), daysInMilk: null } });
    expect(r.method).toBe('moving_average');
    expect(model.predict).not.toHaveBeenCalled();
  });

  test('breed baseline missing is an unknown input', async () => {
    const model = fakeModel();
    expect((await run(model, { baseline: null })).method).toBe('moving_average');
  });

  test('outputs at the edges of the sane band are accepted', async () => {
    expect((await run(fakeModel({ output: 2.5 }))).method).toBe('neural_net');
    expect((await run(fakeModel({ output: 30 }))).method).toBe('neural_net');
  });
});

describe('anomaly band', () => {
  const judge = (actual, flags) => recommend({ history: tenTen, context: ctx(flags), baseline: 9, actual }, { predictor: 'ma' });

  test.each([
    [8, 'normal', 0.8],
    [7.9, 'low', 0.79],
    [12, 'normal', 1.2],
    [12.1, 'high', 1.21],
    [10, 'normal', 1]
  ])('%s L against 10 L is %s', async (actual, status, ratio) => {
    const r = await judge(actual);
    expect(r).toMatchObject({ actual, status, ratio, reason: null });
  });

  test.each([
    [{ sick: true }, 'illness or injury recorded recently'],
    [{ inTreatment: true }, 'under treatment'],
    [{ recentCalving: true }, 'recently calved'],
    [{ sick: true, inTreatment: true, recentCalving: true }, 'illness or injury recorded recently']
  ])('low reading with %j is suppressed', async (flags, reason) => {
    expect(await judge(5, flags)).toMatchObject({ status: 'suppressed', reason });
  });

  test('high readings are suppressed too', async () => {
    expect(await judge(15, { recentCalving: true })).toMatchObject({ status: 'suppressed', reason: 'recently calved' });
  });

  test('normal stays normal whatever the flags', async () => {
    expect(await judge(10, { sick: true, inTreatment: true })).toMatchObject({ status: 'normal', reason: null });
  });
});

const fs = require('fs');
const os = require('os');
const path = require('path');
const nnModel = require('../services/nnModel');

const REAL_DIR = path.join(__dirname, '..', 'ml', 'models');
const sample = JSON.parse(fs.readFileSync(path.join(REAL_DIR, 'sample_input.json'), 'utf8'));

beforeEach(() => {
  delete process.env.MODELS_DIR;
  nnModel.reset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('bundled models', () => {
  test('load, with features matching sample_input.json', () => {
    expect(nnModel.isAvailable('nn')).toBe(true);
    expect(nnModel.isAvailable('lr')).toBe(true);
    expect(nnModel.getMeta().features).toEqual(sample.features);
  });

  test('give the same answers in Node as in Python (to 1e-3)', async () => {
    expect(sample.cases.length).toBeGreaterThan(0);
    for (const c of sample.cases) {
      expect(Math.abs((await nnModel.predict('nn', c.input)) - c.nn)).toBeLessThan(1e-3);
      expect(Math.abs((await nnModel.predict('lr', c.input)) - c.lr)).toBeLessThan(1e-3);
    }
  });

  test('warn once that they are synthetic', () => {
    nnModel.getMeta();
    nnModel.getMeta();
    const synthetic = console.warn.mock.calls.filter(([m]) => /SYNTHETIC/.test(m));
    expect(synthetic).toHaveLength(nnModel.getMeta().data_source === 'synthetic' ? 1 : 0);
  });
});

describe('input checks', () => {
  test('rejects the wrong number of features', async () => {
    await expect(nnModel.predict('nn', [1, 2, 3])).rejects.toThrow(/needs \d+ features, got 3/);
  });

  test('rejects NaN and non-numbers', async () => {
    const bad = [...sample.cases[0].input];
    bad[0] = NaN;
    await expect(nnModel.predict('nn', bad)).rejects.toThrow(/non-numeric/);
    bad[0] = '5';
    await expect(nnModel.predict('lr', bad)).rejects.toThrow(/non-numeric/);
  });

  test('rejects unknown model names', async () => {
    expect(nnModel.isAvailable('xgboost')).toBe(false);
    await expect(nnModel.predict('xgboost', sample.cases[0].input)).rejects.toThrow(/not available/);
  });
});

describe('missing files', () => {
  test('an empty MODELS_DIR means no model, without throwing', () => {
    process.env.MODELS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dairydan-models-'));
    nnModel.reset();
    expect(nnModel.getMeta()).toBeNull();
    expect(nnModel.isAvailable('nn')).toBe(false);
  });
});

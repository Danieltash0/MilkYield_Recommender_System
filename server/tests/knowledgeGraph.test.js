const { meets, applicableFactors, estimate, MIN_MULTIPLIER, MAX_MULTIPLIER } = require('../services/knowledgeGraph');

const f = (factor_key, attribute, min_value, max_value, multiplier, label) => ({
  factor_key, attribute, min_value, max_value, multiplier, label, source: `source of ${factor_key}`
});

// A slice of the seeded yield_factors table
const FACTORS = [
  f('stage_rising', 'days_in_milk', 15, 45, 1.22, 'rising towards peak lactation'),
  f('stage_peak', 'days_in_milk', 45, 100, 1.23, 'peak lactation'),
  f('stage_extended', 'days_in_milk', 305, null, 0.65, 'extended lactation'),
  f('parity_first', 'parity', 1, 2, 0.8, 'first lactation'),
  f('parity_second', 'parity', 2, 3, 0.93, 'second lactation'),
  f('pregnancy_late', 'days_pregnant', 180, 240, 0.82, 'late pregnancy'),
  f('feed_high', 'concentrate_kg', 3, 5, 1.1, 'extra concentrate fed'),
  f('health_recent', 'health_active', 1, null, 0.85, 'illness or treatment this week')
];
const JERSEY = { breed: 'Jersey', avg_daily_yield: 7 };

describe('meets', () => {
  test('min is inclusive, max exclusive, null is unbounded', () => {
    const peak = FACTORS[1];
    expect(meets(peak, 45)).toBe(true);
    expect(meets(peak, 99.9)).toBe(true);
    expect(meets(peak, 100)).toBe(false);
    expect(meets(peak, 44)).toBe(false);
    expect(meets(FACTORS[2], 900)).toBe(true);
  });

  test('an unknown value meets nothing', () => {
    expect(meets(FACTORS[2], null)).toBe(false);
  });
});

describe('applicableFactors', () => {
  test('picks the factors whose conditions the cow meets', () => {
    const applied = applicableFactors({ daysInMilk: 60, parity: 1, daysPregnant: 0, concentrateKg: 2, healthActive: 0 }, FACTORS);
    expect(applied.map((a) => a.key).sort()).toEqual(['parity_first', 'stage_peak']);
    expect(applied.find((a) => a.key === 'parity_first')).toMatchObject({
      attribute: 'parity', value: 1, multiplier: 0.8, label: 'first lactation', source: 'source of parity_first'
    });
  });

  test('unknown context values add nothing', () => {
    expect(applicableFactors({ daysInMilk: null, parity: null, concentrateKg: null }, FACTORS)).toEqual([]);
    expect(applicableFactors(undefined, FACTORS)).toEqual([]);
  });

  test('overlapping rows on one attribute never compound', () => {
    const overlapping = [...FACTORS, f('peak_again', 'days_in_milk', 50, 70, 1.5, 'duplicate')];
    const applied = applicableFactors({ daysInMilk: 60 }, overlapping);
    expect(applied).toHaveLength(1);
    expect(applied[0].key).toBe('stage_peak');
  });

  test('ignores unknown attributes and unusable multipliers', () => {
    const odd = [f('x', 'weight_kg', 0, null, 1.1, 'heavy'), f('y', 'parity', 1, 2, 0, 'zero'), f('z', 'parity', 1, 2, 'abc', 'bad')];
    expect(applicableFactors({ parity: 1, weightKg: 500 }, odd)).toEqual([]);
  });
});

describe('estimate', () => {
  test('breed baseline per session times every factor met, with the path', () => {
    const e = estimate({
      cowLabel: 'Daisy', breed: 'Jersey', baselineRow: JERSEY,
      context: { daysInMilk: 60, parity: 1, concentrateKg: 4 }, factors: FACTORS
    });
    // 7 L/day / 2 sessions x 1.23 x 0.8 x 1.1
    expect(e.baselinePerSession).toBe(3.5);
    expect(e.multiplier).toBeCloseTo(1.23 * 0.8 * 1.1, 3);
    expect(e.perSession).toBeCloseTo(3.5 * 1.23 * 0.8 * 1.1, 2);
    expect(e).toMatchObject({ breed: 'Jersey', dailyBaseline: 7, clamped: false });
    expect(e.applied).toHaveLength(3);
    expect(e.path[0]).toEqual({ from: 'Daisy', relation: 'is_a', to: 'Jersey' });
    expect(e.path[1]).toEqual({ from: 'Jersey', relation: 'has_baseline', to: '7 L/day' });
    expect(e.path).toContainEqual({ from: 'Daisy', relation: 'meets', to: 'first lactation', because: 'parity = 1' });
    expect(e.path).toContainEqual({ from: 'first lactation', relation: 'multiplies_yield_by', to: '0.8' });
  });

  test('a breed without its own row shows which baseline it borrowed', () => {
    const e = estimate({ cowLabel: 'Kibet', breed: 'Mixed', baselineRow: { breed: 'Other', avg_daily_yield: 8 }, context: {}, factors: FACTORS });
    expect(e.path.slice(0, 3)).toEqual([
      { from: 'Kibet', relation: 'is_a', to: 'Mixed' },
      { from: 'Mixed', relation: 'uses_baseline_of', to: 'Other' },
      { from: 'Other', relation: 'has_baseline', to: '8 L/day' }
    ]);
  });

  test('no factor met gives the plain baseline', () => {
    const e = estimate({ baselineRow: JERSEY, context: {}, factors: FACTORS });
    expect(e).toMatchObject({ perSession: 3.5, multiplier: 1, applied: [] });
  });

  test('stacked factors are kept within bounds', () => {
    const harsh = [
      f('a', 'parity', 1, null, 0.4, 'a'), f('b', 'days_in_milk', 0, null, 0.4, 'b'), f('c', 'age_months', 0, null, 0.4, 'c')
    ];
    const low = estimate({ baselineRow: JERSEY, context: { parity: 1, daysInMilk: 1, ageMonths: 30 }, factors: harsh });
    expect(low).toMatchObject({ multiplier: MIN_MULTIPLIER, clamped: true });
    expect(low.perSession).toBeCloseTo(3.5 * MIN_MULTIPLIER, 2);

    const generous = harsh.map((x) => ({ ...x, multiplier: 1.5 }));
    const high = estimate({ baselineRow: JERSEY, context: { parity: 1, daysInMilk: 1, ageMonths: 30 }, factors: generous });
    expect(high).toMatchObject({ multiplier: MAX_MULTIPLIER, clamped: true });
  });

  test('null without a usable breed baseline', () => {
    expect(estimate({ baselineRow: null, context: { parity: 1 }, factors: FACTORS })).toBeNull();
    expect(estimate({ baselineRow: { breed: 'X', avg_daily_yield: 0 }, factors: FACTORS })).toBeNull();
  });
});

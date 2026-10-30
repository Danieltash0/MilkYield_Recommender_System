const { project, wood, pregnancyFactor, spread, MAX_DAYS, RANGE_START, RANGE_END } = require('../services/projection');

const run = (overrides = {}) => project({ asOf: '2026-10-30', dailyLevel: 10, daysInMilk: 20, daysPregnant: 0, ...overrides });

describe('curve pieces', () => {
  test('the Wood curve rises to a peak at day 50, then falls', () => {
    expect(wood(20)).toBeLessThan(wood(50));
    expect(wood(100)).toBeLessThan(wood(50));
    expect(wood(49)).toBeLessThan(wood(50));
    expect(wood(51)).toBeLessThan(wood(50));
  });

  test('pregnancy lowers yield only after day 120', () => {
    expect(pregnancyFactor(0)).toBe(1);
    expect(pregnancyFactor(120)).toBe(1);
    expect(pregnancyFactor(170)).toBeCloseTo(0.9);
  });

  test('the range widens from start to end', () => {
    expect(spread(1)).toBeCloseTo(RANGE_START);
    expect(spread(MAX_DAYS)).toBeCloseTo(RANGE_END);
    expect(spread(30)).toBeGreaterThan(spread(10));
  });
});

describe('project', () => {
  test('gives one row per day for two months, dated from tomorrow', () => {
    const p = run();
    expect(p.series).toHaveLength(60);
    expect(p.series[0]).toMatchObject({ date: '2026-10-31', day: 1, days_in_milk: 21, days_pregnant: null, dry: false });
    expect(p.series[59].date).toBe('2026-12-29');
    expect(p.daily_level).toBe(10);
  });

  test('starts at the current level and follows the curve', () => {
    const p = run();
    expect(p.series[0].expected).toBeCloseTo(10, 0);
    // Day 30 is days in milk 50, the peak
    const peak = p.series[29];
    expect(peak.expected).toBeGreaterThan(p.series[0].expected);
    expect(peak.expected).toBeGreaterThan(p.series[59].expected);
    expect(p.events).toEqual([{ date: '2026-11-29', day: 30, label: 'Peak of the lactation curve' }]);
  });

  test('a cow past peak declines', () => {
    const p = run({ daysInMilk: 150 });
    expect(p.series[59].expected).toBeLessThan(p.series[0].expected);
    expect(p.change_pct).toBeLessThan(0);
    expect(p.events.map((e) => e.label)).toEqual(['Late lactation: yield falls faster']);
  });

  test('the range around each day widens', () => {
    const p = run();
    const first = p.series[0];
    const last = p.series[59];
    expect(first.low).toBeCloseTo(first.expected * 0.8, 1);
    expect(first.high).toBeCloseTo(first.expected * 1.2, 1);
    expect(last.low).toBeCloseTo(last.expected * 0.7, 1);
    expect(last.high).toBeCloseTo(last.expected * 1.3, 1);
  });

  test('late pregnancy lowers yield and she is dried off at day 220', () => {
    const p = run({ daysInMilk: 180, daysPregnant: 190 });
    expect(p.series[0].days_pregnant).toBe(191);
    const dryDay = p.series.find((s) => s.dry);
    expect(dryDay).toMatchObject({ day: 30, expected: 0, low: 0, high: 0 });
    expect(p.series.slice(30).every((s) => s.dry && s.expected === 0)).toBe(true);
    expect(p.events.map((e) => e.label)).toEqual(['Late lactation: yield falls faster', 'Expected dry-off (about two months before calving)']);
    expect(p.change_pct).toBe(-100);
  });

  test('sums each 30 days', () => {
    const p = run();
    expect(p.months).toHaveLength(2);
    const total = p.series.slice(0, 30).reduce((s, d) => s + d.expected, 0);
    expect(p.months[0]).toMatchObject({ from: '2026-10-31', to: '2026-11-29' });
    expect(p.months[0].total).toBeCloseTo(total, 0);
    expect(p.months[0].avg_daily).toBeCloseTo(total / 30, 1);
    expect(run({ days: 20 }).months).toEqual([]);
  });

  test('keeps the horizon between 1 and 60 days', () => {
    expect(run({ days: 365 }).series).toHaveLength(60);
    expect(run({ days: 7 }).series).toHaveLength(7);
  });

  test('nothing to project without a level or days in milk', () => {
    expect(run({ dailyLevel: 0 })).toBeNull();
    expect(run({ daysInMilk: null })).toBeNull();
  });
});

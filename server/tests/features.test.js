const f = require('../services/features');

const rec = (milking_date, session, quantity = 10) => ({ milking_date, session, quantity });

describe('date maths', () => {
  test('counts days across months and leap years in UTC', () => {
    expect(f.daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(f.daysBetween('2023-02-28', '2023-03-01')).toBe(1);
    expect(f.daysBetween('2026-10-27', '2026-10-20')).toBe(-7);
    expect(f.daysBetween(null, '2026-10-27')).toBeNull();
  });

  test('accepts timestamp strings by their date part', () => {
    expect(f.dayNumber('2026-10-27 08:15:00')).toBe(f.dayNumber('2026-10-27'));
  });

  test('counts whole months', () => {
    expect(f.monthsBetween('2020-03-15', '2020-04-14')).toBe(0);
    expect(f.monthsBetween('2020-03-15', '2020-04-15')).toBe(1);
    expect(f.monthsBetween('2020-03-15', '2026-10-27')).toBe(79);
    expect(f.monthsBetween('2027-01-01', '2026-10-27')).toBeNull();
  });
});

describe('record ordering', () => {
  const records = [
    rec('2026-10-02', 'Morning', 3),
    rec('2026-10-01', 'Evening', 2),
    rec('2026-10-02', 'Evening', 5),
    rec('2026-10-02', 'Afternoon', 4),
    rec('2026-10-01', 'Morning', 1)
  ];

  test('sorts oldest first by date then session', () => {
    expect(f.sortRecords(records).map((r) => r.quantity)).toEqual([1, 2, 3, 4, 5]);
  });

  test('does not mutate its input', () => {
    const copy = [...records];
    f.sortRecords(records);
    expect(records).toEqual(copy);
  });

  test('priorRecords returns only sessions strictly before the target', () => {
    const prior = f.priorRecords(records, { milking_date: '2026-10-02', session: 'Afternoon' });
    expect(prior.map((r) => r.quantity)).toEqual([1, 2, 3]);
    expect(f.priorRecords(records, { milking_date: '2026-10-01', session: 'Morning' })).toEqual([]);
  });
});

describe('breed baselines', () => {
  const rows = [
    { breed: 'Holstein-Friesian', avg_daily_yield: 18 },
    { breed: 'Friesian', avg_daily_yield: 17 },
    { breed: 'Jersey', avg_daily_yield: 11 },
    { breed: 'Other', avg_daily_yield: 10 }
  ];

  test('matches exactly, ignoring case, spaces and punctuation', () => {
    expect(f.pickBaseline('holstein friesian', rows).avg_daily_yield).toBe(18);
    expect(f.pickBaseline(' JERSEY ', rows).avg_daily_yield).toBe(11);
  });

  test('falls back to the longest partial match', () => {
    expect(f.pickBaseline('Holstein', rows).breed).toBe('Holstein-Friesian');
    expect(f.pickBaseline('Friesian cross', rows).breed).toBe('Friesian');
  });

  test('ignores short keys and never partially matches Other', () => {
    expect(f.pickBaseline('Jer', rows).breed).toBe('Other');
    expect(f.pickBaseline('Brother', rows).breed).toBe('Other');
    expect(f.pickBaseline(null, rows).breed).toBe('Other');
  });

  test('returns null with no match and no Other row', () => {
    expect(f.pickBaseline('Sahiwal', rows.slice(0, 3))).toBeNull();
    expect(f.pickBaseline('Jersey', [])).toBeNull();
  });

  test('splits the daily yield per session', () => {
    const before = process.env.MILKINGS_PER_DAY;
    delete process.env.MILKINGS_PER_DAY;
    expect(f.baselinePerSession({ avg_daily_yield: 18 })).toBe(9);
    process.env.MILKINGS_PER_DAY = '3';
    expect(f.baselinePerSession({ avg_daily_yield: 18 })).toBe(6);
    if (before === undefined) delete process.env.MILKINGS_PER_DAY;
    else process.env.MILKINGS_PER_DAY = before;
    expect(f.baselinePerSession(null)).toBeNull();
  });
});

describe('health signals', () => {
  const asOf = '2026-10-20';

  test('illness or injury in the last 7 days means sick', () => {
    const s = f.healthSignals([{ record_type: 'Illness', record_date: '2026-10-17' }], asOf);
    expect(s).toEqual({ sick: true, inTreatment: false, healthActive: 1, daysSinceIllness: 3 });
    expect(f.healthSignals([{ record_type: 'Injury', record_date: '2026-10-13' }], asOf).sick).toBe(true);
  });

  test('older events only count towards days since illness', () => {
    const s = f.healthSignals([{ record_type: 'Illness', record_date: '2026-10-12' }], asOf);
    expect(s.sick).toBe(false);
    expect(s.healthActive).toBe(0);
    expect(s.daysSinceIllness).toBe(8);
  });

  test('treatment sets inTreatment', () => {
    const s = f.healthSignals([{ record_type: 'Treatment', record_date: '2026-10-20' }], asOf);
    expect(s.inTreatment).toBe(true);
    expect(s.sick).toBe(false);
    expect(s.healthActive).toBe(1);
    expect(s.daysSinceIllness).toBe(0);
  });

  test('caps days since illness and ignores routine records', () => {
    expect(f.healthSignals([], asOf).daysSinceIllness).toBe(30);
    expect(f.healthSignals([{ record_type: 'Illness', record_date: '2025-01-01' }], asOf).daysSinceIllness).toBe(30);
    expect(f.healthSignals([{ record_type: 'Vaccination', record_date: '2026-10-19' }], asOf)).toEqual({
      sick: false, inTreatment: false, healthActive: 0, daysSinceIllness: 30
    });
  });

  test('a later event never leaks into an earlier date', () => {
    const events = [{ record_type: 'Illness', record_date: '2026-10-21' }];
    expect(f.healthSignals(events, asOf)).toEqual({ sick: false, inTreatment: false, healthActive: 0, daysSinceIllness: 30 });
  });
});

describe('feedSignals', () => {
  test("today's concentrate against the average of the 7 days before", () => {
    const feed = new Map([
      ['2026-10-20', 1], ['2026-10-19', 4], ['2026-10-18', 5], ['2026-10-14', 3],
      ['2026-10-12', 9], // 8 days back: outside the usual window
      ['2026-10-21', 7] // after asOf: never used
    ]);
    expect(f.feedSignals(feed, '2026-10-20')).toEqual({ today: 1, usual: 4, daysLogged: 3 });
  });

  test('unknown when nothing is logged', () => {
    expect(f.feedSignals(undefined, '2026-10-20')).toEqual({ today: null, usual: null, daysLogged: 0 });
    expect(f.feedSignals({ '2026-10-19': '3.5' }, '2026-10-20')).toEqual({ today: null, usual: 3.5, daysLogged: 1 });
  });
});

describe('buildContext', () => {
  const cow = {
    date_of_birth: '2020-03-15',
    last_calving_date: '2026-10-01',
    parity: 3,
    conception_date: '2026-10-10',
    prev_lactation_yield_l: '6200.0'
  };

  test('describes the cow on the given date', () => {
    const ctx = f.buildContext({
      cow,
      asOf: '2026-10-20',
      feedByDate: new Map([['2026-10-20', 5.5]]),
      healthEvents: [{ record_type: 'Illness', record_date: '2026-10-18' }]
    });
    expect(ctx).toEqual({
      ageMonths: 79,
      daysInMilk: 19,
      parity: 3,
      daysPregnant: 10,
      concentrateKg: 5.5,
      prevLactationL: 6200,
      healthActive: 1,
      daysSinceIllness: 2,
      feed: { today: 5.5, usual: null, daysLogged: 0 },
      flags: { sick: true, inTreatment: false, recentCalving: false }
    });
  });

  test('reads feed from a plain object and leaves missing feed unknown', () => {
    expect(f.buildContext({ cow, asOf: '2026-10-20', feedByDate: { '2026-10-20': '4' } }).concentrateKg).toBe(4);
    expect(f.buildContext({ cow, asOf: '2026-10-19', feedByDate: { '2026-10-20': 4 } }).concentrateKg).toBeNull();
  });

  test('flags a recent calving', () => {
    expect(f.buildContext({ cow, asOf: '2026-10-04' }).flags.recentCalving).toBe(true);
    expect(f.buildContext({ cow, asOf: '2026-10-08' }).flags.recentCalving).toBe(false);
  });

  test('before the calving date, lactation details are unknown', () => {
    const ctx = f.buildContext({ cow, asOf: '2026-09-20' });
    expect(ctx.daysInMilk).toBeNull();
    expect(ctx.parity).toBeNull();
    expect(ctx.prevLactationL).toBeNull();
    expect(ctx.daysPregnant).toBe(0);
    expect(ctx.flags.recentCalving).toBe(false);
  });

  test('unknown values are null and not pregnant is 0', () => {
    const ctx = f.buildContext({ cow: {}, asOf: '2026-10-20' });
    expect(ctx).toMatchObject({ ageMonths: null, daysInMilk: null, parity: null, daysPregnant: 0, concentrateKg: null, prevLactationL: null });
  });
});

describe('buildFeatureRow', () => {
  const history = [1, 2, 3, 4, 5, 6, 7, 8].map((q, i) => rec(`2026-10-0${i + 1}`, 'Morning', q));
  const ctx = { daysInMilk: 30, parity: 2, concentrateKg: null, healthActive: 0 };
  const names = ['lag1', 'lag2', 'lag7', 'mean7', 'breed_baseline', 'days_in_milk', 'parity', 'concentrate_kg', 'health_active'];

  test('builds the vector in the requested order from the last 7 records', () => {
    const row = f.buildFeatureRow(names, history, ctx, 9, { concentrate_kg: 4.2 });
    // last 7 = 2..8: lag1 is the newest (8), lag7 the oldest (2)
    expect(row).toEqual([8, 7, 2, 5, 9, 30, 2, 4.2, 0]);
  });

  test('returns null when a value is unknown and has no default', () => {
    expect(f.buildFeatureRow(names, history, ctx, 9, {})).toBeNull();
    expect(f.buildFeatureRow(['breed_baseline'], history, ctx, null, {})).toBeNull();
  });

  test('returns null with fewer than 7 records', () => {
    expect(f.buildFeatureRow(['lag1'], history.slice(0, 6), ctx, 9, {})).toBeNull();
  });
});

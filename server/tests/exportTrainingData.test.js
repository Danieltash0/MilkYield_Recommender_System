const { COLUMNS, buildExportRows, toCsv, summarise } = require('../scripts/exportTrainingData');

const fixtures = () => ({
  cows: [
    { cattle_id: 1, category: 'Cow', breed: 'Jersey', date_of_birth: '2020-01-10', last_calving_date: '2026-09-01', parity: 2, conception_date: '2026-10-02', prev_lactation_yield_l: '4300.0' },
    { cattle_id: 2, category: 'Bull', breed: 'Friesian' },
    { cattle_id: 3, category: 'Cow', breed: 'Mystery', date_of_birth: null }
  ],
  records: [
    { cattle_id: 1, milking_date: '2026-10-03', session: 'Evening', quantity: '5.50' },
    { cattle_id: 1, milking_date: '2026-10-01', session: 'Morning', quantity: '6.00' },
    { cattle_id: 1, milking_date: '2026-10-03', session: 'Morning', quantity: '6.25' },
    { cattle_id: 2, milking_date: '2026-10-01', session: 'Morning', quantity: '1.00' },
    { cattle_id: 3, milking_date: '2026-10-02', session: 'Afternoon', quantity: '4.00' }
  ],
  feed: [{ cattle_id: 1, fed_on: '2026-10-03', concentrate_kg: '4.50' }],
  health: [{ cattle_id: 1, record_date: '2026-10-02', record_type: 'Illness' }],
  baselines: [
    { breed: 'Jersey', avg_daily_yield: 11 },
    { breed: 'Other', avg_daily_yield: 10 }
  ]
});

describe('buildExportRows', () => {
  const rows = buildExportRows(fixtures());

  test('exports cows only, each cow oldest session first', () => {
    expect(rows.map((r) => [r.cow_id, r.date, r.session_idx])).toEqual([
      [1, '2026-10-01', 0],
      [1, '2026-10-03', 0],
      [1, '2026-10-03', 2],
      [3, '2026-10-02', 1]
    ]);
  });

  test('describes each record as it was on its own date', () => {
    // 1 Oct: before the illness and the conception, no feed recorded
    expect(rows[0]).toEqual({
      cow_id: 1, date: '2026-10-01', session_idx: 0, litres: 6, parity: 2, days_in_milk: 30, breed_baseline: 5.5,
      age_months: 80, days_pregnant: 0, concentrate_kg: null, prev_lactation_l: 4300, health_active: 0, days_since_illness: 30
    });
    // 3 Oct: illness the day before, pregnant 1 day, fed 4.5 kg
    expect(rows[1]).toMatchObject({ days_in_milk: 32, days_pregnant: 1, concentrate_kg: 4.5, health_active: 1, days_since_illness: 1 });
  });

  test('unknown breeds use the Other baseline and missing details stay unknown', () => {
    expect(rows[3]).toMatchObject({ breed_baseline: 5, parity: null, days_in_milk: null, age_months: null, prev_lactation_l: null });
  });
});

describe('toCsv and summarise', () => {
  const rows = buildExportRows(fixtures());

  test('writes the header in order and blanks for unknown values', () => {
    const lines = toCsv(rows).trim().split('\n');
    expect(lines[0]).toBe(COLUMNS.join(','));
    expect(lines[1]).toBe('1,2026-10-01,0,6,2,30,5.5,80,0,,4300,0,30');
    expect(lines).toHaveLength(5);
  });

  test('counts rows, cows and unknown values', () => {
    const s = summarise(rows);
    expect(s.rows).toBe(4);
    expect(s.cows).toBe(2);
    // both 3 Oct sessions share that day's feed
    expect(s.missing.concentrate_kg).toBe(2);
    expect(s.missing.litres).toBe(0);
  });
});

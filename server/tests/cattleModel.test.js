jest.mock('../utils/database', () => ({ execute: jest.fn() }));

const db = require('../utils/database');
const Cattle = require('../models/Cattle');

const base = { tag_number: 'CT001', name: 'Bessie', gender: 'Female', category: 'Cow', date_of_birth: '2020-03-15' };

beforeEach(() => {
  db.execute.mockReset();
  db.execute.mockResolvedValue([{ affectedRows: 1, insertId: 5 }]);
});

describe('updateCattle', () => {
  test('leaves lactation columns alone when the request did not send them', async () => {
    await Cattle.updateCattle(1, base);
    const [sql, params] = db.execute.mock.calls[0];
    ['last_calving_date', 'parity', 'conception_date', 'prev_lactation_yield_l'].forEach((col) => expect(sql).not.toMatch(col));
    expect(params).toHaveLength(9);
  });

  test('updates only the lactation columns that were sent, blank as NULL', async () => {
    await Cattle.updateCattle(1, { ...base, parity: 3, conception_date: '' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toMatch(/parity=\?, conception_date=\?, notes=\?/);
    expect(sql).not.toMatch(/last_calving_date|prev_lactation_yield_l/);
    expect(params).toEqual(['CT001', 'Bessie', null, 'Good', 'Female', 'Cow', '2020-03-15', 3, null, null, 1]);
  });

  test('an explicit null clears a column', async () => {
    await Cattle.updateCattle(1, { ...base, last_calving_date: null });
    expect(db.execute.mock.calls[0][0]).toMatch(/last_calving_date=\?/);
    expect(db.execute.mock.calls[0][1]).toContain(null);
  });
});

describe('createCattle and reads', () => {
  test('inserts all four lactation columns', async () => {
    await Cattle.createCattle({ ...base, parity: 2, prev_lactation_yield_l: 4800 }, 1);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toMatch(/last_calving_date, parity, conception_date, prev_lactation_yield_l/);
    expect(params).toEqual(['CT001', 'Bessie', null, 'Good', 'Female', 'Cow', '2020-03-15', null, 2, null, 4800, null, 1]);
  });

  test('returns previous lactation yield as a number', async () => {
    db.execute.mockResolvedValue([[{ cattle_id: 1, prev_lactation_yield_l: '6200.0' }]]);
    expect((await Cattle.getCattleById(1)).prev_lactation_yield_l).toBe(6200);
    db.execute.mockResolvedValue([[]]);
    expect(await Cattle.getCattleById(2)).toBeUndefined();
  });
});

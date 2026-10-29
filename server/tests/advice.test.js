const { adviceFor } = require('../services/advice');

const ctx = ({ feed = null, daysInMilk = 90, daysPregnant = 0, flags = {} } = {}) => ({
  daysInMilk,
  daysPregnant,
  feed,
  flags: { sick: false, inTreatment: false, recentCalving: false, ...flags }
});
const codes = (tips) => tips.map((t) => t.code);

describe('low readings', () => {
  test('a cut ration is named with both amounts', () => {
    const tips = adviceFor({ status: 'low', context: ctx({ feed: { today: 1.5, usual: 4, daysLogged: 5 } }) });
    expect(codes(tips)).toEqual(['feed_drop', 'check_udder']);
    expect(tips[0].text).toBe('Concentrate was cut to 1.5 kg from her usual 4 kg; restore the usual ration.');
    expect(tips[0].numbers).toEqual([1.5, 4]);
    expect(tips[1].text).toMatch(/^Also check/);
  });

  test('a small cut is not a cut', () => {
    const tips = adviceFor({ status: 'low', context: ctx({ feed: { today: 3.5, usual: 4, daysLogged: 5 } }) });
    expect(codes(tips)).toEqual(['check_udder']);
  });

  test('feed missing today when it is normally logged', () => {
    const tips = adviceFor({ status: 'low', context: ctx({ feed: { today: null, usual: 4, daysLogged: 3 } }) });
    expect(codes(tips)).toEqual(['feed_missing', 'check_udder']);
  });

  test('very little concentrate', () => {
    const tips = adviceFor({ status: 'low', context: ctx({ feed: { today: 0.5, usual: null, daysLogged: 0 } }) });
    expect(codes(tips)).toEqual(['feed_low', 'check_udder']);
    expect(tips[0].numbers).toEqual([0.5]);
  });

  test('late lactation and drying off explain a fall', () => {
    expect(codes(adviceFor({ status: 'low', context: ctx({ daysInMilk: 280 }) }))).toEqual(['late_lactation', 'check_udder']);
    expect(codes(adviceFor({ status: 'low', context: ctx({ daysInMilk: 280, daysPregnant: 220 }) }))).toEqual(['near_dry_off', 'check_udder']);
  });

  test('nothing explains it: escalate to the vet', () => {
    const tips = adviceFor({ status: 'low', context: ctx({ feed: { today: 4, usual: 4, daysLogged: 7 } }) });
    expect(codes(tips)).toEqual(['check_udder']);
    expect(tips[0].text).toMatch(/No feed change or health event explains the drop.*ask the vet/);
  });
});

describe('other statuses', () => {
  test('high: check the entry, and name a raised ration', () => {
    expect(codes(adviceFor({ status: 'high', context: ctx() }))).toEqual(['check_entry']);
    const tips = adviceFor({ status: 'high', context: ctx({ feed: { today: 6, usual: 4, daysLogged: 5 } }) });
    expect(codes(tips)).toEqual(['check_entry', 'feed_rise']);
    expect(tips[1].text).toBe('Concentrate was raised to 6 kg from her usual 4 kg, which may explain the rise.');
  });

  test('high readings never get feed-cut or missing-feed tips', () => {
    expect(codes(adviceFor({ status: 'high', context: ctx({ feed: { today: 1, usual: 4, daysLogged: 5 } }) }))).toEqual(['check_entry']);
    expect(codes(adviceFor({ status: 'high', context: ctx({ feed: { today: null, usual: 4, daysLogged: 5 } }) }))).toEqual(['check_entry']);
  });

  test('suppressed: health recovery or fresh-cow advice', () => {
    expect(codes(adviceFor({ status: 'suppressed', context: ctx({ flags: { sick: true } }) }))).toEqual(['health_recovery']);
    expect(codes(adviceFor({ status: 'suppressed', context: ctx({ flags: { inTreatment: true } }) }))).toEqual(['health_recovery']);
    expect(codes(adviceFor({ status: 'suppressed', context: ctx({ flags: { recentCalving: true } }) }))).toEqual(['fresh_cow']);
  });

  test('normal readings need no advice', () => {
    expect(adviceFor({ status: 'normal', context: ctx({ feed: { today: 1, usual: 4, daysLogged: 5 } }) })).toEqual([]);
  });

  test('forecast: anything to act on before the next milking', () => {
    const tips = adviceFor({ context: ctx({ feed: { today: 1, usual: 4, daysLogged: 5 }, flags: { sick: true } }) });
    expect(codes(tips)).toEqual(['health_recovery', 'feed_drop']);
    expect(adviceFor({ context: ctx() })).toEqual([]);
  });

  test('tolerates a bare context', () => {
    expect(codes(adviceFor({ status: 'low' }))).toEqual(['check_udder']);
    expect(adviceFor()).toEqual([]);
  });
});

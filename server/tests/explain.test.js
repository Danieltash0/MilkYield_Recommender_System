const { buildFacts, templateText, numbersAreGrounded, explain } = require('../services/explain');

const facts = (overrides = {}) =>
  buildFacts(
    { expected: 10.5, actual: 7.2, ratio: 0.686, status: 'low', reason: null, method: 'moving_average', historyUsed: 7, ...overrides },
    'Bessie'
  );

const llmReply = (content, ok = true) =>
  jest.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => ({ choices: [{ message: { content } }] }) }));

const ENV = ['LLM_API_KEY', 'LLM_MODEL', 'LLM_API_URL'];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  ENV.forEach((k) => delete process.env[k]);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  ENV.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  jest.restoreAllMocks();
});

describe('templateText', () => {
  test('low', () => {
    const text = templateText(facts());
    expect(text).toMatch(/^Bessie gave 7\.2 L, about 31% below the expected 10\.5 L\./);
    expect(text).toMatch(/Check feed, water and udder health/); // no tips given: the fallback
    expect(text).toMatch(/average of the last 7 sessions/);
  });

  test('high', () => {
    expect(templateText(facts({ actual: 13, ratio: 1.238, status: 'high' }))).toMatch(/about 24% above the expected 10\.5 L/);
  });

  test('suppressed names the reason', () => {
    const text = templateText(facts({ status: 'suppressed', reason: 'under treatment' }));
    expect(text).toMatch(/No alert was raised/);
    expect(text).toMatch(/under treatment/);
  });

  test('normal, and the basis follows the method', () => {
    const text = templateText(facts({ actual: 10.4, ratio: 0.99, status: 'normal', method: 'breed_baseline', historyUsed: 0 }));
    expect(text).toMatch(/in line with the expected 10\.5 L/);
    expect(text).toMatch(/breed average/);
  });

  test('a knowledge-graph basis names the adjustments, without adding numbers', () => {
    const adjustments = [{ label: 'first lactation' }, { label: 'peak lactation' }, { label: 'extra concentrate fed' }];
    const f = facts({ method: 'knowledge_graph', historyUsed: 0, adjustments });
    const text = templateText(f);
    expect(text).toMatch(/breed average adjusted for first lactation, peak lactation and extra concentrate fed \(not enough history yet\)/);
    expect(numbersAreGrounded(text, f)).toBe(true);
    expect(templateText(facts({ method: 'knowledge_graph', adjustments: [{ label: 'late pregnancy' }] })))
      .toMatch(/adjusted for late pregnancy \(/);
  });

  test('shows the normal range and the advisory tips', () => {
    const f = facts({
      range: { low: 8.4, high: 12.6 },
      advice: [
        { code: 'feed_drop', text: 'Concentrate was cut to 1.5 kg from her usual 4 kg; restore the usual ration.', numbers: [1.5, 4] },
        { code: 'check_udder', text: 'Also check her water supply and udder for signs of mastitis.', numbers: [] }
      ]
    });
    const text = templateText(f);
    expect(text).toMatch(/below the expected 10\.5 L \(normal range 8\.4–12\.6 L\)\. Concentrate was cut to 1\.5 kg/);
    expect(text).toMatch(/mastitis\. Expected yield is based on/);
    expect(text).not.toMatch(/Check feed, water/);
    expect(numbersAreGrounded(text, f)).toBe(true);
    expect(numbersAreGrounded('Feed was cut to 1.5 kg from 4 kg; she gave 7.2 L, range 8.4 to 12.6 L.', f)).toBe(true);
    expect(numbersAreGrounded('Feed was cut to 2 kg.', f)).toBe(false);
  });

  test('suppressed notes add the recovery tip after the reason', () => {
    const f = facts({
      status: 'suppressed', reason: 'illness or injury recorded recently', range: { low: 8.4, high: 12.6 },
      advice: [{ code: 'health_recovery', text: "Follow the vet's treatment plan.", numbers: [] }]
    });
    expect(templateText(f)).toMatch(/\(illness or injury recorded recently\)\. Follow the vet's treatment plan\. Expected/);
  });

  test('every template is grounded in its own facts', () => {
    ['low', 'high', 'suppressed', 'normal'].forEach((status) => {
      const f = facts({ status, reason: status === 'suppressed' ? 'recently calved' : null });
      expect(numbersAreGrounded(templateText(f), f)).toBe(true);
    });
  });
});

describe('numbersAreGrounded', () => {
  test('accepts numbers the engine supplied, allowing rounding', () => {
    expect(numbersAreGrounded('Bessie gave 7.2 L, 31% under 10.5 L over 7 sessions.', facts())).toBe(true);
    expect(numbersAreGrounded('About 10.47 L was expected.', facts())).toBe(true);
  });

  test('rejects any number the engine did not supply', () => {
    expect(numbersAreGrounded('Bessie gave 7.2 L; expect 9 L tomorrow.', facts())).toBe(false);
    expect(numbersAreGrounded('Give her 2 kg more concentrate.', facts())).toBe(false);
  });

  test('ignores digits in the cow name', () => {
    const f = buildFacts({ expected: 10, actual: 7, ratio: 0.7, status: 'low', method: 'moving_average', historyUsed: 7 }, 'Tag CT004');
    expect(numbersAreGrounded('Tag CT004 gave 7 L against 10 L.', f)).toBe(true);
  });
});

describe('explain', () => {
  test('without an API key it makes no network call', async () => {
    const fetchImpl = jest.fn();
    process.env.LLM_MODEL = 'some-model';
    expect(await explain(facts(), { fetchImpl })).toBe(templateText(facts()));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('uses grounded LLM text', async () => {
    process.env.LLM_API_KEY = 'k';
    process.env.LLM_MODEL = 'm';
    process.env.LLM_API_URL = 'https://llm.example/v1/';
    const fetchImpl = llmReply('Bessie gave 7.2 L, about 31% under the usual 10.5 L. Keep an eye on her.');
    expect(await explain(facts(), { fetchImpl })).toBe('Bessie gave 7.2 L, about 31% under the usual 10.5 L. Keep an eye on her.');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://llm.example/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer k');
    expect(JSON.parse(init.body).model).toBe('m');
  });

  test('rejects ungrounded LLM text', async () => {
    process.env.LLM_API_KEY = 'k';
    process.env.LLM_MODEL = 'm';
    const fetchImpl = llmReply('Bessie dropped to 7.2 L. Expect 12 L once the 3 day course ends.');
    expect(await explain(facts(), { fetchImpl })).toBe(templateText(facts()));
  });

  test.each([
    ['an HTTP error', llmReply('ok', false)],
    ['a network error', jest.fn(async () => { throw new Error('ECONNREFUSED'); })],
    ['an empty reply', llmReply('   ')]
  ])('falls back to the template on %s', async (_, fetchImpl) => {
    process.env.LLM_API_KEY = 'k';
    process.env.LLM_MODEL = 'm';
    expect(await explain(facts(), { fetchImpl })).toBe(templateText(facts()));
  });
});

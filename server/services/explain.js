// Plain-language note for a yield judgement. The template always works; an
// OpenAI-compatible LLM can reword it when LLM_API_KEY and LLM_MODEL are set,
// but its text is only used if every number in it came from the engine.
const TIMEOUT_MS = 8000;

const BASIS = {
  neural_net: 'the neural network model',
  linear_regression: 'the linear regression model',
  moving_average: 'the average of recent sessions',
  knowledge_graph: "the breed average adjusted for the cow's profile (not enough history yet)",
  breed_baseline: 'the breed average (not enough history yet)'
};

// "a", "a and b", "a, b and c"
const listText = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

const fmt = (n) => String(Math.round(n * 100) / 100);

// The numbers a note may mention, derived from a recommend() result
const buildFacts = (result, cowName) => ({
  cowName: cowName || 'This cow',
  status: result.status,
  reason: result.reason,
  method: result.method,
  expected: result.expected,
  actual: result.actual,
  historyUsed: result.historyUsed,
  // Labels of the knowledge-graph factors used; they carry no numbers
  adjustments: (result.adjustments || []).map((a) => a.label),
  percent: result.ratio === null || result.ratio === undefined ? null : Math.round(Math.abs(1 - result.ratio) * 100)
});

const basisText = (f) => {
  if (f.method === 'moving_average') return `the average of the last ${f.historyUsed} sessions`;
  if (f.method === 'knowledge_graph' && f.adjustments && f.adjustments.length) {
    return `the breed average adjusted for ${listText(f.adjustments)} (not enough history yet)`;
  }
  return BASIS[f.method] || 'recent records';
};

const templateText = (f) => {
  const name = f.cowName;
  const basis = `Expected yield is based on ${basisText(f)}.`;
  switch (f.status) {
    case 'low':
      return `${name} gave ${fmt(f.actual)} L, about ${f.percent}% below the expected ${fmt(f.expected)} L. ` +
        `Check feed, water and udder health, and watch the next session. ${basis}`;
    case 'high':
      return `${name} gave ${fmt(f.actual)} L, about ${f.percent}% above the expected ${fmt(f.expected)} L. ` +
        `Check that the reading was entered correctly. ${basis}`;
    case 'suppressed':
      return `${name} gave ${fmt(f.actual)} L against an expected ${fmt(f.expected)} L. ` +
        `No alert was raised because of the cow's condition (${f.reason}). ${basis}`;
    default:
      return `${name} gave ${fmt(f.actual)} L, in line with the expected ${fmt(f.expected)} L. ${basis}`;
  }
};

// True when every number in `text` is one the engine supplied (to 0.05)
const numbersAreGrounded = (text, f) => {
  const allowed = [f.expected, f.actual, f.historyUsed, f.percent]
    .filter((n) => typeof n === 'number' && Number.isFinite(n));
  // The cow's name or tag may contain digits of its own
  const body = f.cowName ? String(text).split(f.cowName).join(' ') : String(text);
  const found = body.match(/\d+(?:\.\d+)?/g) || [];
  return found.every((s) => allowed.some((n) => Math.abs(Number(s) - n) <= 0.05));
};

const llmConfigured = () => Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL);

const askLlm = async (f, template, fetchImpl) => {
  const base = (process.env.LLM_API_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        temperature: 0.2,
        max_tokens: 120,
        messages: [
          {
            role: 'system',
            content:
              'You rewrite milk yield notes for dairy farm workers. Reply with at most two short, plain sentences. ' +
              'Use only the numbers in the note. Do not add numbers, diagnoses or advice that is not in the note.'
          },
          { role: 'user', content: template }
        ]
      })
    });
    if (!res.ok) throw new Error(`LLM API returned ${res.status}`);
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content || '').trim();
  } finally {
    clearTimeout(timer);
  }
};

// Returns the note text. Never throws: any LLM problem gives the template.
const explain = async (f, { fetchImpl = global.fetch } = {}) => {
  const template = templateText(f);
  if (!llmConfigured() || !fetchImpl) return template;
  try {
    const text = await askLlm(f, template, fetchImpl);
    if (!text || !numbersAreGrounded(text, f)) return template;
    return text;
  } catch (err) {
    console.warn(`Recommender: LLM explanation skipped (${err.message}).`);
    return template;
  }
};

module.exports = { buildFacts, templateText, numbersAreGrounded, llmConfigured, explain };

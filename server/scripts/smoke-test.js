// End-to-end check of the recommender without a database or HTTP server:
// features -> each prediction tier -> explanation -> training export, using the
// real ONNX files in server/ml/models (or MODELS_DIR).
// Run with:  npm run smoke   (from server/). Exits 1 on any failure.
const fs = require('fs');
const path = require('path');
const { buildContext, pickBaseline, baselinePerSession } = require('../services/features');
const { recommend } = require('../services/recommender');
const { estimate } = require('../services/knowledgeGraph');
const nnModel = require('../services/nnModel');
const { buildFacts, templateText, numbersAreGrounded } = require('../services/explain');
const { buildExportRows, toCsv } = require('../scripts/exportTrainingData');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failures++;
};

const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const cow = {
  cattle_id: 1, category: 'Cow', name: 'Smoke', breed: 'Holstein-Friesian', date_of_birth: '2021-04-02',
  last_calving_date: '2026-07-01', parity: 2, conception_date: null, prev_lactation_yield_l: 5600
};
const baselines = [{ breed: 'Holstein-Friesian', avg_daily_yield: 18 }, { breed: 'Other', avg_daily_yield: 10 }];
const start = '2026-10-01';
const history = [];
for (let d = 0; d < 7; d++) {
  history.push({ milking_date: addDays(start, d), session: 'Morning', quantity: 11 + (d % 3) * 0.2 });
  history.push({ milking_date: addDays(start, d), session: 'Evening', quantity: 9 + (d % 2) * 0.3 });
}
const asOf = addDays(start, 7);
const feedByDate = new Map([[asOf, 5]]);
const context = buildContext({ cow, asOf, feedByDate, healthEvents: [] });
const baseline = baselinePerSession(pickBaseline(cow.breed, baselines));

(async () => {
  check('breed baseline per session', baseline === 9, `${baseline} L`);

  const ma = await recommend({ history, context, baseline, actual: 7 }, { predictor: 'ma' });
  check('moving average tier', ma.method === 'moving_average' && ma.historyUsed === 7, `${ma.expected} L`);
  check('low reading flagged', ma.status === 'low', `ratio ${ma.ratio}`);

  const cold = await recommend({ history: [], context, baseline, actual: 9 }, { predictor: 'ma' });
  check('cold start tier', cold.method === 'breed_baseline' && cold.status === 'normal', `${cold.expected} L`);

  // Smoke is in its 2nd lactation, 98 days in milk, fed 5 kg on asOf
  const factors = [
    { factor_key: 'stage_peak', attribute: 'days_in_milk', min_value: 45, max_value: 100, multiplier: 1.23, label: 'peak lactation' },
    { factor_key: 'parity_second', attribute: 'parity', min_value: 2, max_value: 3, multiplier: 0.93, label: 'second lactation' },
    { factor_key: 'feed_very_high', attribute: 'concentrate_kg', min_value: 5, max_value: null, multiplier: 1.2, label: 'heavy concentrate feeding' }
  ];
  const knowledge = estimate({ cowLabel: cow.name, breed: cow.breed, baselineRow: pickBaseline(cow.breed, baselines), context, factors });
  const kg = await recommend({ history: [], context, baseline, knowledge, actual: 9 }, { predictor: 'ma' });
  check('knowledge graph tier', kg.method === 'knowledge_graph' && kg.adjustments.length === 3,
    `${kg.expected} L from ${knowledge.path.length} graph edges`);
  check('knowledge graph explanation names the factors', /adjusted for heavy concentrate feeding, peak lactation and second lactation/.test(
    templateText(buildFacts(kg, cow.name))));

  const sick = buildContext({ cow, asOf, healthEvents: [{ record_type: 'Illness', record_date: addDays(asOf, -2) }] });
  const suppressed = await recommend({ history, context: sick, baseline, actual: 5 }, { predictor: 'ma' });
  check('illness suppresses the alert', suppressed.status === 'suppressed', suppressed.reason);

  const meta = nnModel.getMeta();
  if (!meta) {
    check(`model files in ${nnModel.modelsDir()}`, false, 'model_meta.json missing');
  } else {
    console.log(`     models: ${meta.features.length} features, data_source=${meta.data_source}, best=${meta.best}`);
    for (const name of ['lr', 'nn']) {
      check(`${name} model loads`, nnModel.isAvailable(name));
      const r = await recommend({ history, context, baseline, actual: 10 }, { predictor: name });
      check(`${name} tier answers`, r.method !== 'breed_baseline' && r.expected > 0, `${r.method} ${r.expected} L`);
    }
    const auto = await recommend({ history, context, baseline }, { predictor: 'auto' });
    check('auto tier answers', auto.expected > 0, `${auto.method} ${auto.expected} L`);

    const samplePath = path.join(nnModel.modelsDir(), 'sample_input.json');
    if (fs.existsSync(samplePath)) {
      const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
      for (const c of sample.cases) {
        for (const name of ['nn', 'lr']) {
          const out = await nnModel.predict(name, c.input);
          check(`${name} matches Python on sample`, Math.abs(out - c[name]) < 1e-3, `${out.toFixed(4)} vs ${c[name].toFixed(4)}`);
        }
      }
    }
  }

  const facts = buildFacts(ma, cow.name);
  const note = templateText(facts);
  check('explanation is grounded', numbersAreGrounded(note, facts), note);

  const records = history.map((r) => ({ ...r, cattle_id: cow.cattle_id }));
  const rows = buildExportRows({ cows: [cow], records, feed: [], health: [], baselines });
  check('training export', rows.length === history.length && toCsv(rows).split('\n')[0].startsWith('cow_id,date'), `${rows.length} rows`);

  console.log(failures ? `\n${failures} check(s) failed.` : '\nSmoke test passed.');
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});

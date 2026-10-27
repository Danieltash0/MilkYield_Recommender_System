// Judges existing milking records so the yield charts have history: records
// loaded by seed.sql or saved before the recommender existed have no
// prediction. Each record is judged against the sessions before it, exactly as
// if it had just been saved, with the current PREDICTOR setting.
// Safe to re-run: a record's judgement is replaced, never duplicated.
//
// Run from server/:  npm run backfill:predictions            (every record)
//                    npm run backfill:predictions -- --days 30
const MilkingRecord = require('../models/MilkingRecord');
const yieldService = require('../services/yieldService');
const { sortRecords } = require('../services/features');

const daysArg = () => {
  const i = process.argv.indexOf('--days');
  if (i === -1) return null;
  const n = parseInt(process.argv[i + 1], 10);
  if (!Number.isInteger(n) || n < 1) throw new Error('--days needs a positive whole number');
  return n;
};

const main = async () => {
  const db = require('../utils/database');
  // Rewording thousands of notes through an LLM is slow and costs money; the
  // template notes are enough here
  delete process.env.LLM_API_KEY;

  try {
    const days = daysArg();
    let from = null;
    if (days) {
      // Local date, like yieldService.localToday (toISOString would give UTC)
      const d = new Date();
      d.setDate(d.getDate() - (days - 1));
      const pad = (n) => String(n).padStart(2, '0');
      from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    const records = sortRecords(await MilkingRecord.getRecords({ from, limit: 1000000 }));
    console.log(`Judging ${records.length} milking record(s)${days ? ` from the last ${days} days` : ''} (PREDICTOR=${process.env.PREDICTOR || 'ma'})...`);

    const counts = { judged: 0, skipped: 0, failed: 0 };
    const byMethod = {};
    const byStatus = {};
    for (const rec of records) {
      try {
        const r = await yieldService.evaluateRecord(rec);
        if (!r) {
          counts.skipped++; // not a cow, or nothing to compare against
          continue;
        }
        counts.judged++;
        byMethod[r.method] = (byMethod[r.method] || 0) + 1;
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      } catch (err) {
        counts.failed++;
        console.warn(`  record ${rec.record_id}: ${err.message}`);
      }
    }

    console.log(`Judged ${counts.judged}, skipped ${counts.skipped} (not cows or no baseline), failed ${counts.failed}.`);
    console.log('By method:', byMethod);
    console.log('By status:', byStatus);
    if (counts.failed) process.exitCode = 1;
  } finally {
    await db.end();
  }
};

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});

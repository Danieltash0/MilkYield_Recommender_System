const db = require('../utils/database');

// Cold-start yields per breed, litres per day
exports.getAll = async () => {
  const [rows] = await db.execute('SELECT baseline_id, breed, avg_daily_yield, source FROM breed_yield_baselines ORDER BY breed');
  return rows.map((r) => ({ ...r, avg_daily_yield: Number(r.avg_daily_yield) }));
};

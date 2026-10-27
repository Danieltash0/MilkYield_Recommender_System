const db = require('../utils/database');

const numberOrNull = (v) => (v === null || v === undefined ? null : Number(v));

// Edges of the cold-start knowledge graph: a condition on a cow and the yield
// multiplier it implies
exports.getActive = async () => {
  const [rows] = await db.execute(
    `SELECT factor_id, factor_key, attribute, min_value, max_value, multiplier, label, source
     FROM yield_factors WHERE active = 1 ORDER BY attribute, min_value`
  );
  return rows.map((r) => ({
    ...r,
    min_value: numberOrNull(r.min_value),
    max_value: numberOrNull(r.max_value),
    multiplier: Number(r.multiplier)
  }));
};

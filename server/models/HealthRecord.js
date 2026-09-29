const db = require('../utils/database');

const SELECT = `
  SELECT h.record_id, h.cattle_id, h.vet_id, h.record_date, h.record_type, h.diagnosis, h.treatment,
         h.medication, h.health_status, h.next_checkup, h.notes, h.created_at,
         c.name AS cattle_name, c.tag_number AS cattle_tag, u.name AS vet_name
  FROM health_records h
  JOIN cattle c ON c.cattle_id = h.cattle_id
  LEFT JOIN users u ON u.user_id = h.vet_id`;

const FIELDS = ['cattle_id', 'record_date', 'record_type', 'diagnosis', 'treatment', 'medication', 'health_status', 'next_checkup', 'notes'];
const values = (r) => FIELDS.map((f) => (r[f] === undefined || r[f] === '' ? null : r[f]));

exports.getRecords = async ({ cattleId, type } = {}) => {
  const where = [];
  const params = [];
  if (cattleId) {
    where.push('h.cattle_id = ?');
    params.push(cattleId);
  }
  if (type) {
    where.push('h.record_type = ?');
    params.push(type);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await db.execute(`${SELECT} ${clause} ORDER BY h.record_date DESC, h.record_id DESC LIMIT 500`, params);
  return rows;
};

exports.getRecordById = async (id) => {
  const [rows] = await db.execute(`${SELECT} WHERE h.record_id = ?`, [id]);
  return rows[0];
};

exports.createRecord = async (r, vetId) => {
  const [result] = await db.execute(
    `INSERT INTO health_records (${FIELDS.join(', ')}, vet_id) VALUES (${FIELDS.map(() => '?').join(', ')}, ?)`,
    [...values(r), vetId]
  );
  return result.insertId;
};

exports.updateRecord = async (id, r) => {
  const [result] = await db.execute(
    `UPDATE health_records SET ${FIELDS.map((f) => `${f}=?`).join(', ')} WHERE record_id=?`,
    [...values(r), id]
  );
  return result.affectedRows;
};

exports.deleteRecord = async (id) => {
  const [result] = await db.execute('DELETE FROM health_records WHERE record_id = ?', [id]);
  return result.affectedRows;
};

// Copies the status from the cow's most recent assessed record onto the cattle
// row, so the herd list and dashboards reflect the latest vet assessment.
// Leaves the cow untouched when none of its records carry a status.
exports.syncCattleHealth = async (cattleId) => {
  await db.execute(
    `UPDATE cattle c
     JOIN (SELECT health_status FROM health_records
           WHERE cattle_id = ? AND health_status IS NOT NULL
           ORDER BY record_date DESC, record_id DESC LIMIT 1) latest
     SET c.health = latest.health_status
     WHERE c.cattle_id = ?`,
    [cattleId, cattleId]
  );
};

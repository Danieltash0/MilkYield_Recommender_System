const db = require('../utils/database');

// Males are always Bull; Calf/Heifer/Cow are the female categories
const categoryFor = (c) => ((c.gender || 'Female') === 'Male' ? 'Bull' : c.category || 'Cow');

// Lactation details used by the yield recommender. NULL = not recorded.
const LACTATION = ['last_calving_date', 'parity', 'conception_date', 'prev_lactation_yield_l'];
const lactationValue = (v) => (v === undefined || v === '' ? null : v);

const COLUMNS =
  'cattle_id, tag_number, name, breed, health, gender, category, date_of_birth, ' +
  'last_calving_date, parity, conception_date, prev_lactation_yield_l, notes, added_by, created_at';

// mysql2 returns DECIMAL columns as strings
const toNumbers = (r) =>
  r && { ...r, prev_lactation_yield_l: r.prev_lactation_yield_l === null ? null : Number(r.prev_lactation_yield_l) };

exports.createCattle = async (c, addedBy) => {
  const tagNumber = c.tag_number || `CT${Date.now()}`;
  const [result] = await db.execute(
    `INSERT INTO cattle (tag_number, name, breed, health, gender, category, date_of_birth, ${LACTATION.join(', ')}, notes, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tagNumber,
      c.name || null,
      c.breed || null,
      c.health || 'Good',
      c.gender || 'Female',
      categoryFor(c),
      c.date_of_birth || null,
      ...LACTATION.map((f) => lactationValue(c[f])),
      c.notes || null,
      addedBy || null
    ]
  );
  return result.insertId;
};

exports.getAllCattle = async () => {
  const [rows] = await db.execute(`SELECT ${COLUMNS} FROM cattle ORDER BY created_at DESC`);
  return rows.map(toNumbers);
};

exports.getCattleById = async (id) => {
  const [rows] = await db.execute(`SELECT ${COLUMNS} FROM cattle WHERE cattle_id = ?`, [id]);
  return toNumbers(rows[0]);
};

exports.updateCattle = async (id, c) => {
  // Lactation columns are only touched when the request sent them, so an older
  // client that does not know about them never wipes them
  const sent = LACTATION.filter((f) => c[f] !== undefined);
  const [result] = await db.execute(
    `UPDATE cattle SET tag_number=?, name=?, breed=?, health=?, gender=?, category=?, date_of_birth=?,
     ${sent.map((f) => `${f}=?, `).join('')}notes=?
     WHERE cattle_id=?`,
    [
      c.tag_number,
      c.name || null,
      c.breed || null,
      c.health || 'Good',
      c.gender || 'Female',
      categoryFor(c),
      c.date_of_birth || null,
      ...sent.map((f) => lactationValue(c[f])),
      c.notes || null,
      id
    ]
  );
  return result.affectedRows;
};

exports.deleteCattle = async (id) => {
  const [result] = await db.execute('DELETE FROM cattle WHERE cattle_id = ?', [id]);
  return result.affectedRows;
};

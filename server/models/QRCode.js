const crypto = require('crypto');
const db = require('../utils/database');

const SELECT = `
  SELECT q.qr_id, q.cattle_id, q.code, q.created_by, q.scan_count, q.last_scanned_at, q.created_at,
         c.name AS cattle_name, c.tag_number AS cattle_tag, c.breed AS cattle_breed
  FROM qr_codes q
  JOIN cattle c ON c.cattle_id = q.cattle_id`;

// 12 URL-safe characters (72 bits of randomness)
const newCode = () => crypto.randomBytes(9).toString('base64url');

exports.getAll = async () => {
  const [rows] = await db.execute(`${SELECT} ORDER BY c.tag_number`);
  return rows;
};

exports.getByCattleId = async (cattleId) => {
  const [rows] = await db.execute(`${SELECT} WHERE q.cattle_id = ?`, [cattleId]);
  return rows[0];
};

exports.getByCode = async (code) => {
  const [rows] = await db.execute(`${SELECT} WHERE q.code = ?`, [code]);
  return rows[0];
};

// Creates the code if the animal has none; returns true when one was created
exports.ensure = async (cattleId, userId) => {
  const [result] = await db.execute(
    'INSERT IGNORE INTO qr_codes (cattle_id, code, created_by) VALUES (?, ?, ?)',
    [cattleId, newCode(), userId]
  );
  return result.affectedRows > 0;
};

// Codes for every animal that has none yet; returns how many were created
exports.ensureAll = async (userId) => {
  const [missing] = await db.execute(
    'SELECT c.cattle_id FROM cattle c LEFT JOIN qr_codes q ON q.cattle_id = c.cattle_id WHERE q.qr_id IS NULL'
  );
  for (const { cattle_id } of missing) await exports.ensure(cattle_id, userId);
  return missing.length;
};

// Replaces the code (old labels stop resolving) and resets the scan stats
exports.regenerate = async (cattleId, userId) => {
  await db.execute(
    `UPDATE qr_codes SET code = ?, created_by = ?, scan_count = 0, last_scanned_at = NULL, created_at = NOW()
     WHERE cattle_id = ?`,
    [newCode(), userId, cattleId]
  );
};

exports.recordScan = async (qrId) => {
  await db.execute('UPDATE qr_codes SET scan_count = scan_count + 1, last_scanned_at = NOW() WHERE qr_id = ?', [qrId]);
};

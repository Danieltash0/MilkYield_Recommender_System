const db = require('../utils/database');

// Every setting the admin panel manages, with its default and validation.
// Unknown keys are rejected, so the table only ever holds these.
exports.DEFINITIONS = {
  farm_name: { label: 'Farm name', default: 'DairyDan Farm', max: 100, required: true },
  farm_location: { label: 'Location', default: '', max: 150 },
  contact_email: { label: 'Contact email', default: '', max: 100, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  contact_phone: { label: 'Contact phone', default: '', max: 30, pattern: /^[+\d][\d\s-]{5,}$/ },
  currency: { label: 'Currency code', default: 'KES', max: 3, pattern: /^[A-Z]{3}$/, required: true },
  milk_price_per_litre: { label: 'Milk price per litre', default: '50', max: 12, pattern: /^\d+(\.\d{1,2})?$/ }
};

// All settings as { key: value }, defaults filled in for keys never saved
exports.getAll = async () => {
  const [rows] = await db.execute('SELECT setting_key, setting_value FROM settings');
  const saved = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  return Object.fromEntries(
    Object.entries(exports.DEFINITIONS).map(([key, def]) => [key, saved[key] ?? def.default])
  );
};

exports.saveMany = async (values, userId) => {
  for (const [key, value] of Object.entries(values)) {
    await db.execute(
      `INSERT INTO settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, value, userId]
    );
  }
};

const db = require('../utils/database');

const SELECT = `
  SELECT r.report_id, r.title, r.report_type, r.date_from, r.date_to, r.generated_by, r.created_at,
         u.name AS generated_by_name
  FROM reports r
  LEFT JOIN users u ON u.user_id = r.generated_by`;

exports.getReports = async () => {
  const [rows] = await db.execute(`${SELECT} ORDER BY r.created_at DESC, r.report_id DESC LIMIT 100`);
  return rows;
};

exports.getReportById = async (id) => {
  const [rows] = await db.execute(`${SELECT} WHERE r.report_id = ?`, [id]);
  return rows[0];
};

exports.createReport = async ({ title, report_type, date_from, date_to }, generatedBy) => {
  const [result] = await db.execute(
    'INSERT INTO reports (title, report_type, date_from, date_to, generated_by) VALUES (?, ?, ?, ?, ?)',
    [title, report_type, date_from, date_to, generatedBy]
  );
  return result.insertId;
};

exports.deleteReport = async (id) => {
  const [result] = await db.execute('DELETE FROM reports WHERE report_id = ?', [id]);
  return result.affectedRows;
};

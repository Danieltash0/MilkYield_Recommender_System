const db = require('../utils/database');

const SELECT = `
  SELECT a.appointment_id, a.cattle_id, a.vet_id, a.scheduled_by, a.appointment_date, a.reason,
         a.status, a.notes, a.created_at,
         c.name AS cattle_name, c.tag_number AS cattle_tag,
         vet.name AS vet_name, scheduler.name AS scheduled_by_name
  FROM health_appointments a
  JOIN cattle c ON c.cattle_id = a.cattle_id
  LEFT JOIN users vet ON vet.user_id = a.vet_id
  LEFT JOIN users scheduler ON scheduler.user_id = a.scheduled_by`;

// Scheduled visits first, soonest first; then past ones, most recent first
const ORDER = `
  ORDER BY a.status <> 'Scheduled',
           CASE WHEN a.status = 'Scheduled' THEN a.appointment_date END,
           a.appointment_date DESC`;

// `now` comes from the server clock so "upcoming" matches the local time users entered
exports.getAppointments = async ({ status, vetId, cattleId, upcomingFrom } = {}) => {
  const where = [];
  const params = [];
  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }
  if (vetId) {
    where.push('a.vet_id = ?');
    params.push(vetId);
  }
  if (cattleId) {
    where.push('a.cattle_id = ?');
    params.push(cattleId);
  }
  if (upcomingFrom) {
    where.push("a.status = 'Scheduled' AND a.appointment_date >= ?");
    params.push(upcomingFrom);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await db.execute(`${SELECT} ${clause} ${ORDER} LIMIT 500`, params);
  return rows;
};

exports.getAppointmentById = async (id) => {
  const [rows] = await db.execute(`${SELECT} WHERE a.appointment_id = ?`, [id]);
  return rows[0];
};

exports.createAppointment = async (a, scheduledBy) => {
  const [result] = await db.execute(
    `INSERT INTO health_appointments (cattle_id, vet_id, scheduled_by, appointment_date, reason, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [a.cattle_id, a.vet_id || null, scheduledBy, a.appointment_date, a.reason, a.notes || null]
  );
  return result.insertId;
};

exports.updateAppointment = async (id, a) => {
  const [result] = await db.execute(
    `UPDATE health_appointments SET cattle_id=?, vet_id=?, appointment_date=?, reason=?, notes=?
     WHERE appointment_id=?`,
    [a.cattle_id, a.vet_id || null, a.appointment_date, a.reason, a.notes || null, id]
  );
  return result.affectedRows;
};

exports.updateStatus = async (id, status) => {
  const [result] = await db.execute('UPDATE health_appointments SET status = ? WHERE appointment_id = ?', [status, id]);
  return result.affectedRows;
};

exports.deleteAppointment = async (id) => {
  const [result] = await db.execute('DELETE FROM health_appointments WHERE appointment_id = ?', [id]);
  return result.affectedRows;
};

// Active vets, for the "assign vet" dropdown and to validate vet_id
exports.getVets = async () => {
  const [rows] = await db.execute(
    "SELECT user_id, name FROM users WHERE role = 'vet' AND status = 'active' ORDER BY name"
  );
  return rows;
};

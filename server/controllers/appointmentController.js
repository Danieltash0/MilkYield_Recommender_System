const Appointment = require('../models/Appointment');
const Cattle = require('../models/Cattle');
const logActivity = require('../utils/logActivity');

const STATUS = ['Scheduled', 'Completed', 'Cancelled'];
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/;

const pad = (n) => String(n).padStart(2, '0');
// Server-local wall-clock time as 'YYYY-MM-DD HH:MM:SS' (DATETIME has no timezone)
const localNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Accepts 'YYYY-MM-DDTHH:MM' (datetime-local input) or 'YYYY-MM-DD HH:MM[:SS]'
const normaliseDateTime = (v) => {
  const m = typeof v === 'string' && v.match(DATETIME_RE);
  if (!m) return null;
  const out = `${m[1]} ${m[2]}${m[3] || ':00'}`;
  return Number.isNaN(Date.parse(out.replace(' ', 'T'))) ? null : out;
};

// Returns an error message, or null when the payload is valid
const validate = async (b, { isNew }) => {
  if (!b.cattle_id) return 'Cattle is required';
  if (!b.reason || !b.reason.trim()) return 'Reason is required';
  if (b.reason.trim().length > 255) return 'Reason must be 255 characters or fewer';
  const when = normaliseDateTime(b.appointment_date);
  if (!when) return 'A valid appointment date and time is required';
  if (isNew && when < localNow().slice(0, 16)) return 'Appointment cannot be in the past';
  if (!(await Cattle.getCattleById(b.cattle_id))) return 'Cattle not found';
  if (b.vet_id) {
    const vets = await Appointment.getVets();
    if (!vets.some((v) => v.user_id === Number(b.vet_id))) return 'Assigned vet must be an active veterinarian';
  }
  return null;
};

const clean = (b) => ({
  cattle_id: Number(b.cattle_id),
  vet_id: b.vet_id ? Number(b.vet_id) : null,
  appointment_date: normaliseDateTime(b.appointment_date),
  reason: b.reason.trim(),
  notes: b.notes
});

exports.getVets = async (req, res) => {
  try {
    res.json(await Appointment.getVets());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load vets' });
  }
};

// ?vet_id=me narrows to the signed-in vet; ?upcoming=1 hides past and closed visits
exports.getAppointments = async (req, res) => {
  try {
    const { status, cattle_id, upcoming } = req.query;
    if (status && !STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const vetId = req.query.vet_id === 'me' ? req.user.userId : req.query.vet_id;
    res.json(
      await Appointment.getAppointments({
        status,
        vetId,
        cattleId: cattle_id,
        upcomingFrom: upcoming ? localNow() : undefined
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load appointments' });
  }
};

exports.getAppointmentById = async (req, res) => {
  try {
    const appt = await Appointment.getAppointmentById(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load appointment' });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const problem = await validate(req.body, { isNew: true });
    if (problem) return res.status(400).json({ error: problem });
    const appt = clean(req.body);
    const id = await Appointment.createAppointment(appt, req.user.userId);
    await logActivity(req, 'appointment_created', `Scheduled "${appt.reason}" for cattle #${appt.cattle_id} on ${appt.appointment_date}`);
    res.status(201).json({ appointment_id: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not schedule appointment' });
  }
};

exports.updateAppointment = async (req, res) => {
  try {
    const problem = await validate(req.body, { isNew: false });
    if (problem) return res.status(400).json({ error: problem });
    const changed = await Appointment.updateAppointment(req.params.id, clean(req.body));
    if (!changed) return res.status(404).json({ error: 'Appointment not found' });
    await logActivity(req, 'appointment_updated', `Updated appointment #${req.params.id}`);
    res.json({ message: 'Appointment updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update appointment' });
  }
};

// Vets may only close visits assigned to them (or not yet assigned)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const appt = await Appointment.getAppointmentById(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    if (req.user.role === 'vet' && appt.vet_id && appt.vet_id !== req.user.userId) {
      return res.status(403).json({ error: 'This appointment is assigned to another vet' });
    }
    await Appointment.updateStatus(appt.appointment_id, status);
    await logActivity(req, 'appointment_status', `Marked appointment "${appt.reason}" as ${status}`);
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update status' });
  }
};

exports.deleteAppointment = async (req, res) => {
  try {
    const removed = await Appointment.deleteAppointment(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Appointment not found' });
    await logActivity(req, 'appointment_deleted', `Deleted appointment #${req.params.id}`);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete appointment' });
  }
};

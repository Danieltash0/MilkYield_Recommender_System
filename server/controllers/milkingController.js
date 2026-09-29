const MilkingRecord = require('../models/MilkingRecord');
const Cattle = require('../models/Cattle');
const logActivity = require('../utils/logActivity');

const SESSIONS = ['Morning', 'Afternoon', 'Evening'];
const MAX_LITRES_PER_SESSION = 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Today's date in the server's local timezone, as YYYY-MM-DD
const localToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const round2 = (n) => Math.round(n * 100) / 100;

// Returns an error message, or null when the payload is valid
const validate = async (b) => {
  if (!b.cattle_id) return 'Cattle is required';
  if (!b.milking_date || !DATE_RE.test(b.milking_date) || Number.isNaN(Date.parse(b.milking_date))) {
    return 'A valid milking date is required';
  }
  if (b.milking_date > localToday()) return 'Milking date cannot be in the future';
  if (!SESSIONS.includes(b.session)) return 'Session must be Morning, Afternoon or Evening';
  const qty = Number(b.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return 'Quantity must be more than 0 litres';
  if (qty > MAX_LITRES_PER_SESSION) return `Quantity cannot exceed ${MAX_LITRES_PER_SESSION} litres in one session`;
  if (b.fat_percentage !== undefined && b.fat_percentage !== null && b.fat_percentage !== '') {
    const fat = Number(b.fat_percentage);
    if (!Number.isFinite(fat) || fat < 0 || fat > 15) return 'Fat percentage must be between 0 and 15';
  }
  const cow = await Cattle.getCattleById(b.cattle_id);
  if (!cow) return 'Cattle not found';
  if (cow.gender !== 'Female') return 'Milk can only be recorded for female cattle';
  return null;
};

const clean = (b) => ({
  cattle_id: Number(b.cattle_id),
  milking_date: b.milking_date,
  session: b.session,
  quantity: round2(Number(b.quantity)),
  fat_percentage: b.fat_percentage === undefined || b.fat_percentage === null || b.fat_percentage === ''
    ? null
    : round2(Number(b.fat_percentage)),
  notes: b.notes
});

const isDuplicate = (err) => err && err.code === 'ER_DUP_ENTRY';
const DUPLICATE_MSG = 'A record for this cow, date and session already exists';

exports.getRecords = async (req, res) => {
  try {
    const { cattle_id, from, to } = req.query;
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });
    }
    res.json(await MilkingRecord.getRecords({ cattleId: cattle_id, from, to }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load milking records' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    const { daily, top } = await MilkingRecord.getSummary(days);
    const total = round2(daily.reduce((sum, d) => sum + d.total, 0));
    const today = daily.find((d) => d.date === localToday());
    res.json({
      days,
      total,
      today: today ? round2(today.total) : 0,
      average_per_day: daily.length ? round2(total / daily.length) : 0,
      daily,
      top
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load milking summary' });
  }
};

// Full history for one cow plus the figures its profile shows
exports.getCattleHistory = async (req, res) => {
  try {
    const cow = await Cattle.getCattleById(req.params.id);
    if (!cow) return res.status(404).json({ error: 'Cattle not found' });
    const records = await MilkingRecord.getRecords({ cattleId: cow.cattle_id });
    const total = records.reduce((sum, r) => sum + r.quantity, 0);
    const last7 = records.slice(0, 7);
    res.json({
      cattle: cow,
      records,
      stats: {
        sessions: records.length,
        total: round2(total),
        average_per_session: records.length ? round2(total / records.length) : 0,
        last7_average: last7.length ? round2(last7.reduce((s, r) => s + r.quantity, 0) / last7.length) : 0,
        best: records.length ? Math.max(...records.map((r) => r.quantity)) : 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load milking history' });
  }
};

exports.getRecordById = async (req, res) => {
  try {
    const record = await MilkingRecord.getRecordById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Milking record not found' });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load milking record' });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const problem = await validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const record = clean(req.body);
    const id = await MilkingRecord.createRecord(record, req.user.userId);
    await logActivity(
      req,
      'milking_recorded',
      `Recorded ${record.quantity} L for cattle #${record.cattle_id} (${record.session}, ${record.milking_date})`
    );
    res.status(201).json({ record_id: id });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: DUPLICATE_MSG });
    console.error(err);
    res.status(500).json({ error: 'Could not save milking record' });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const problem = await validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const changed = await MilkingRecord.updateRecord(req.params.id, clean(req.body));
    if (!changed) return res.status(404).json({ error: 'Milking record not found' });
    await logActivity(req, 'milking_updated', `Updated milking record #${req.params.id}`);
    res.json({ message: 'Milking record updated successfully' });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: DUPLICATE_MSG });
    console.error(err);
    res.status(500).json({ error: 'Could not update milking record' });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const removed = await MilkingRecord.deleteRecord(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Milking record not found' });
    await logActivity(req, 'milking_deleted', `Deleted milking record #${req.params.id}`);
    res.json({ message: 'Milking record deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete milking record' });
  }
};

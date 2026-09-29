const HealthRecord = require('../models/HealthRecord');
const Cattle = require('../models/Cattle');
const logActivity = require('../utils/logActivity');

const TYPES = ['Checkup', 'Treatment', 'Vaccination', 'Illness', 'Injury', 'Other'];
const HEALTH = ['Excellent', 'Good', 'Fair', 'Poor'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validDate = (d) => DATE_RE.test(d) && !Number.isNaN(Date.parse(d));

// Today's date in the server's local timezone, as YYYY-MM-DD
const localToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Returns an error message, or null when the payload is valid
const validate = async (b) => {
  if (!b.cattle_id) return 'Cattle is required';
  if (!b.record_date || !validDate(b.record_date)) return 'A valid record date is required';
  if (b.record_date > localToday()) return 'Record date cannot be in the future';
  if (b.record_type && !TYPES.includes(b.record_type)) return 'Invalid record type';
  if (b.health_status && !HEALTH.includes(b.health_status)) return 'Invalid health status';
  if (b.next_checkup && !validDate(b.next_checkup)) return 'Invalid next checkup date';
  if (b.next_checkup && b.next_checkup < b.record_date) return 'Next checkup must be after the record date';
  if (!b.diagnosis && !b.treatment && !b.notes) return 'Add a diagnosis, treatment or notes';
  if (b.diagnosis && b.diagnosis.length > 255) return 'Diagnosis must be 255 characters or fewer';
  if (b.medication && b.medication.length > 255) return 'Medication must be 255 characters or fewer';
  if (!(await Cattle.getCattleById(b.cattle_id))) return 'Cattle not found';
  return null;
};

exports.getRecords = async (req, res) => {
  try {
    const { cattle_id, type } = req.query;
    if (type && !TYPES.includes(type)) return res.status(400).json({ error: 'Invalid record type' });
    res.json(await HealthRecord.getRecords({ cattleId: cattle_id, type }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load health records' });
  }
};

exports.getRecordById = async (req, res) => {
  try {
    const record = await HealthRecord.getRecordById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Health record not found' });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load health record' });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const problem = await validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const id = await HealthRecord.createRecord({ ...req.body, record_type: req.body.record_type || 'Checkup' }, req.user.userId);
    await HealthRecord.syncCattleHealth(req.body.cattle_id);
    await logActivity(req, 'health_record_created', `Added ${req.body.record_type || 'Checkup'} record for cattle #${req.body.cattle_id}`);
    res.status(201).json({ record_id: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save health record' });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const existing = await HealthRecord.getRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Health record not found' });
    const problem = await validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    await HealthRecord.updateRecord(existing.record_id, { ...req.body, record_type: req.body.record_type || 'Checkup' });
    // The record may have moved to another cow, so refresh both
    await HealthRecord.syncCattleHealth(existing.cattle_id);
    if (Number(req.body.cattle_id) !== existing.cattle_id) await HealthRecord.syncCattleHealth(req.body.cattle_id);
    await logActivity(req, 'health_record_updated', `Updated health record #${existing.record_id}`);
    res.json({ message: 'Health record updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update health record' });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const existing = await HealthRecord.getRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Health record not found' });
    await HealthRecord.deleteRecord(existing.record_id);
    await HealthRecord.syncCattleHealth(existing.cattle_id);
    await logActivity(req, 'health_record_deleted', `Deleted health record #${existing.record_id}`);
    res.json({ message: 'Health record deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete health record' });
  }
};

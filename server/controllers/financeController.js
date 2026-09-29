const FinancialRecord = require('../models/FinancialRecord');
const logActivity = require('../utils/logActivity');

const CATEGORIES = {
  Income: ['Milk sales', 'Cattle sales', 'Manure sales', 'Other income'],
  Expense: ['Feed', 'Veterinary', 'Labour', 'Equipment', 'Utilities', 'Breeding', 'Transport', 'Other expense']
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 100000000;

const validDate = (d) => DATE_RE.test(d) && !Number.isNaN(Date.parse(d));

// Returns an error message, or null when the payload is valid
const validate = (b) => {
  if (!CATEGORIES[b.record_type]) return 'Type must be Income or Expense';
  if (!CATEGORIES[b.record_type].includes(b.category)) return `Invalid ${b.record_type.toLowerCase()} category`;
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be more than 0';
  if (amount >= MAX_AMOUNT) return 'Amount is too large';
  if (!b.record_date || !validDate(b.record_date)) return 'A valid date is required';
  if (b.description && b.description.length > 255) return 'Description must be 255 characters or fewer';
  return null;
};

const clean = (b) => ({
  record_type: b.record_type,
  category: b.category,
  amount: Math.round(Number(b.amount) * 100) / 100,
  record_date: b.record_date,
  description: b.description ? b.description.trim() : null,
  cattle_id: b.cattle_id ? Number(b.cattle_id) : null
});

// Returns an error message for bad ?from / ?to, or null
const checkRange = ({ from, to }) => {
  if ((from && !validDate(from)) || (to && !validDate(to))) return 'Dates must be YYYY-MM-DD';
  if (from && to && from > to) return 'Start date must be before end date';
  return null;
};

const isBadReference = (err) => err && err.code === 'ER_NO_REFERENCED_ROW_2';

exports.getCategories = (req, res) => res.json(CATEGORIES);

exports.getRecords = async (req, res) => {
  try {
    const { type, category, from, to } = req.query;
    if (type && !CATEGORIES[type]) return res.status(400).json({ error: 'Invalid type' });
    const problem = checkRange(req.query);
    if (problem) return res.status(400).json({ error: problem });
    res.json(await FinancialRecord.getRecords({ type, category, from, to }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load financial records' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const problem = checkRange(req.query);
    if (problem) return res.status(400).json({ error: problem });
    res.json(await FinancialRecord.getSummary({ from: req.query.from, to: req.query.to }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load financial summary' });
  }
};

exports.getRecordById = async (req, res) => {
  try {
    const record = await FinancialRecord.getRecordById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Financial record not found' });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load financial record' });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const problem = validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const record = clean(req.body);
    const id = await FinancialRecord.createRecord(record, req.user.userId);
    await logActivity(req, 'finance_created', `Recorded ${record.record_type.toLowerCase()} of ${record.amount} (${record.category})`);
    res.status(201).json({ record_id: id });
  } catch (err) {
    if (isBadReference(err)) return res.status(400).json({ error: 'Cattle does not exist' });
    console.error(err);
    res.status(500).json({ error: 'Could not save financial record' });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const problem = validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const changed = await FinancialRecord.updateRecord(req.params.id, clean(req.body));
    if (!changed) return res.status(404).json({ error: 'Financial record not found' });
    await logActivity(req, 'finance_updated', `Updated financial record #${req.params.id}`);
    res.json({ message: 'Financial record updated successfully' });
  } catch (err) {
    if (isBadReference(err)) return res.status(400).json({ error: 'Cattle does not exist' });
    console.error(err);
    res.status(500).json({ error: 'Could not update financial record' });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const removed = await FinancialRecord.deleteRecord(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Financial record not found' });
    await logActivity(req, 'finance_deleted', `Deleted financial record #${req.params.id}`);
    res.json({ message: 'Financial record deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete financial record' });
  }
};

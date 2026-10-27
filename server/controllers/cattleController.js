const Cattle = require('../models/Cattle');

const HEALTH = ['Excellent', 'Good', 'Fair', 'Poor'];
const GENDER = ['Female', 'Male'];
const CATEGORY = ['Calf', 'Heifer', 'Cow', 'Bull'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LACTATION_DATES = { last_calving_date: 'Last calving date', conception_date: 'Conception date' };
const blank = (v) => v === undefined || v === null || v === '';

// Today's date in the server's local timezone, as YYYY-MM-DD
const localToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Lactation details are optional; blank means not recorded
const validateLactation = (b) => {
  for (const [field, label] of Object.entries(LACTATION_DATES)) {
    const d = b[field];
    if (blank(d)) continue;
    if (!DATE_RE.test(d) || Number.isNaN(Date.parse(d))) return `${label} must be a valid date`;
    if (d > localToday()) return `${label} cannot be in the future`;
    if (b.date_of_birth && d < String(b.date_of_birth).slice(0, 10)) return `${label} cannot be before the date of birth`;
  }
  if (!blank(b.parity)) {
    const parity = Number(b.parity);
    if (!Number.isInteger(parity) || parity < 0 || parity > 20) return 'Parity must be a whole number from 0 to 20';
  }
  if (!blank(b.prev_lactation_yield_l)) {
    const litres = Number(b.prev_lactation_yield_l);
    if (!Number.isFinite(litres) || litres < 0 || litres > 20000) return 'Previous lactation yield must be between 0 and 20000 litres';
  }
  return null;
};

// Returns an error message, or null when the payload is valid
const validate = (b) => {
  if (b.health && !HEALTH.includes(b.health)) return 'Invalid health status';
  if (b.gender && !GENDER.includes(b.gender)) return 'Invalid gender';
  if (b.category && !CATEGORY.includes(b.category)) return 'Category must be Calf, Heifer, Cow or Bull';
  if (b.category === 'Bull' && b.gender !== 'Male') return 'Only male cattle can be a Bull';
  if (b.date_of_birth && Number.isNaN(Date.parse(b.date_of_birth))) return 'Invalid date of birth';
  if (b.date_of_birth && new Date(b.date_of_birth) > new Date()) return 'Date of birth cannot be in the future';
  return validateLactation(b);
};

const isDuplicate = (err) => err && err.code === 'ER_DUP_ENTRY';

exports.createCattle = async (req, res) => {
  try {
    const problem = validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const id = await Cattle.createCattle(req.body, req.user.userId);
    res.status(201).json({ cattle_id: id });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: 'That tag number is already in use' });
    console.error(err);
    res.status(500).json({ error: 'Could not add cattle' });
  }
};

exports.getAllCattle = async (req, res) => {
  try {
    res.json(await Cattle.getAllCattle());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load cattle' });
  }
};

exports.getCattleById = async (req, res) => {
  try {
    const cattle = await Cattle.getCattleById(req.params.id);
    if (!cattle) return res.status(404).json({ error: 'Cattle not found' });
    res.json(cattle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load cattle' });
  }
};

exports.updateCattle = async (req, res) => {
  try {
    if (!req.body.tag_number) return res.status(400).json({ error: 'Tag number is required' });
    const problem = validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const changed = await Cattle.updateCattle(req.params.id, req.body);
    if (!changed) return res.status(404).json({ error: 'Cattle not found' });
    res.json({ message: 'Cattle updated successfully' });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: 'That tag number is already in use' });
    console.error(err);
    res.status(500).json({ error: 'Could not update cattle' });
  }
};

exports.deleteCattle = async (req, res) => {
  try {
    const removed = await Cattle.deleteCattle(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Cattle not found' });
    res.json({ message: 'Cattle deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete cattle' });
  }
};

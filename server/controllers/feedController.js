const FeedRecord = require('../models/FeedRecord');
const logActivity = require('../utils/logActivity');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CONCENTRATE_KG = 30;
const MAX_FORAGE_KG = 150;

const validDate = (d) => DATE_RE.test(d) && !Number.isNaN(Date.parse(d));
const blank = (v) => v === undefined || v === null || v === '';

// Today's date in the server's local timezone, as YYYY-MM-DD
const localToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const round2 = (n) => Math.round(n * 100) / 100;

// Returns an error message, or null when the payload is valid
const validate = (b) => {
  if (!b.cattle_id) return 'Cattle is required';
  if (!b.fed_on || !validDate(b.fed_on)) return 'A valid feeding date is required';
  if (b.fed_on > localToday()) return 'Feeding date cannot be in the future';
  const conc = Number(b.concentrate_kg);
  if (blank(b.concentrate_kg) || !Number.isFinite(conc) || conc < 0 || conc > MAX_CONCENTRATE_KG) {
    return `Concentrate must be between 0 and ${MAX_CONCENTRATE_KG} kg`;
  }
  if (!blank(b.forage_kg)) {
    const forage = Number(b.forage_kg);
    if (!Number.isFinite(forage) || forage < 0 || forage > MAX_FORAGE_KG) return `Forage must be between 0 and ${MAX_FORAGE_KG} kg`;
  }
  if (b.notes && String(b.notes).length > 255) return 'Notes must be 255 characters or fewer';
  return null;
};

const clean = (b) => ({
  cattle_id: Number(b.cattle_id),
  fed_on: b.fed_on,
  concentrate_kg: round2(Number(b.concentrate_kg)),
  forage_kg: blank(b.forage_kg) ? null : round2(Number(b.forage_kg)),
  notes: b.notes ? String(b.notes).trim() : null
});

const isBadReference = (err) => err && err.code === 'ER_NO_REFERENCED_ROW_2';

exports.getRecords = async (req, res) => {
  try {
    const { cattle_id, from, to } = req.query;
    if ((from && !validDate(from)) || (to && !validDate(to))) {
      return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });
    }
    res.json(await FeedRecord.getRecords({ cattleId: cattle_id, from, to }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load feed records' });
  }
};

// Saves the day's feed for a cow; a second entry for the same day replaces the first
exports.saveRecord = async (req, res) => {
  try {
    const problem = validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const record = clean(req.body);
    const { id, replaced } = await FeedRecord.saveRecord(record, req.user.userId);
    await logActivity(
      req,
      replaced ? 'feed_updated' : 'feed_recorded',
      `Recorded ${record.concentrate_kg} kg concentrate for cattle #${record.cattle_id} (${record.fed_on})`
    );
    res.status(replaced ? 200 : 201).json({ feed_id: id, replaced });
  } catch (err) {
    if (isBadReference(err)) return res.status(400).json({ error: 'Cattle does not exist' });
    console.error(err);
    res.status(500).json({ error: 'Could not save feed record' });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const removed = await FeedRecord.deleteRecord(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Feed record not found' });
    await logActivity(req, 'feed_deleted', `Deleted feed record #${req.params.id}`);
    res.json({ message: 'Feed record deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete feed record' });
  }
};

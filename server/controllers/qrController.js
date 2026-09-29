const QRCode = require('../models/QRCode');
const Cattle = require('../models/Cattle');
const logActivity = require('../utils/logActivity');

const CODE_RE = /^[A-Za-z0-9_-]{6,32}$/;

exports.getAll = async (req, res) => {
  try {
    res.json(await QRCode.getAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load QR codes' });
  }
};

exports.getForCattle = async (req, res) => {
  try {
    const qr = await QRCode.getByCattleId(req.params.id);
    if (!qr) return res.status(404).json({ error: 'No QR code yet for this animal' });
    res.json(qr);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load QR code' });
  }
};

// Idempotent: returns the existing code if the animal already has one
exports.createForCattle = async (req, res) => {
  try {
    const cow = await Cattle.getCattleById(req.params.id);
    if (!cow) return res.status(404).json({ error: 'Cattle not found' });
    const created = await QRCode.ensure(cow.cattle_id, req.user.userId);
    if (created) await logActivity(req, 'qr_generated', `Generated QR code for ${cow.tag_number}`);
    res.status(created ? 201 : 200).json(await QRCode.getByCattleId(cow.cattle_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate QR code' });
  }
};

exports.generateMissing = async (req, res) => {
  try {
    const created = await QRCode.ensureAll(req.user.userId);
    if (created) await logActivity(req, 'qr_generated', `Generated ${created} missing QR code(s)`);
    res.json({ created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate QR codes' });
  }
};

// For a lost or damaged label: the old code stops working
exports.regenerate = async (req, res) => {
  try {
    const existing = await QRCode.getByCattleId(req.params.id);
    if (!existing) return res.status(404).json({ error: 'No QR code yet for this animal' });
    await QRCode.regenerate(existing.cattle_id, req.user.userId);
    await logActivity(req, 'qr_regenerated', `Reissued QR code for ${existing.cattle_tag}`);
    res.json(await QRCode.getByCattleId(existing.cattle_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not regenerate QR code' });
  }
};

// Called by the scanner; counts the scan and returns the animal it belongs to
exports.resolve = async (req, res) => {
  try {
    const { code } = req.params;
    if (!CODE_RE.test(code)) return res.status(400).json({ error: 'That is not a DairyDan QR code' });
    const qr = await QRCode.getByCode(code);
    if (!qr) return res.status(404).json({ error: 'Unknown or reissued QR code' });
    await QRCode.recordScan(qr.qr_id);
    res.json({ cattle_id: qr.cattle_id, cattle_name: qr.cattle_name, cattle_tag: qr.cattle_tag });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not look up QR code' });
  }
};

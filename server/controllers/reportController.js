const Report = require('../models/Report');
const builders = require('../utils/reportBuilders');
const logActivity = require('../utils/logActivity');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 366 * 3;

const validDate = (d) => DATE_RE.test(d) && !Number.isNaN(Date.parse(d));

// Returns an error message, or null when the parameters are valid
const validate = ({ report_type, date_from, date_to }) => {
  if (!builders[report_type]) return `Report type must be one of: ${Object.keys(builders).join(', ')}`;
  if (!validDate(date_from) || !validDate(date_to)) return 'A valid start and end date are required';
  if (date_from > date_to) return 'Start date must be before end date';
  if ((Date.parse(date_to) - Date.parse(date_from)) / 86400000 > MAX_SPAN_DAYS) return 'Reports can cover at most 3 years';
  return null;
};

// Rebuilds a report's figures from live data
const withData = async (report) => ({
  report,
  data: await builders[report.report_type].build({ from: report.date_from, to: report.date_to })
});

exports.getTypes = (req, res) =>
  res.json(Object.entries(builders).map(([value, { title }]) => ({ value, title })));

exports.getReports = async (req, res) => {
  try {
    res.json(await Report.getReports());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load reports' });
  }
};

exports.generateReport = async (req, res) => {
  try {
    const problem = validate(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const { report_type, date_from, date_to } = req.body;
    const title = `${builders[report_type].title}, ${date_from} to ${date_to}`;
    const id = await Report.createReport({ title, report_type, date_from, date_to }, req.user.userId);
    await logActivity(req, 'report_generated', `Generated "${title}"`);
    res.status(201).json(await withData(await Report.getReportById(id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate report' });
  }
};

exports.getReport = async (req, res) => {
  try {
    const report = await Report.getReportById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    // A type removed from the builders leaves an unreadable row behind
    if (!builders[report.report_type]) return res.status(410).json({ error: 'This report type is no longer available' });
    res.json(await withData(report));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load report' });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const removed = await Report.deleteReport(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Report not found' });
    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete report' });
  }
};

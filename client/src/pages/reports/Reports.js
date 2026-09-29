import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReports, useReportTypes } from '../../api/useReports';
import { localDate } from '../finance/FinanceForm';
import Loader from '../../components/Loader';
import ReportView from './ReportView';
import '../../styles/tables.css';
import '../../styles/finance.css';

const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return localDate(d);
};

const Reports = () => {
  const types = useReportTypes();
  const { reports, loading, error, generateReport, openReport, deleteReport } = useReports();
  const [form, setForm] = useState({ report_type: 'herd', date_from: monthAgo(), date_to: localDate() });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [open, setOpen] = useState(null); // { report, data }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const show = async (fn) => {
    setBusy(true);
    setActionError('');
    const result = await fn();
    setBusy(false);
    if (result.success) setOpen(result.data);
    else setActionError(result.error);
  };

  const remove = async (id) => {
    const result = await deleteReport(id);
    if (!result.success) setActionError(result.error);
    else if (open && open.report.report_id === id) setOpen(null);
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="muted">Generate a report for any period, preview it, and download it as a PDF.</p>
        </div>
        <Link to="/finance" className="btn btn-outline">Finance</Link>
      </div>

      <form className="card report-form" onSubmit={(e) => { e.preventDefault(); show(() => generateReport(form)); }}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="report_type">Report</label>
            <select id="report_type" name="report_type" value={form.report_type} onChange={handleChange}>
              {types.map((t) => <option key={t.value} value={t.value}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="date_from">From</label>
            <input id="date_from" name="date_from" type="date" max={form.date_to} value={form.date_from} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="date_to">To</label>
            <input id="date_to" name="date_to" type="date" min={form.date_from} value={form.date_to} onChange={handleChange} required />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Working…' : 'Generate report'}</button>
      </form>

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {open && <ReportView result={open} onClose={() => setOpen(null)} />}

      <div className="card">
        <h3>Recent reports</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <Loader />
        ) : reports.length === 0 ? (
          <p className="muted">No reports generated yet.</p>
        ) : (
          <ul className="report-history">
            {reports.map((r) => (
              <li key={r.report_id}>
                <div>
                  <strong>{r.title}</strong>
                  <span className="muted">
                    {new Date(r.created_at.replace(' ', 'T')).toLocaleString()} · {r.generated_by_name || 'unknown'}
                  </span>
                </div>
                <span className="row-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => show(() => openReport(r.report_id))} disabled={busy}>Open</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => remove(r.report_id)}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Reports;

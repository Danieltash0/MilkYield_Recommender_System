import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ROLES } from '../../context/AuthContext';
import { useMilking, useMilkingSummary } from '../../api/useMilking';
import { useCattle } from '../../api/useCattle';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import MilkBars from './MilkBars';
import '../../styles/tables.css';
import '../../styles/milking.css';

const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString();
const shortDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });

const MilkingRecords = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const canLog = hasRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.WORKER);
  const canManage = hasRole(ROLES.ADMIN, ROLES.MANAGER);

  const [filters, setFilters] = useState({ cattle_id: '', from: '', to: '' });
  const { records, loading, error, deleteRecord } = useMilking(filters);
  const { data: summary, loading: summaryLoading, reload: reloadSummary } = useMilkingSummary(7);
  const { cattle } = useCattle();
  const cows = cattle.filter((c) => c.gender === 'Female');

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const setFilter = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  const confirmDelete = async () => {
    setDeleting(true);
    const result = await deleteRecord(toDelete.record_id);
    setDeleting(false);
    if (result.success) {
      setToDelete(null);
      setDeleteError('');
      reloadSummary();
    } else {
      setDeleteError(result.error);
    }
  };

  const bars = (summary ? summary.daily : []).map((d) => ({
    key: d.date,
    label: shortDay(d.date),
    value: Math.round(d.total * 10) / 10,
    title: `${fmtDate(d.date)}: ${d.total} L from ${d.cows} cow${d.cows === 1 ? '' : 's'}`
  }));
  const filtered = filters.cattle_id || filters.from || filters.to;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Milking</h1>
          <p className="muted">Yields recorded per cow, per session.</p>
        </div>
        {canLog && <Link to="/milking/log" className="btn btn-primary">Log milking</Link>}
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <span className="stat-label">Today</span>
          <span className="stat-value">{summaryLoading || !summary ? '…' : `${summary.today} L`}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Last 7 days</span>
          <span className="stat-value">{summaryLoading || !summary ? '…' : `${summary.total} L`}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Average per day</span>
          <span className="stat-value">{summaryLoading || !summary ? '…' : `${summary.average_per_day} L`}</span>
          <span className="muted">Days with records, last 7</span>
        </div>
      </div>

      <div className="milk-overview">
        <div className="card">
          <h3>Daily herd yield</h3>
          <MilkBars bars={bars} empty="No milk recorded in the last 7 days." />
        </div>
        <div className="card">
          <h3>Top producers · 7 days</h3>
          {summary && summary.top.length ? (
            <ol className="top-list">
              {summary.top.map((c) => (
                <li key={c.cattle_id}>
                  <Link to={`/cattle/${c.cattle_id}/milk`}>{c.name || 'Unnamed'} <span className="muted">{c.tag_number}</span></Link>
                  <strong>{Math.round(c.total * 10) / 10} L</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No milk recorded in the last 7 days.</p>
          )}
        </div>
      </div>

      <div className="toolbar">
        <select name="cattle_id" value={filters.cattle_id} onChange={setFilter} aria-label="Filter by cow">
          <option value="">All cows</option>
          {cows.map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.name || 'Unnamed'} · {c.tag_number}</option>)}
        </select>
        <input type="date" name="from" value={filters.from} onChange={setFilter} aria-label="From date" />
        <input type="date" name="to" value={filters.to} onChange={setFilter} aria-label="To date" />
        {filtered && (
          <button className="btn btn-secondary" onClick={() => setFilters({ cattle_id: '', from: '', to: '' })}>Clear</button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {deleteError && <div className="alert alert-error">{deleteError}</div>}

      {loading ? (
        <Loader />
      ) : records.length === 0 ? (
        <div className="card empty"><p>{filtered ? 'No records match these filters.' : 'No milking records yet.'}</p></div>
      ) : (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>Session</th><th>Cow</th><th className="num">Litres</th><th className="num">Fat %</th>
                <th>Recorded by</th>{canManage && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.record_id}>
                  <td>{fmtDate(r.milking_date)}</td>
                  <td>{r.session}</td>
                  <td><Link to={`/cattle/${r.cattle_id}/milk`}>{r.cattle_name || 'Unnamed'}</Link> <span className="muted">{r.cattle_tag}</span></td>
                  <td className="num">{r.quantity}</td>
                  <td className="num">{r.fat_percentage ?? '—'}</td>
                  <td>{r.recorded_by_name || '—'}</td>
                  {canManage && (
                    <td className="row-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/milking/${r.record_id}/edit`)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => { setDeleteError(''); setToDelete(r); }}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toDelete && (
        <Modal title="Delete milking record" confirmText="Delete" loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete}>
          <p>
            Delete the {toDelete.session.toLowerCase()} record of <strong>{toDelete.quantity} L</strong> for{' '}
            {toDelete.cattle_name || toDelete.cattle_tag} on {fmtDate(toDelete.milking_date)}?
          </p>
        </Modal>
      )}
    </div>
  );
};

export default MilkingRecords;

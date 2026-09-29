import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, ROLES } from '../../context/AuthContext';
import { useCattleMilkHistory } from '../../api/useMilking';
import Loader from '../../components/Loader';
import MilkBars from './MilkBars';
import '../../styles/tables.css';
import '../../styles/milking.css';

const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString();
const SESSION_INITIAL = { Morning: 'AM', Afternoon: 'Aft', Evening: 'PM' };

const CattleMilkHistory = () => {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const { data, loading, error } = useCattleMilkHistory(id);

  if (loading) return <Loader />;
  if (error || !data) {
    return (
      <div className="container narrow">
        <div className="alert alert-error">{error || 'Cattle not found.'}</div>
        <Link to="/cattle" className="btn btn-outline">Back to cattle</Link>
      </div>
    );
  }

  const { cattle: cow, records, stats } = data;
  // Oldest to newest, so the chart reads left to right
  const bars = records
    .slice(0, 14)
    .reverse()
    .map((r) => ({
      key: r.record_id,
      label: `${new Date(r.milking_date + 'T00:00:00').getDate()} ${SESSION_INITIAL[r.session]}`,
      value: r.quantity,
      title: `${fmtDate(r.milking_date)} ${r.session}: ${r.quantity} L`
    }));

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>{cow.name || 'Unnamed'} · milk history</h1>
          <p className="muted">Tag {cow.tag_number} · {cow.breed || 'Breed not recorded'}</p>
        </div>
        <div className="card-actions">
          <Link to={`/cattle/${cow.cattle_id}`} className="btn btn-secondary">Profile</Link>
          {hasRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.WORKER) && cow.gender === 'Female' && (
            <Link to={`/milking/log?cattle=${cow.cattle_id}`} className="btn btn-primary">Log milking</Link>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat"><span className="stat-label">Sessions recorded</span><span className="stat-value">{stats.sessions}</span></div>
        <div className="card stat"><span className="stat-label">Average per session</span><span className="stat-value">{stats.average_per_session} L</span></div>
        <div className="card stat">
          <span className="stat-label">Last 7 sessions</span>
          <span className="stat-value">{stats.last7_average} L</span>
          <span className="muted">Average</span>
        </div>
        <div className="card stat"><span className="stat-label">Best session</span><span className="stat-value">{stats.best} L</span></div>
      </div>

      <div className="card">
        <h3>Recent sessions</h3>
        <MilkBars bars={bars} empty="No milk recorded for this cow yet." />
      </div>

      {records.length > 0 && (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Session</th><th className="num">Litres</th><th className="num">Fat %</th><th>Recorded by</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.record_id}>
                  <td>{fmtDate(r.milking_date)}</td>
                  <td>{r.session}</td>
                  <td className="num">{r.quantity}</td>
                  <td className="num">{r.fat_percentage ?? '—'}</td>
                  <td>{r.recorded_by_name || '—'}</td>
                  <td>{r.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CattleMilkHistory;

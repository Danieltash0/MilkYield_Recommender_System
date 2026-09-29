import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, ROLES } from '../../context/AuthContext';
import { useHealthRecords } from '../../api/useHealth';
import { useCattle } from '../../api/useCattle';
import { healthClass } from '../../components/CattleCard';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { RECORD_TYPES, localDate } from './HealthRecordForm';
import '../../styles/tables.css';
import '../../styles/health.css';

const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString() : '—');

const HealthRecords = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const canWrite = hasRole(ROLES.ADMIN, ROLES.VET);
  // ?cattle_id= lets the cattle profile link straight to one animal's history
  const [params, setParams] = useSearchParams();
  const cattleId = params.get('cattle_id') || '';
  const [type, setType] = useState('');
  const { records, loading, error, deleteRecord } = useHealthRecords({ cattle_id: cattleId, type });
  const { cattle } = useCattle();

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const setCattle = (value) => setParams(value ? { cattle_id: value } : {});

  const confirmDelete = async () => {
    setDeleting(true);
    const result = await deleteRecord(toDelete.record_id);
    setDeleting(false);
    if (result.success) {
      setToDelete(null);
      setDeleteError('');
    } else {
      setDeleteError(result.error);
    }
  };

  const today = localDate();
  const dueCheckups = records.filter((r) => r.next_checkup && r.next_checkup <= today).length;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Health records</h1>
          <p className="muted">
            {loading ? 'Loading…' : `${records.length} record${records.length === 1 ? '' : 's'}`}
            {dueCheckups > 0 && ` · ${dueCheckups} checkup${dueCheckups === 1 ? '' : 's'} due`}
          </p>
        </div>
        <div className="card-actions">
          <Link to="/appointments" className="btn btn-outline">Appointments</Link>
          {canWrite && (
            <Link to={`/health/add${cattleId ? `?cattle=${cattleId}` : ''}`} className="btn btn-primary">New record</Link>
          )}
        </div>
      </div>

      <div className="toolbar">
        <select value={cattleId} onChange={(e) => setCattle(e.target.value)} aria-label="Filter by animal">
          <option value="">All cattle</option>
          {cattle.map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.name || 'Unnamed'} · {c.tag_number}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {RECORD_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {deleteError && <div className="alert alert-error">{deleteError}</div>}

      {loading ? (
        <Loader />
      ) : records.length === 0 ? (
        <div className="card empty"><p>{cattleId || type ? 'No records match these filters.' : 'No health records yet.'}</p></div>
      ) : (
        <div className="record-list">
          {records.map((r) => (
            <article className="card health-record" key={r.record_id}>
              <header className="health-record-head">
                <div>
                  <span className={`type-tag type-${r.record_type.toLowerCase()}`}>{r.record_type}</span>
                  <h3>
                    <Link to={`/cattle/${r.cattle_id}`}>{r.cattle_name || 'Unnamed'}</Link>{' '}
                    <span className="muted">{r.cattle_tag}</span>
                  </h3>
                </div>
                <div className="health-record-date">
                  {fmtDate(r.record_date)}
                  {r.health_status && <span className={healthClass(r.health_status)}>{r.health_status}</span>}
                </div>
              </header>
              <dl className="details">
                {r.diagnosis && <div className="full"><dt>Diagnosis</dt><dd>{r.diagnosis}</dd></div>}
                {r.treatment && <div className="full"><dt>Treatment</dt><dd>{r.treatment}</dd></div>}
                {r.medication && <div><dt>Medication</dt><dd>{r.medication}</dd></div>}
                {r.next_checkup && (
                  <div>
                    <dt>Next checkup</dt>
                    <dd className={r.next_checkup <= today ? 'due' : undefined}>{fmtDate(r.next_checkup)}</dd>
                  </div>
                )}
                {r.notes && <div className="full"><dt>Notes</dt><dd>{r.notes}</dd></div>}
              </dl>
              <footer className="health-record-foot">
                <span className="muted">Recorded by {r.vet_name || 'unknown'}</span>
                {canWrite && (
                  <span className="row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/health/${r.record_id}/edit`)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => { setDeleteError(''); setToDelete(r); }}>Delete</button>
                  </span>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      {toDelete && (
        <Modal title="Delete health record" confirmText="Delete" loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete}>
          <p>
            Delete the {toDelete.record_type.toLowerCase()} record for <strong>{toDelete.cattle_name || toDelete.cattle_tag}</strong> on{' '}
            {fmtDate(toDelete.record_date)}? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
};

export default HealthRecords;

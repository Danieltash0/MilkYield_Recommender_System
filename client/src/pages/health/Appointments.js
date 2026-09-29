import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ROLES } from '../../context/AuthContext';
import { useAppointments } from '../../api/useHealth';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import '../../styles/health.css';

// 'YYYY-MM-DD HH:MM:SS' is local wall-clock time
const toDate = (s) => new Date(s.replace(' ', 'T'));
const fmtWhen = (s) =>
  toDate(s).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const VIEWS = { upcoming: 'Upcoming', all: 'All' };

const Appointments = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const isVet = hasRole(ROLES.VET);
  const canSchedule = hasRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.VET);
  const canDelete = hasRole(ROLES.ADMIN, ROLES.MANAGER);

  const [view, setView] = useState('upcoming');
  const [mineOnly, setMineOnly] = useState(false);
  const { appointments, loading, error, updateStatus, deleteAppointment } = useAppointments({
    upcoming: view === 'upcoming' ? 1 : '',
    vet_id: mineOnly ? 'me' : ''
  });

  const [actionError, setActionError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Vets can only close their own (or unassigned) visits; the server enforces this too
  const canClose = (a) => canSchedule && (!isVet || !a.vet_id || a.vet_id === user.user_id);

  const setStatus = async (a, status) => {
    const result = await updateStatus(a.appointment_id, status);
    setActionError(result.success ? '' : result.error);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const result = await deleteAppointment(toDelete.appointment_id);
    setDeleting(false);
    setActionError(result.success ? '' : result.error);
    if (result.success) setToDelete(null);
  };

  const now = new Date();

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Vet appointments</h1>
          <p className="muted">{loading ? 'Loading…' : `${appointments.length} ${view === 'upcoming' ? 'upcoming' : 'in total'}`}</p>
        </div>
        <div className="card-actions">
          <Link to="/health" className="btn btn-outline">Health records</Link>
          {canSchedule && <Link to="/appointments/add" className="btn btn-primary">Schedule</Link>}
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented" role="tablist">
          {Object.entries(VIEWS).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              className={view === key ? 'active' : undefined}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {isVet && (
          <label className="inline-check">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            Assigned to me
          </label>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      {loading ? (
        <Loader />
      ) : appointments.length === 0 ? (
        <div className="card empty"><p>{view === 'upcoming' ? 'No upcoming appointments.' : 'No appointments yet.'}</p></div>
      ) : (
        <div className="appointment-list">
          {appointments.map((a) => {
            const overdue = a.status === 'Scheduled' && toDate(a.appointment_date) < now;
            return (
              <div className={`card appointment appt-${a.status.toLowerCase()}`} key={a.appointment_id}>
                <div className="appt-when">
                  <strong>{fmtWhen(a.appointment_date)}</strong>
                  <span className={`appt-status${overdue ? ' overdue' : ''}`}>{overdue ? 'Overdue' : a.status}</span>
                </div>
                <div className="appt-body">
                  <h3>{a.reason}</h3>
                  <p className="muted">
                    <Link to={`/cattle/${a.cattle_id}`}>{a.cattle_name || 'Unnamed'}</Link> · {a.cattle_tag} ·{' '}
                    {a.vet_name ? `Dr ${a.vet_name}` : 'No vet assigned'}
                  </p>
                  {a.notes && <p className="appt-notes">{a.notes}</p>}
                </div>
                {canSchedule && (
                  <div className="appt-actions">
                    {a.status === 'Scheduled' && canClose(a) && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => setStatus(a, 'Completed')}>Complete</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setStatus(a, 'Cancelled')}>Cancel visit</button>
                      </>
                    )}
                    {a.status !== 'Scheduled' && canClose(a) && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setStatus(a, 'Scheduled')}>Reopen</button>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/appointments/${a.appointment_id}/edit`)}>Edit</button>
                    {canDelete && (
                      <button className="btn btn-danger btn-sm" onClick={() => { setActionError(''); setToDelete(a); }}>Delete</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toDelete && (
        <Modal title="Delete appointment" confirmText="Delete" loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete}>
          <p>Delete <strong>{toDelete.reason}</strong> for {toDelete.cattle_name || toDelete.cattle_tag}?</p>
        </Modal>
      )}
    </div>
  );
};

export default Appointments;

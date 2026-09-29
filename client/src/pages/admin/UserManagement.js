import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdminUsers, useAdminStats, ROLE_OPTIONS, roleLabel } from '../../api/useAdmin';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import AdminTabs from './AdminTabs';
import '../../styles/tables.css';
import '../../styles/admin.css';

const fmtDateTime = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleString() : 'Never');

const UserManagement = () => {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [search, setSearch] = useState('');
  const { users, loading, error, updateUser, resetPassword, deleteUser } = useAdminUsers(filters);
  const { data: stats, reload: reloadStats } = useAdminStats();

  const [notice, setNotice] = useState({ type: '', text: '' });
  const [toDelete, setToDelete] = useState(null);
  const [toReset, setToReset] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [busy, setBusy] = useState(false);

  const closeReset = () => {
    setToReset(null);
    setNewPassword('');
    setResetError('');
  };

  const setFilter = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const report = (result, ok) => setNotice(result.success ? { type: 'success', text: ok } : { type: 'error', text: result.error });

  const toggleStatus = async (u) => {
    const status = u.status === 'active' ? 'inactive' : 'active';
    const result = await updateUser(u.user_id, { name: u.name, email: u.email, role: u.role, status });
    report(result, `${u.name} is now ${status}.`);
    if (result.success) reloadStats();
  };

  const confirmDelete = async () => {
    setBusy(true);
    const result = await deleteUser(toDelete.user_id);
    setBusy(false);
    report(result, `Deleted ${toDelete.name}.`);
    if (result.success) {
      setToDelete(null);
      reloadStats();
    }
  };

  const confirmReset = async () => {
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    const result = await resetPassword(toReset.user_id, newPassword);
    setBusy(false);
    if (result.success) {
      report(result, `Password reset for ${toReset.name}. Share the new password with them.`);
      closeReset();
    } else {
      setResetError(result.error);
    }
  };

  const countFor = (role) => {
    const row = stats && stats.by_role.find((r) => r.role === role);
    return row ? `${row.active}/${row.total}` : '0';
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <p className="muted">Manage accounts, review activity and configure the farm.</p>
        </div>
        <Link to="/admin/users/add" className="btn btn-primary">Add user</Link>
      </div>
      <AdminTabs />

      <div className="stat-grid admin-stats">
        {ROLE_OPTIONS.map((r) => (
          <div className="card stat" key={r.value}>
            <span className="stat-label">{r.label}s</span>
            <span className="stat-value">{stats ? countFor(r.value) : '…'}</span>
            <span className="muted">active / total</span>
          </div>
        ))}
        <div className="card stat">
          <span className="stat-label">Active this week</span>
          <span className="stat-value">{stats ? stats.active_last_7_days : '…'}</span>
          <span className="muted">{stats ? `${stats.actions_today} actions today` : ''}</span>
        </div>
      </div>

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setFilters({ ...filters, search }); }}>
        <input type="search" placeholder="Search name or email, then press Enter" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => setFilters({ ...filters, search })} aria-label="Search users" />
        <select name="role" value={filters.role} onChange={setFilter} aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select name="status" value={filters.status} onChange={setFilter} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </form>

      {error && <div className="alert alert-error">{error}</div>}
      {notice.text && <div className={`alert alert-${notice.type}`}>{notice.text}</div>}

      {loading ? (
        <Loader />
      ) : users.length === 0 ? (
        <div className="card empty"><p>No users match these filters.</p></div>
      ) : (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Status</th><th>Last login</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.user_id === me.user_id;
                return (
                  <tr key={u.user_id} className={u.status === 'inactive' ? 'row-inactive' : undefined}>
                    <td>
                      <strong>{u.name}</strong>{isMe && <span className="you">you</span>}
                      <div className="muted">{u.email}</div>
                    </td>
                    <td><span className={`role-tag role-${u.role}`}>{roleLabel(u.role)}</span></td>
                    <td><span className={`status-dot ${u.status}`}>{u.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                    <td>{fmtDateTime(u.last_login)}</td>
                    <td className="row-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/admin/users/${u.user_id}/edit`)}>Edit</button>
                      <button className="btn btn-outline btn-sm" onClick={() => { setNotice({}); setToReset(u); }}>Reset password</button>
                      {!isMe && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => toggleStatus(u)}>
                            {u.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => { setNotice({}); setToDelete(u); }}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toDelete && (
        <Modal title="Delete user" confirmText="Delete" loading={busy} onCancel={() => setToDelete(null)} onConfirm={confirmDelete}>
          <p>
            Delete <strong>{toDelete.name}</strong> ({toDelete.email})? Their records stay, but will no longer show who
            made them. To block sign-in but keep the name, deactivate the account instead.
          </p>
        </Modal>
      )}

      {toReset && (
        <Modal
          title={`Reset password for ${toReset.name}`}
          confirmText="Reset password"
          loading={busy}
          onCancel={closeReset}
          onConfirm={confirmReset}
        >
          {resetError && <div className="alert alert-error" role="alert">{resetError}</div>}
          <label htmlFor="new-password">New password (at least 8 characters)</label>
          <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
        </Modal>
      )}
    </div>
  );
};

export default UserManagement;

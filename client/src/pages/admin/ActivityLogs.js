import React, { useState } from 'react';
import { useActivityLogs, useLogActions, useAdminUsers, roleLabel } from '../../api/useAdmin';
import Loader from '../../components/Loader';
import AdminTabs from './AdminTabs';
import '../../styles/tables.css';
import '../../styles/admin.css';

const EMPTY = { user_id: '', action: '', from: '', to: '', search: '' };
const fmtDateTime = (s) => new Date(s.replace(' ', 'T')).toLocaleString();
const pretty = (action) => action.replace(/_/g, ' ');

const ActivityLogs = () => {
  const [filters, setFilters] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error } = useActivityLogs({ ...filters, page });
  const actions = useLogActions();
  const { users } = useAdminUsers();

  // Any filter change starts again from the first page
  const setFilter = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPage(1);
  };
  const applySearch = () => {
    setFilters({ ...filters, search });
    setPage(1);
  };
  const clear = () => {
    setFilters(EMPTY);
    setSearch('');
    setPage(1);
  };
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <p className="muted">{loading ? 'Loading…' : `${data.total} logged action${data.total === 1 ? '' : 's'}`}</p>
        </div>
      </div>
      <AdminTabs />

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); applySearch(); }}>
        <input type="search" placeholder="Search descriptions or names, then press Enter" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={applySearch} aria-label="Search logs" />
        <select name="user_id" value={filters.user_id} onChange={setFilter} aria-label="Filter by user">
          <option value="">All users</option>
          {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
        </select>
        <select name="action" value={filters.action} onChange={setFilter} aria-label="Filter by action">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{pretty(a)}</option>)}
        </select>
        <input type="date" name="from" value={filters.from} max={filters.to || undefined} onChange={setFilter} aria-label="From date" />
        <input type="date" name="to" value={filters.to} min={filters.from || undefined} onChange={setFilter} aria-label="To date" />
        {filtered && <button type="button" className="btn btn-secondary" onClick={clear}>Clear</button>}
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <Loader />
      ) : data.logs.length === 0 ? (
        <div className="card empty"><p>{filtered ? 'No activity matches these filters.' : 'No activity recorded yet.'}</p></div>
      ) : (
        <>
          <div className="card table-card">
            <table className="data-table log-table">
              <thead>
                <tr><th>When</th><th>User</th><th>Action</th><th>Details</th><th>IP address</th></tr>
              </thead>
              <tbody>
                {data.logs.map((l) => (
                  <tr key={l.log_id}>
                    <td>{fmtDateTime(l.timestamp)}</td>
                    <td>
                      {l.user_name || <span className="muted">Deleted user</span>}
                      {l.user_role && <div className="muted">{roleLabel(l.user_role)}</div>}
                    </td>
                    <td><span className="action-tag">{pretty(l.action)}</span></td>
                    <td className="wrap">{l.description || '—'}</td>
                    <td className="muted" title={l.user_agent || undefined}>{l.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button className="btn btn-secondary btn-sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Newer</button>
            <span className="muted">Page {data.page} of {data.pages}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage(page + 1)} disabled={page >= data.pages}>Older</button>
          </div>
        </>
      )}
    </div>
  );
};

export default ActivityLogs;

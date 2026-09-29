import { useState, useEffect, useCallback } from 'react';
import { apiRequest, getAuthHeaders } from './config';

// DB role keys the admin API uses, with the labels shown in the UI
export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Farm Manager' },
  { value: 'vet', label: 'Veterinarian' },
  { value: 'worker', label: 'Worker' }
];
export const roleLabel = (key) => (ROLE_OPTIONS.find((r) => r.value === key) || { label: key }).label;

const run = async (fn) => {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const send = (endpoint, method = 'GET', body) =>
  apiRequest(endpoint, { method, headers: getAuthHeaders(), body: body && JSON.stringify(body) });

const toQuery = (filters) => {
  const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();
  return q ? `?${q}` : '';
};

// Loads any GET endpoint and exposes { data, loading, error, reload }
const useResource = (endpoint, initial) => {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await send(endpoint));
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
};

export const useAdminStats = () => useResource('/admin/stats', null);

// filters: { role, status, search }
export const useAdminUsers = (filters = {}) => {
  const { data: users, loading, error, reload } = useResource(`/admin/users${toQuery(filters)}`, []);
  return {
    users, loading, error,
    createUser: (body) => run(() => send('/admin/users', 'POST', body)),
    updateUser: (id, body) => run(async () => { await send(`/admin/users/${id}`, 'PUT', body); await reload(); }),
    resetPassword: (id, password) => run(() => send(`/admin/users/${id}/reset-password`, 'POST', { password })),
    deleteUser: (id) => run(async () => { await send(`/admin/users/${id}`, 'DELETE'); await reload(); })
  };
};

// filters: { user_id, action, from, to, search, page }
export const useActivityLogs = (filters = {}) =>
  useResource(`/admin/logs${toQuery(filters)}`, { logs: [], total: 0, page: 1, pages: 1 });

export const useLogActions = () => useResource('/admin/logs/actions', []).data;

export const useSettings = () => {
  const { data, loading, error, reload } = useResource('/admin/settings', null);
  return {
    settings: data, loading, error, reload,
    saveSettings: (values) => run(() => send('/admin/settings', 'PUT', values))
  };
};

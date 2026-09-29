import { useState, useEffect, useCallback } from 'react';
import { apiRequest, getAuthHeaders } from './config';

// filters: { status, assigned_to } — empty values are left out of the query
export const useTasks = (filters = {}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setTasks(await apiRequest(`/tasks${query ? `?${query}` : ''}`, { headers: getAuthHeaders() }));
    } catch (err) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const run = async (fn) => {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const send = (endpoint, method, body) =>
    apiRequest(endpoint, { method, headers: getAuthHeaders(), body: body && JSON.stringify(body) });

  const createTask = (body) => run(() => send('/tasks', 'POST', body));
  const updateTask = (id, body) => run(() => send(`/tasks/${id}`, 'PUT', body));

  const updateStatus = (id, status) =>
    run(async () => {
      await send(`/tasks/${id}/status`, 'PATCH', { status });
      await fetchTasks();
    });

  // Updates the one task in place so the list does not flash a loader
  const toggleChecklistItem = (id, index) =>
    run(async () => {
      const { checklist } = await send(`/tasks/${id}/checklist/${index}`, 'PATCH');
      setTasks((list) => list.map((t) => (t.task_id === id ? { ...t, checklist } : t)));
    });

  const deleteTask = (id) =>
    run(async () => {
      await send(`/tasks/${id}`, 'DELETE');
      await fetchTasks();
    });

  // Returns the task, or null if it is missing
  const getTaskById = async (id) => {
    try {
      return await apiRequest(`/tasks/${id}`, { headers: getAuthHeaders() });
    } catch (err) {
      return null;
    }
  };

  return {
    tasks, loading, error, createTask, updateTask, updateStatus, toggleChecklistItem, deleteTask, getTaskById,
    refreshTasks: fetchTasks
  };
};

// Active non-admin users, for assignment dropdowns (admin/manager only)
export const useAssignableUsers = (enabled = true) => {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    apiRequest('/users/assignable', { headers: getAuthHeaders() })
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [enabled]);
  return users;
};

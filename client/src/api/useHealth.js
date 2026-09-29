import { useState, useEffect, useCallback } from 'react';
import { apiRequest, getAuthHeaders } from './config';

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

const toQuery = (filters) => {
  const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  return q ? `?${q}` : '';
};

// Loads a list endpoint and exposes { items, loading, error, reload }
const useList = (endpoint) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await apiRequest(endpoint, { headers: getAuthHeaders() }));
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, loading, error, reload };
};

// Returns the item, or null if it is missing
const getOne = async (endpoint) => {
  try {
    return await apiRequest(endpoint, { headers: getAuthHeaders() });
  } catch (err) {
    return null;
  }
};

// filters: { cattle_id, type }
export const useHealthRecords = (filters = {}) => {
  const { items: records, loading, error, reload } = useList(`/health-records${toQuery(filters)}`);
  return {
    records, loading, error,
    createRecord: (body) => run(() => send('/health-records', 'POST', body)),
    updateRecord: (id, body) => run(() => send(`/health-records/${id}`, 'PUT', body)),
    deleteRecord: (id) => run(async () => { await send(`/health-records/${id}`, 'DELETE'); await reload(); }),
    refreshRecords: reload
  };
};

// filters: { status, vet_id ('me' for the signed-in vet), cattle_id, upcoming }
export const useAppointments = (filters = {}) => {
  const { items: appointments, loading, error, reload } = useList(`/appointments${toQuery(filters)}`);
  return {
    appointments, loading, error,
    createAppointment: (body) => run(() => send('/appointments', 'POST', body)),
    updateAppointment: (id, body) => run(() => send(`/appointments/${id}`, 'PUT', body)),
    updateStatus: (id, status) => run(async () => { await send(`/appointments/${id}/status`, 'PATCH', { status }); await reload(); }),
    deleteAppointment: (id) => run(async () => { await send(`/appointments/${id}`, 'DELETE'); await reload(); }),
    refreshAppointments: reload
  };
};

export const useVets = () => useList('/appointments/vets').items;

export const getHealthRecord = (id) => getOne(`/health-records/${id}`);
export const getAppointment = (id) => getOne(`/appointments/${id}`);

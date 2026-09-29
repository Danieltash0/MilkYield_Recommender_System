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

// Loads any GET endpoint and exposes { data, loading, error, reload }
const useResource = (endpoint, initial) => {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await apiRequest(endpoint, { headers: getAuthHeaders() }));
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

// filters: { cattle_id, from, to } — empty values are left out of the query
export const useMilking = (filters = {}) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const { data: records, loading, error, reload } = useResource(`/milking${query ? `?${query}` : ''}`, []);

  const createRecord = (body) => run(() => send('/milking', 'POST', body));
  const updateRecord = (id, body) => run(() => send(`/milking/${id}`, 'PUT', body));
  const deleteRecord = (id) =>
    run(async () => {
      await send(`/milking/${id}`, 'DELETE');
      await reload();
    });

  return { records, loading, error, createRecord, updateRecord, deleteRecord, refreshRecords: reload };
};

export const useMilkingSummary = (days = 7) => useResource(`/milking/summary?days=${days}`, null);

export const useCattleMilkHistory = (cattleId) => useResource(`/milking/cattle/${cattleId}`, null);

// Returns the record, or null if it is missing
export const getMilkingRecord = async (id) => {
  try {
    return await apiRequest(`/milking/${id}`, { headers: getAuthHeaders() });
  } catch (err) {
    return null;
  }
};

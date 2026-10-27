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

// filters: { cattle_id, from, to }; empty values are left out of the query
export const useFeed = (filters = {}) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const endpoint = `/feed${query ? `?${query}` : ''}`;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRecords(await apiRequest(endpoint, { headers: getAuthHeaders() }));
    } catch (err) {
      setError(err.message || 'Failed to load feed records');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    reload();
  }, [reload]);

  // One entry per cow per day: saving the same day again replaces it
  const saveRecord = (body) =>
    run(async () => {
      const res = await send('/feed', 'POST', body);
      await reload();
      return res;
    });

  const deleteRecord = (id) =>
    run(async () => {
      await send(`/feed/${id}`, 'DELETE');
      await reload();
    });

  return { records, loading, error, saveRecord, deleteRecord, refreshRecords: reload };
};

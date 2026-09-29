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

const send = (endpoint, method = 'GET', body) =>
  apiRequest(endpoint, { method, headers: getAuthHeaders(), body: body && JSON.stringify(body) });

const toQuery = (filters) => {
  const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  return q ? `?${q}` : '';
};

// Loads any GET endpoint and exposes { data, loading, error, reload }
export const useResource = (endpoint, initial) => {
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

// filters: { type, category, from, to }
export const useFinance = (filters = {}) => {
  const { data: records, loading, error, reload } = useResource(`/finance${toQuery(filters)}`, []);
  return {
    records, loading, error,
    createRecord: (body) => run(() => send('/finance', 'POST', body)),
    updateRecord: (id, body) => run(() => send(`/finance/${id}`, 'PUT', body)),
    deleteRecord: (id) => run(async () => { await send(`/finance/${id}`, 'DELETE'); await reload(); }),
    refreshRecords: reload
  };
};

// filters: { from, to }
export const useFinanceSummary = (filters = {}) => useResource(`/finance/summary${toQuery(filters)}`, null);

export const useFinanceCategories = () => useResource('/finance/categories', { Income: [], Expense: [] }).data;

// Returns the record, or null if it is missing
export const getFinanceRecord = async (id) => {
  try {
    return await send(`/finance/${id}`);
  } catch (err) {
    return null;
  }
};

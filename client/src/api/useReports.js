import { apiRequest, getAuthHeaders } from './config';
import { useResource } from './useFinance';

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

export const useReportTypes = () => useResource('/reports/types', []).data;

// Saved report history, plus generate/open/delete
export const useReports = () => {
  const { data: reports, loading, error, reload } = useResource('/reports', []);
  return {
    reports, loading, error,
    // Returns { report, data } with the figures rebuilt from live records
    generateReport: (params) => run(async () => { const res = await send('/reports', 'POST', params); await reload(); return res; }),
    openReport: (id) => run(() => send(`/reports/${id}`)),
    deleteReport: (id) => run(async () => { await send(`/reports/${id}`, 'DELETE'); await reload(); })
  };
};

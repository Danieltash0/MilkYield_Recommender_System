import { useState, useEffect, useCallback } from 'react';
import { apiRequest, getAuthHeaders } from './config';

// Next-session forecast and recent judgements for one cow
export const useYieldInsight = (cattleId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await apiRequest(`/recommendations/cattle/${cattleId}`, { headers: getAuthHeaders() }));
    } catch (err) {
      setError(err.message || 'Failed to load yield insight');
    } finally {
      setLoading(false);
    }
  }, [cattleId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
};

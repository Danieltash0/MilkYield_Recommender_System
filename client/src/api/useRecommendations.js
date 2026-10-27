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

// Expected vs actual litres per day: the herd, or one cow (cattleId) or breed
export const useYieldTrend = ({ days = 30, cattleId = '', breed = '' } = {}) => {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ days: String(days) });
      if (cattleId) params.set('cattle_id', cattleId);
      if (breed) params.set('breed', breed);
      const data = await apiRequest(`/recommendations/trend?${params}`, { headers: getAuthHeaders() });
      setSeries(data.series);
    } catch (err) {
      setError(err.message || 'Failed to load the yield trend');
    } finally {
      setLoading(false);
    }
  }, [days, cattleId, breed]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { series, loading, error, reload };
};

// Low and high readings across the herd over the last `days` days
export const useYieldAlerts = (days = 7) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest(`/recommendations/alerts?days=${days}`, { headers: getAuthHeaders() });
      setAlerts(data.alerts);
    } catch (err) {
      setError(err.message || 'Failed to load yield alerts');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { alerts, loading, error, reload };
};

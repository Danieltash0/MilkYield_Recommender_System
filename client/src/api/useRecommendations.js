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

// Expected daily yield for one cow over the next `days` days (up to 60)
export const useYieldProjection = (cattleId, days = 60) => {
  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest(`/recommendations/cattle/${cattleId}/projection?days=${days}`, { headers: getAuthHeaders() });
      setProjection(data.projection);
    } catch (err) {
      setError(err.message || 'Failed to load the yield projection');
    } finally {
      setLoading(false);
    }
  }, [cattleId, days]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { projection, loading, error, reload };
};

// The herd's expected daily yield over the next `days` days (0 = off), or one cow's or breed's
export const useHerdProjection = ({ days = 60, cattleId = '', breed = '' } = {}) => {
  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(Boolean(days));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!days) {
      setProjection(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ days: String(days) });
      if (cattleId) params.set('cattle_id', cattleId);
      if (breed) params.set('breed', breed);
      const data = await apiRequest(`/recommendations/projection?${params}`, { headers: getAuthHeaders() });
      setProjection(data.projection);
    } catch (err) {
      setError(err.message || 'Failed to load the projection');
    } finally {
      setLoading(false);
    }
  }, [days, cattleId, breed]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { projection, loading, error, reload };
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

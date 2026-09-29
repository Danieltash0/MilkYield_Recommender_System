import { useState, useEffect, useCallback } from 'react';
import { apiRequest, getAuthHeaders } from './config';

const CODE_RE = /^[A-Za-z0-9_-]{6,32}$/;

// What a label encodes: a link into the app, so a phone camera can open it directly
export const qrLink = (code) => `${window.location.origin}/qr/${code}`;

// Accepts a scanned label link or a bare code; returns the code, or null if it is not ours
export const parseScanned = (text) => {
  const value = (text || '').trim();
  const fromLink = value.match(/\/qr\/([A-Za-z0-9_-]{6,32})\/?$/);
  if (fromLink) return fromLink[1];
  return CODE_RE.test(value) ? value : null;
};

const run = async (fn) => {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const send = (endpoint, method = 'GET') => apiRequest(endpoint, { method, headers: getAuthHeaders() });

// Returns the code record, or null if the animal has none yet
export const getCattleQR = async (cattleId) => {
  try {
    return await send(`/qr/cattle/${cattleId}`);
  } catch (err) {
    return null;
  }
};

export const createCattleQR = (cattleId) => run(() => send(`/qr/cattle/${cattleId}`, 'POST'));
export const regenerateCattleQR = (cattleId) => run(() => send(`/qr/cattle/${cattleId}/regenerate`, 'POST'));
export const resolveQR = (code) => run(() => send(`/qr/resolve/${encodeURIComponent(code)}`));

// Every issued code (admin/manager), for printing label sheets
export const useAllQR = () => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCodes(await send('/qr'));
    } catch (err) {
      setError(err.message || 'Failed to load QR codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const generateMissing = () =>
    run(async () => {
      const res = await send('/qr/generate-missing', 'POST');
      await reload();
      return res;
    });

  return { codes, loading, error, generateMissing };
};

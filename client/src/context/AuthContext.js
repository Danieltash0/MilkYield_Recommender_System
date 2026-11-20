import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest, getAuthHeaders } from '../api/config';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

// UI role labels (what the API returns in user.role)
export const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Farm Manager',
  VET: 'Veterinarian',
  WORKER: 'Worker'
};

export const dashboardPathFor = (role) => {
  switch (role) {
    case ROLES.ADMIN:
      return '/dashboard/admin';
    case ROLES.VET:
      return '/dashboard/vet';
    case ROLES.WORKER:
      return '/dashboard/worker';
    default:
      return '/dashboard/manager';
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('dairydan_user');
    sessionStorage.removeItem('token');
  }, []);

  // Restore the session, then re-validate the token with the server
  useEffect(() => {
    // Older builds kept the session in localStorage, which outlived the tab and
    // was shared by every tab; drop any leftover copy
    localStorage.removeItem('token');
    localStorage.removeItem('dairydan_user');

    const token = sessionStorage.getItem('token');
    const saved = sessionStorage.getItem('dairydan_user');
    if (!token || !saved) {
      setLoading(false);
      return;
    }
    try {
      setUser(JSON.parse(saved));
    } catch (e) {
      clearSession();
      setLoading(false);
      return;
    }
    apiRequest('/auth/me', { headers: getAuthHeaders() })
      .then((fresh) => {
        setUser(fresh);
        sessionStorage.setItem('dairydan_user', JSON.stringify(fresh));
      })
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, [clearSession]);

  // apiRequest fires this when the server rejects the token
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      sessionStorage.setItem('token', res.token);
      sessionStorage.setItem('dairydan_user', JSON.stringify(res.user));
      setUser(res.user);
      return { success: true, user: res.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signup = async (data) => {
    try {
      await apiRequest('/users/signup', { method: 'POST', body: JSON.stringify(data) });
      return login(data.email, data.password);
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST', headers: getAuthHeaders() });
    } catch (e) {
      /* logging out locally regardless */
    }
    clearSession();
  };

  const hasRole = (...roles) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

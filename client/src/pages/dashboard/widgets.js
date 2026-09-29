import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { healthClass } from '../../components/CattleCard';

export const HEALTH_LEVELS = ['Excellent', 'Good', 'Fair', 'Poor'];

// Everything the role dashboards derive from the cattle list, computed once
export const herdStats = (cattle) => {
  const byHealth = Object.fromEntries(HEALTH_LEVELS.map((h) => [h, 0]));
  cattle.forEach((c) => {
    byHealth[c.health || 'Good'] += 1;
  });

  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const severity = { Poor: 0, Fair: 1 };

  return {
    total: cattle.length,
    females: cattle.filter((c) => c.gender === 'Female').length,
    males: cattle.filter((c) => c.gender === 'Male').length,
    byHealth,
    needAttention: cattle
      .filter((c) => c.health in severity)
      .sort((a, b) => severity[a.health] - severity[b.health]),
    addedThisMonth: cattle.filter((c) => new Date(c.created_at).getTime() >= monthAgo).length,
    // The API already returns newest first
    recent: cattle.slice(0, 5)
  };
};

export const DashboardHeader = ({ tagline }) => {
  const { user } = useAuth();
  return (
    <div className="page-header">
      <div>
        <h1>Hello, {user.name.split(' ')[0]}</h1>
        <p className="muted">{user.role} · {tagline}</p>
      </div>
    </div>
  );
};

export const StatCard = ({ label, value, loading, hint }) => (
  <div className="card stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{loading ? '…' : value}</span>
    {hint && <span className="muted">{hint}</span>}
  </div>
);

export const HealthBreakdown = ({ byHealth, total }) => (
  <div className="card">
    <h3>Herd health</h3>
    <ul className="health-bars">
      {HEALTH_LEVELS.map((h) => {
        const pct = total ? Math.round((byHealth[h] / total) * 100) : 0;
        return (
          <li key={h}>
            <span className={healthClass(h)}>{h}</span>
            <div className="bar-track">
              <div className={`bar-fill bar-${h.toLowerCase()}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="bar-count">{byHealth[h]}</span>
          </li>
        );
      })}
    </ul>
  </div>
);

export const CattleListCard = ({ title, cattle, empty, loading }) => (
  <div className="card">
    <h3>{title}</h3>
    {loading ? (
      <p className="muted">Loading…</p>
    ) : cattle.length === 0 ? (
      <p className="muted">{empty}</p>
    ) : (
      <ul className="dash-list">
        {cattle.map((c) => (
          <li key={c.cattle_id}>
            <Link to={`/cattle/${c.cattle_id}`}>
              <strong>{c.name || 'Unnamed'}</strong> <span className="muted">Tag {c.tag_number}</span>
            </Link>
            <span className={healthClass(c.health)}>{c.health}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const QuickActions = ({ children }) => (
  <div className="card">
    <h3>Quick actions</h3>
    <div className="card-actions">{children}</div>
  </div>
);

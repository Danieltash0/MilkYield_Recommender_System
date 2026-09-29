import React from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';
import { herdStats, DashboardHeader, StatCard, HealthBreakdown, CattleListCard, QuickActions } from './widgets';

// System-wide overview. User management and activity logs land with feat/admin-management.
const AdminDashboard = () => {
  const { cattle, loading, error } = useCattle();
  const s = herdStats(cattle);

  return (
    <div className="container">
      <DashboardHeader tagline="Oversee the whole farm system." />
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <StatCard label="Cattle in herd" value={s.total} loading={loading} />
        <StatCard label="Females / Males" value={`${s.females} / ${s.males}`} loading={loading} />
        <StatCard label="Registered this month" value={s.addedThisMonth} loading={loading} hint="Last 30 days" />
        <StatCard label="Need attention" value={s.needAttention.length} loading={loading} hint="Health rated Fair or Poor" />
      </div>

      <div className="dash-grid">
        <HealthBreakdown byHealth={s.byHealth} total={s.total} />
        <CattleListCard title="Recently registered" cattle={s.recent} loading={loading} empty="No cattle registered yet." />
      </div>

      <QuickActions>
        <Link to="/cattle" className="btn btn-primary">View cattle</Link>
        <Link to="/cattle/add" className="btn btn-outline">Add cattle</Link>
      </QuickActions>
    </div>
  );
};

export default AdminDashboard;

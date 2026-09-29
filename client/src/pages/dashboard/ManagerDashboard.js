import React from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';
import { herdStats, DashboardHeader, StatCard, HealthBreakdown, CattleListCard, QuickActions } from './widgets';

// Herd operations view. Task assignment and milk yield widgets land with their own branches.
const ManagerDashboard = () => {
  const { cattle, loading, error } = useCattle();
  const s = herdStats(cattle);

  return (
    <div className="container">
      <DashboardHeader tagline="Keep the herd records accurate and the team on task." />
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <StatCard label="Cattle in herd" value={s.total} loading={loading} />
        <StatCard label="Milking herd" value={s.females} loading={loading} hint="Female cattle" />
        <StatCard label="Need attention" value={s.needAttention.length} loading={loading} hint="Health rated Fair or Poor" />
      </div>

      <div className="dash-grid">
        <HealthBreakdown byHealth={s.byHealth} total={s.total} />
        <CattleListCard
          title="Needs attention"
          cattle={s.needAttention.slice(0, 5)}
          loading={loading}
          empty="Every animal is in Good or Excellent health."
        />
      </div>

      <QuickActions>
        <Link to="/cattle" className="btn btn-primary">View cattle</Link>
        <Link to="/cattle/add" className="btn btn-outline">Add cattle</Link>
      </QuickActions>
    </div>
  );
};

export default ManagerDashboard;

import React from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';
import { herdStats, DashboardHeader, StatCard, CattleListCard, QuickActions } from './widgets';

// Daily-rounds view. Assigned tasks and milking entry land with their own branches.
const WorkerDashboard = () => {
  const { cattle, loading, error } = useCattle();
  const s = herdStats(cattle);

  return (
    <div className="container">
      <DashboardHeader tagline="Register animals and check the herd during your rounds." />
      {error && <div className="alert alert-error">{error}</div>}

      <QuickActions>
        <Link to="/cattle/add" className="btn btn-primary">Add cattle</Link>
        <Link to="/cattle" className="btn btn-outline">View cattle</Link>
      </QuickActions>

      <div className="stat-grid">
        <StatCard label="Cattle in herd" value={s.total} loading={loading} />
        <StatCard label="Need attention" value={s.needAttention.length} loading={loading} hint="Report these to the vet" />
      </div>

      <div className="dash-grid">
        <CattleListCard
          title="Keep an eye on"
          cattle={s.needAttention.slice(0, 5)}
          loading={loading}
          empty="Every animal is in Good or Excellent health."
        />
        <CattleListCard title="Recently registered" cattle={s.recent} loading={loading} empty="No cattle registered yet." />
      </div>
    </div>
  );
};

export default WorkerDashboard;

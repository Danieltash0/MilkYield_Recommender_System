import React from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';
import { herdStats, DashboardHeader, StatCard, HealthBreakdown, CattleListCard, QuickActions, HerdYieldCard } from './widgets';

// Herd operations view. Task assignment widgets land with their own branch.
const ManagerDashboard = () => {
  const { cattle, loading, error } = useCattle();
  const s = herdStats(cattle);

  return (
    <div className="container">
      <DashboardHeader tagline="Keep the herd records accurate and the team on task." />
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <StatCard label="Cattle in herd" icon="tag" value={s.total} loading={loading} />
        <StatCard label="Milking herd" icon="drop" value={s.cows} loading={loading} hint="Cows" />
        <StatCard label="Need attention" icon="pulse" value={s.needAttention.length} loading={loading} hint="Health rated Fair or Poor" />
      </div>

      <div className="dash-grid">
        <HerdYieldCard />
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
        <Link to="/milking/trends" className="btn btn-outline">Yield trends</Link>
      </QuickActions>
    </div>
  );
};

export default ManagerDashboard;

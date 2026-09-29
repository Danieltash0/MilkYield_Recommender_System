import React from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';
import { herdStats, DashboardHeader, StatCard, HealthBreakdown, CattleListCard, QuickActions } from './widgets';

// Health-first view. Health records and appointments land with feat/vet-health.
const VetDashboard = () => {
  const { cattle, loading, error } = useCattle();
  const s = herdStats(cattle);

  return (
    <div className="container">
      <DashboardHeader tagline="Review the herd and keep health histories up to date." />
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <StatCard label="Poor health" value={s.byHealth.Poor} loading={loading} hint="Check these first" />
        <StatCard label="Fair health" value={s.byHealth.Fair} loading={loading} />
        <StatCard label="Cattle in herd" value={s.total} loading={loading} />
      </div>

      <div className="dash-grid">
        <CattleListCard
          title="Animals to examine"
          cattle={s.needAttention}
          loading={loading}
          empty="No animals are rated Fair or Poor."
        />
        <HealthBreakdown byHealth={s.byHealth} total={s.total} />
      </div>

      <QuickActions>
        <Link to="/cattle" className="btn btn-primary">View cattle</Link>
      </QuickActions>
    </div>
  );
};

export default VetDashboard;

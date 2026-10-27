import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';
import { useYieldTrend, useYieldAlerts } from '../../api/useRecommendations';
import YieldTrendChart from '../../components/YieldTrendChart';
import '../../styles/tables.css';
import '../../styles/milking.css';
import '../../styles/charts.css';

const PERIODS = [14, 30, 60, 90, 180];
// The alerts API looks back at most 90 days
const MAX_ALERT_DAYS = 90;

const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString();
const round1 = (n) => Math.round(n * 10) / 10;
const STATUS_CLASS = { low: 'health health-poor', high: 'health health-fair' };

// Herd-wide expected vs actual milk, filterable by breed and cow, with the
// low and high readings behind the red and orange dots
const YieldTrends = () => {
  const [filters, setFilters] = useState({ days: 30, breed: '', cattle_id: '' });
  const { cattle } = useCattle();
  const cows = cattle.filter((c) => c.category === 'Cow');
  const breeds = [...new Set(cows.map((c) => c.breed).filter(Boolean))].sort();
  const cowChoices = filters.breed ? cows.filter((c) => c.breed === filters.breed) : cows;

  const trend = useYieldTrend({ days: filters.days, cattleId: filters.cattle_id, breed: filters.breed });
  const alertDays = Math.min(filters.days, MAX_ALERT_DAYS);
  const { alerts, loading: alertsLoading, error: alertsError } = useYieldAlerts(alertDays);

  const setFilter = (e) => {
    const { name, value } = e.target;
    const next = { ...filters, [name]: name === 'days' ? Number(value) : value };
    // A cow outside the chosen breed would give an empty chart
    if (name === 'breed') next.cattle_id = '';
    setFilters(next);
  };

  const breedOf = Object.fromEntries(cows.map((c) => [c.cattle_id, c.breed]));
  const shownAlerts = alerts.filter(
    (a) => (!filters.cattle_id || String(a.cattle_id) === String(filters.cattle_id)) &&
      (!filters.breed || breedOf[a.cattle_id] === filters.breed)
  );

  const actual = round1(trend.series.reduce((s, d) => s + (d.actual || 0), 0));
  const expected = round1(trend.series.reduce((s, d) => s + d.expected, 0));
  const pct = expected ? Math.round((actual / expected) * 100) : null;
  const flagged = trend.series.reduce((s, d) => s + d.low + d.high, 0);
  const statValue = (v) => (trend.loading ? '…' : v);

  const scope = filters.cattle_id
    ? (cows.find((c) => String(c.cattle_id) === String(filters.cattle_id)) || {}).name || 'Selected cow'
    : filters.breed ? `${filters.breed} cows` : 'Whole herd';

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Yield trends</h1>
          <p className="muted">Milk each day against what the recommender expected. {scope}, last {filters.days} days.</p>
        </div>
        <Link to="/milking" className="btn btn-outline">Back to milking</Link>
      </div>

      <div className="toolbar">
        <select name="days" value={filters.days} onChange={setFilter} aria-label="Period">
          {PERIODS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
        <select name="breed" value={filters.breed} onChange={setFilter} aria-label="Filter by breed">
          <option value="">All breeds</option>
          {breeds.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select name="cattle_id" value={filters.cattle_id} onChange={setFilter} aria-label="Filter by cow">
          <option value="">All cows</option>
          {cowChoices.map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.name || 'Unnamed'} · {c.tag_number}</option>)}
        </select>
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <span className="stat-label">Actual</span>
          <span className="stat-value">{statValue(`${actual} L`)}</span>
          <span className="muted">Judged milkings in the period</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Expected</span>
          <span className="stat-value">{statValue(`${expected} L`)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Of expected</span>
          <span className="stat-value">{statValue(pct === null ? '—' : `${pct}%`)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Low or high readings</span>
          <span className="stat-value">{statValue(flagged)}</span>
        </div>
      </div>

      <div className="card">
        <h3>Daily yield: actual vs expected</h3>
        <YieldTrendChart
          {...trend}
          height={340}
          perCow={Boolean(filters.cattle_id)}
          empty="No judged milkings match these filters. Milkings are judged when they are saved; run npm run backfill:predictions for older records."
        />
      </div>

      <h2>Low and high readings{filters.days > MAX_ALERT_DAYS ? ` · last ${MAX_ALERT_DAYS} days` : ''}</h2>
      {alertsError && <div className="alert alert-error">{alertsError}</div>}
      {alertsLoading ? (
        <p className="muted">Loading…</p>
      ) : shownAlerts.length === 0 ? (
        <div className="card empty"><p>No low or high readings in this period.</p></div>
      ) : (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Session</th><th>Cow</th><th>Expected</th><th>Actual</th><th>Status</th><th>Note</th></tr>
            </thead>
            <tbody>
              {shownAlerts.map((a) => (
                <tr key={a.prediction_id}>
                  <td>{fmtDate(a.milking_date)}</td>
                  <td>{a.session}</td>
                  <td><Link to={`/cattle/${a.cattle_id}`}>{a.cattle_name || 'Unnamed'}</Link> <span className="muted">{a.cattle_tag}</span></td>
                  <td>{a.expected_litres} L</td>
                  <td>{a.actual_litres} L</td>
                  <td><span className={STATUS_CLASS[a.status]}>{a.status === 'low' ? 'Low' : 'High'}</span></td>
                  <td style={{ whiteSpace: 'normal', minWidth: '16rem' }}>{a.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default YieldTrends;

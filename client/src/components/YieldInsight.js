import React, { useState } from 'react';
import { useYieldInsight, useYieldTrend } from '../api/useRecommendations';
import YieldTrendChart from './YieldTrendChart';
import '../styles/tables.css';

const METHODS = {
  neural_net: 'Neural network model',
  linear_regression: 'Linear regression model',
  moving_average: 'Average of recent sessions',
  knowledge_graph: 'Knowledge graph (little history yet)',
  breed_baseline: 'Breed average (little history yet)'
};

const STATUS = { normal: 'Normal', low: 'Low', high: 'High', suppressed: 'No alert' };
const statusClass = { normal: 'health health-good', low: 'health health-poor', high: 'health health-fair', suppressed: 'health health-fair' };

const known = (v, unit = '') => (v === null || v === undefined ? '—' : `${v}${unit}`);

export const TREND_PERIODS = [14, 30, 60, 90];

// Daily expected vs actual for one cow, with a period picker
const CowTrend = ({ cattleId }) => {
  const [days, setDays] = useState(30);
  const trend = useYieldTrend({ days, cattleId });
  return (
    <div className="yield-trend">
      <div className="chart-header">
        <h3>Daily yield: actual vs expected</h3>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Chart period">
          {TREND_PERIODS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>
      <YieldTrendChart {...trend} perCow empty="No judged milkings for this cow in this period yet." />
    </div>
  );
};

// "Yield insight" card on a cow's profile: next-session forecast and recent judgements
const YieldInsight = ({ cattleId }) => {
  const { data, loading, error } = useYieldInsight(cattleId);

  if (loading) return <div className="card"><p className="muted">Loading yield insight…</p></div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const { forecast, judgements } = data;
  const f = forecast.factors;
  const kg = forecast.knowledge_graph;
  const health = f.flags.sick ? 'Recent illness or injury' : f.flags.inTreatment ? 'Under treatment' : 'No recent illness';

  return (
    <div className="card">
      <h2>Yield insight</h2>
      <dl className="details">
        <div>
          <dt>Expected next session</dt>
          <dd>{forecast.expected === null ? 'Not enough data yet' : `${forecast.expected} L`}</dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd>
            {METHODS[forecast.method] || '—'}
            {forecast.method === 'moving_average' && ` (${forecast.history_used} sessions)`}
          </dd>
        </div>
        <div><dt>Days in milk</dt><dd>{known(f.days_in_milk)}</dd></div>
        <div><dt>Parity</dt><dd>{known(f.parity)}</dd></div>
        <div><dt>Days pregnant</dt><dd>{f.days_pregnant ? f.days_pregnant : 'Not pregnant'}</dd></div>
        <div><dt>Concentrate today</dt><dd>{known(f.concentrate_kg, ' kg')}</dd></div>
        <div><dt>Breed baseline</dt><dd>{f.baseline_per_session === null ? '—' : `${f.baseline_per_session} L per session (${f.baseline_breed})`}</dd></div>
        <div><dt>Health</dt><dd>{health}</dd></div>
      </dl>

      <CowTrend cattleId={cattleId} />

      {kg && (
        <div className="table-card">
          <h3>Profile-based estimate (knowledge graph)</h3>
          <p className="muted">
            {kg.breed} average of {kg.baseline_per_session} L per session
            {kg.applied.length ? ', adjusted for what is known about this cow' : ', no adjustments apply'}
            {' '}gives <strong>{kg.expected} L</strong>
            {forecast.method !== 'knowledge_graph' && ' (used only while a cow has fewer than 3 records)'}.
            {kg.clamped && ' The combined adjustment was capped to stay plausible.'}
          </p>
          {kg.applied.length > 0 && (
            <table className="data-table">
              <thead>
                <tr><th>Condition</th><th>Because</th><th>Multiplier</th><th>Source</th></tr>
              </thead>
              <tbody>
                {kg.applied.map((a) => (
                  <tr key={a.key}>
                    <td>{a.label}</td>
                    <td>{a.attribute.replace(/_/g, ' ')} = {a.value}</td>
                    <td>×{a.multiplier}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: '14rem' }}>{a.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {judgements.length > 0 && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Session</th><th>Expected</th><th>Actual</th><th>Status</th><th>Note</th></tr>
            </thead>
            <tbody>
              {judgements.map((j) => (
                <tr key={j.prediction_id}>
                  <td>{j.milking_date}</td>
                  <td>{j.session}</td>
                  <td>{j.expected_litres} L</td>
                  <td>{known(j.actual_litres, ' L')}</td>
                  <td><span className={statusClass[j.status]}>{STATUS[j.status]}</span></td>
                  <td style={{ whiteSpace: 'normal', minWidth: '16rem' }}>{j.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default YieldInsight;

import React, { useState } from 'react';
import { useYieldInsight, useYieldTrend, useYieldProjection } from '../api/useRecommendations';
import YieldTrendChart from './YieldTrendChart';
import YieldProjectionChart from './YieldProjectionChart';
import '../styles/tables.css';
import '../styles/charts.css';

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

const PROJECTION_PERIODS = [30, 60];
const niceDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Expected daily yield over the next one or two months, along the lactation curve
const CowProjection = ({ cattleId }) => {
  const [days, setDays] = useState(60);
  const { projection: p, loading, error } = useYieldProjection(cattleId, days);
  return (
    <div className="yield-trend">
      <div className="chart-header">
        <h3>Projected yield</h3>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Projection period">
          {PROJECTION_PERIODS.map((d) => <option key={d} value={d}>Next {d} days</option>)}
        </select>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {!error && loading && <p className="muted chart-placeholder" style={{ height: 280 }}>Loading projection…</p>}
      {!error && !loading && p && !p.available && <p className="muted">{p.note}</p>}
      {!error && !loading && p && p.available && (
        <>
          <p className="projection-summary">
            About <strong>{p.daily_level} L a day</strong> now
            {' '}→ <strong>{p.series[p.series.length - 1].expected} L a day</strong> by {niceDate(p.series[p.series.length - 1].date)}
            {' '}({p.change_pct > 0 ? '+' : ''}{p.change_pct}%).
            {p.months.map((m, i) => (
              <span key={m.from}>
                {' '}{i === 0 ? 'Next 30 days' : 'The 30 days after'}: about {m.avg_daily} L a day, {m.total} L in total.
              </span>
            ))}
          </p>
          <YieldProjectionChart projection={p} />
          <div className="projection-notes muted">
            <p>
              Follows the lactation curve{p.days_pregnant ? ' and her pregnancy' : ''} from her current level
              ({METHODS[p.method] ? METHODS[p.method].toLowerCase() : 'recent records'}). It assumes:
            </p>
            <ul>{p.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
            <p>
              Typical error: about 5–7% for a single day on test data, but expect up to about 15% on real cows
              a month or more ahead. Monthly averages are more reliable than single days.
            </p>
          </div>
        </>
      )}
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
          <dd>
            {forecast.expected === null ? 'Not enough data yet' : `${forecast.expected} L`}
            {forecast.range && (
              <span className="muted"> · normal range {forecast.range.low}–{forecast.range.high} L</span>
            )}
          </dd>
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
        <div>
          <dt>Concentrate today</dt>
          <dd>
            {known(f.concentrate_kg, ' kg')}
            {f.usual_concentrate_kg !== null && f.usual_concentrate_kg !== undefined && (
              <span className="muted"> · usually {f.usual_concentrate_kg} kg</span>
            )}
          </dd>
        </div>
        <div><dt>Breed baseline</dt><dd>{f.baseline_per_session === null ? '—' : `${f.baseline_per_session} L per session (${f.baseline_breed})`}</dd></div>
        <div><dt>Health</dt><dd>{health}</dd></div>
      </dl>

      {forecast.advice && forecast.advice.length > 0 && (
        <div className="alert alert-warning yield-advice" role="status">
          <strong>Before the next milking:</strong>
          <ul>
            {forecast.advice.map((t) => <li key={t.code}>{t.text}</li>)}
          </ul>
        </div>
      )}

      <CowTrend cattleId={cattleId} />

      <CowProjection cattleId={cattleId} />

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
                  <td>
                    {j.expected_litres} L
                    {j.expected_range && (
                      <div className="muted">{j.expected_range.low}–{j.expected_range.high} L</div>
                    )}
                  </td>
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

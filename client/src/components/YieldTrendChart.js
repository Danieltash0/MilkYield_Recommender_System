import React from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import '../styles/charts.css';

// The recommender flags readings outside 80-120% of expected (server/services/recommender.js)
const LOW = 0.8;
const HIGH = 1.2;

// SVG attributes do not resolve CSS variables, so the palette is repeated here
// (values from styles/variables.css)
export const COLORS = {
  actual: '#15803d',
  expected: '#5b6b62',
  band: '#bbf7d0',
  low: '#dc2626',
  high: '#ea580c',
  grid: '#e2e8e4',
  projected: '#7c3aed',
  projectedBand: '#ddd6fe'
};

const round = (n) => Math.round(n * 100) / 100;
const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fullDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const toPoints = (series) =>
  series.map((d) => ({ ...d, label: shortDate(d.date), band: [round(d.expected * LOW), round(d.expected * HIGH)] }));

// Days after today from a projection (GET /recommendations/projection), drawn after the history
const toFuturePoints = (projection) =>
  (projection ? projection.series : []).map((d) => ({
    date: d.date,
    label: shortDate(d.date),
    future: true,
    actual: null,
    projected: d.expected,
    projectedBand: [d.low, d.high],
    cowsMilking: d.cows_milking
  }));

// Actual-yield dots: red on days with a low reading, orange with a high one
const AlertDot = ({ cx, cy, payload, index }) => {
  if (cx === undefined || cy === undefined || payload.actual === null) return null;
  const flagged = payload.low > 0 || payload.high > 0;
  const fill = payload.low > 0 ? COLORS.low : payload.high > 0 ? COLORS.high : COLORS.actual;
  return <circle key={`dot-${index}`} cx={cx} cy={cy} r={flagged ? 5 : 3} fill={fill} stroke="#fff" strokeWidth={1} />;
};

const TrendTooltip = ({ active, payload, perCow }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  if (d.today) {
    return (
      <div className="chart-tooltip">
        <strong>{fullDate(d.date)} (today)</strong>
        <div className="muted">No judged milkings yet</div>
      </div>
    );
  }
  if (d.future) {
    return (
      <div className="chart-tooltip">
        <strong>{fullDate(d.date)}</strong>
        <div>Projected: {d.projected} L</div>
        <div className="muted">Likely between {d.projectedBand[0]} and {d.projectedBand[1]} L</div>
        {!perCow && <div className="muted">{d.cowsMilking} cow{d.cowsMilking === 1 ? '' : 's'} milking</div>}
      </div>
    );
  }
  const pct = d.expected ? Math.round((d.actual / d.expected) * 100) : null;
  return (
    <div className="chart-tooltip">
      <strong>{fullDate(d.date)}</strong>
      <div>Actual: {d.actual} L</div>
      <div>Expected: {d.expected} L{pct !== null && ` (${pct}%)`}</div>
      <div className="muted">
        {perCow ? `${d.sessions} milking${d.sessions === 1 ? '' : 's'}` : `${d.cows} cow${d.cows === 1 ? '' : 's'}, ${d.sessions} milkings`}
      </div>
      {d.low > 0 && <div className="chart-tooltip-low">{d.low} low reading{d.low === 1 ? '' : 's'}</div>}
      {d.high > 0 && <div className="chart-tooltip-high">{d.high} high reading{d.high === 1 ? '' : 's'}</div>}
      {d.suppressed > 0 && <div className="muted">{d.suppressed} out of range but explained by health or calving</div>}
    </div>
  );
};

// Expected vs actual litres per day, with the normal band the recommender uses.
// series: [{ date, expected, actual, cows, sessions, low, high, suppressed }]
// projection (optional): the coming days, drawn after today as a projected line and range
const YieldTrendChart = ({ series, loading, error, height = 300, compact = false, perCow = false, empty, projection = null }) => {
  if (error) return <div className="alert alert-error">{error}</div>;
  if (loading) return <p className="muted chart-placeholder" style={{ height }}>Loading chart…</p>;
  const future = toFuturePoints(projection);
  if (!series.length && !future.length) {
    return (
      <p className="muted chart-placeholder" style={{ height }}>
        {empty || 'No judged milkings in this period yet.'}
      </p>
    );
  }

  const points = toPoints(series);
  const actual = round(points.reduce((s, p) => s + (p.actual || 0), 0));
  const expected = round(points.reduce((s, p) => s + p.expected, 0));
  const alerts = points.reduce((s, p) => s + p.low + p.high, 0);
  // Today, where the projection starts; a blank point when no milking is judged yet
  const today = projection && projection.as_of;
  const todayPoint = today && !points.some((p) => p.date === today)
    ? [{ date: today, label: shortDate(today), today: true, actual: null }]
    : [];
  const lastFuture = future[future.length - 1];
  const projectedText = lastFuture ? ` Projected ${lastFuture.projected} L a day by ${lastFuture.label}.` : '';

  return (
    <div
      className="yield-chart"
      role="img"
      aria-label={`Milk yield over ${points.length} days: ${actual} L actual against ${expected} L expected, ${alerts} low or high readings.${projectedText}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={[...points, ...todayPoint, ...future]} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={16} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 12 }} width={compact ? 40 : 52} unit=" L" allowDecimals />
          <Tooltip content={<TrendTooltip perCow={perCow} />} />
          {!compact && <Legend wrapperStyle={{ fontSize: 13 }} />}
          <Area
            dataKey="band"
            name="Normal range (80–120% of expected)"
            fill={COLORS.band}
            fillOpacity={0.5}
            stroke="none"
            isAnimationActive={false}
          />
          <Line
            dataKey="expected"
            name="Expected"
            stroke={COLORS.expected}
            strokeDasharray="5 4"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="actual"
            name="Actual"
            stroke={COLORS.actual}
            strokeWidth={2.5}
            dot={<AlertDot />}
            activeDot={{ r: 6 }}
            connectNulls
            isAnimationActive={false}
          />
          {future.length > 0 && (
            <Area
              dataKey="projectedBand"
              name="Likely range ahead"
              fill={COLORS.projectedBand}
              fillOpacity={0.6}
              stroke="none"
              isAnimationActive={false}
            />
          )}
          {future.length > 0 && (
            <Line
              dataKey="projected"
              name="Projected"
              stroke={COLORS.projected}
              strokeDasharray="6 4"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          )}
          {future.length > 0 && today && (
            <ReferenceLine
              x={shortDate(today)}
              stroke={COLORS.expected}
              strokeDasharray="2 3"
              label={{ value: 'Today', position: 'insideTopRight', fontSize: 12, fill: COLORS.expected }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {!compact && (
        <p className="muted chart-note">
          <span className="chart-key chart-key-low" /> day with a low reading
          <span className="chart-key chart-key-high" /> day with a high reading
        </p>
      )}
    </div>
  );
};

export default YieldTrendChart;

import React from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import { COLORS } from './YieldTrendChart';
import '../styles/charts.css';

const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fullDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const ProjectionTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{fullDate(d.date)}</strong>
      {d.dry ? (
        <div>Dry (not milked)</div>
      ) : (
        <>
          <div>Expected: {d.expected} L/day</div>
          <div className="muted">Likely between {d.low} and {d.high} L</div>
        </>
      )}
      <div className="muted">
        Day {d.days_in_milk} of lactation{d.days_pregnant ? `, ${d.days_pregnant} days pregnant` : ''}
      </div>
    </div>
  );
};

// Expected litres per day over the coming weeks, along the lactation curve.
// projection: the `projection` object from GET /recommendations/cattle/:id/projection
const YieldProjectionChart = ({ projection, height = 280 }) => {
  const points = projection.series.map((d) => ({ ...d, label: shortDate(d.date), band: [d.low, d.high] }));
  const last = points[points.length - 1];
  const markers = projection.events.map((e, i) => ({ ...e, n: i + 1, when: shortDate(e.date) }));

  return (
    <div
      className="yield-chart"
      role="img"
      aria-label={`Projected milk yield for the next ${points.length} days: from ${projection.daily_level} L a day now to ${last.expected} L a day on ${shortDate(last.date)}.`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={16} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 12 }} width={52} unit=" L" allowDecimals />
          <Tooltip content={<ProjectionTooltip />} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Area dataKey="band" name="Likely range" fill={COLORS.band} fillOpacity={0.5} stroke="none" isAnimationActive={false} />
          <Line
            dataKey="expected"
            name="Projected L/day"
            stroke={COLORS.actual}
            strokeDasharray="6 4"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          {markers.map((m) => (
            <ReferenceLine
              key={m.n}
              x={m.when}
              stroke={COLORS.expected}
              strokeDasharray="2 3"
              label={{ value: String(m.n), position: 'top', fontSize: 12, fill: COLORS.expected }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      {markers.length > 0 && (
        <ol className="projection-events">
          {markers.map((m) => (
            <li key={m.n}>{m.when}: {m.label}</li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default YieldProjectionChart;

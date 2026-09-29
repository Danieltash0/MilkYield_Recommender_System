import React from 'react';

// Simple vertical bar chart: bars = [{ key, label, value, title, highlight }]
const MilkBars = ({ bars, unit = 'L', empty = 'No data yet.' }) => {
  if (!bars.length) return <p className="muted">{empty}</p>;
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="milk-bars" role="img" aria-label={bars.map((b) => `${b.label}: ${b.value} ${unit}`).join(', ')}>
      {bars.map((b) => (
        <div className="milk-bar" key={b.key} title={b.title || `${b.label}: ${b.value} ${unit}`}>
          <span className="milk-bar-value">{b.value}</span>
          <div className="milk-bar-track">
            <div
              className={`milk-bar-fill${b.highlight ? ' highlight' : ''}`}
              style={{ height: `${(b.value / max) * 100}%` }}
            />
          </div>
          <span className="milk-bar-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
};

export default MilkBars;

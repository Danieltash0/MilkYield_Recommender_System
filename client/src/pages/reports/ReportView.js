import React from 'react';
import { formatCell, exportReportPdf } from '../../utils/reportPdf';

// On-screen preview of a report ({ report, data }) with its PDF download
const ReportView = ({ result, onClose }) => {
  const { report, data } = result;
  return (
    <div className="card report-view">
      <div className="report-head">
        <div>
          <h2>{report.title}</h2>
          <p className="muted">Figures rebuilt from current records{report.generated_by_name ? ` · requested by ${report.generated_by_name}` : ''}</p>
        </div>
        <div className="card-actions">
          <button className="btn btn-primary" onClick={() => exportReportPdf(result)}>Download PDF</button>
          {onClose && <button className="btn btn-secondary" onClick={onClose}>Close</button>}
        </div>
      </div>

      <div className="report-summary">
        {data.summary.map((s) => (
          <div key={s.label}>
            <span className="stat-label">{s.label}</span>
            <strong>{formatCell(s.value, s.money)}</strong>
          </div>
        ))}
      </div>

      {data.sections.map((section) => {
        const money = section.money || [];
        return (
          <section key={section.title} className="report-section">
            <h3>{section.title}</h3>
            {section.rows.length === 0 ? (
              <p className="muted">No entries in this period.</p>
            ) : (
              <div className="table-card">
                <table className="data-table">
                  <thead>
                    <tr>{section.columns.map((c, i) => <th key={c} className={money.includes(i) ? 'num' : undefined}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((v, i) => (
                          <td key={i} className={money.includes(i) ? 'num' : undefined}>{formatCell(v, money.includes(i))}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default ReportView;

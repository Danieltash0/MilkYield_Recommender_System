import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFinance, useFinanceSummary } from '../../api/useFinance';
import { formatMoney } from '../../utils/money';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { localDate } from './FinanceForm';
import '../../styles/tables.css';
import '../../styles/finance.css';

// Period presets -> { from, to }
const PERIODS = {
  month: { label: 'This month', range: () => { const d = new Date(); return { from: localDate(new Date(d.getFullYear(), d.getMonth(), 1)), to: localDate(d) }; } },
  d30: { label: 'Last 30 days', range: () => { const d = new Date(); d.setDate(d.getDate() - 29); return { from: localDate(d), to: localDate() }; } },
  d90: { label: 'Last 90 days', range: () => { const d = new Date(); d.setDate(d.getDate() - 89); return { from: localDate(d), to: localDate() }; } },
  year: { label: 'This year', range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: localDate() }) },
  all: { label: 'All time', range: () => ({ from: '', to: '' }) }
};

const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString();
const fmtMonth = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

const MonthBars = ({ months }) => {
  if (!months.length) return <p className="muted">No transactions in this period.</p>;
  const max = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);
  return (
    <div className="month-bars">
      {months.map((m) => (
        <div className="month" key={m.month} title={`${fmtMonth(m.month)}: in ${formatMoney(m.income)}, out ${formatMoney(m.expense)}`}>
          <div className="month-pair">
            <div className="bar income" style={{ height: `${(m.income / max) * 100}%` }} />
            <div className="bar expense" style={{ height: `${(m.expense / max) * 100}%` }} />
          </div>
          <span className="month-label">{fmtMonth(m.month)}</span>
        </div>
      ))}
    </div>
  );
};

const Finance = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('d90');
  const [type, setType] = useState('');
  const range = PERIODS[period].range();
  const { records, loading, error, deleteRecord } = useFinance({ ...range, type });
  const { data: summary, reload: reloadSummary } = useFinanceSummary(range);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const confirmDelete = async () => {
    setDeleting(true);
    const result = await deleteRecord(toDelete.record_id);
    setDeleting(false);
    if (result.success) {
      setToDelete(null);
      setDeleteError('');
      reloadSummary();
    } else {
      setDeleteError(result.error);
    }
  };

  const expenseCategories = summary ? summary.by_category.filter((c) => c.record_type === 'Expense') : [];
  const topExpense = Math.max(...expenseCategories.map((c) => c.total), 1);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Finance</h1>
          <p className="muted">Farm income and expenses.</p>
        </div>
        <div className="card-actions">
          <Link to="/reports" className="btn btn-outline">Reports</Link>
          <Link to="/finance/add" className="btn btn-primary">New transaction</Link>
        </div>
      </div>

      <div className="toolbar">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
          {Object.entries(PERIODS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">Income and expenses</option>
          <option value="Income">Income only</option>
          <option value="Expense">Expenses only</option>
        </select>
      </div>

      <div className="stat-grid">
        <div className="card stat"><span className="stat-label">Income</span><span className="stat-value money-in">{summary ? formatMoney(summary.income) : '…'}</span></div>
        <div className="card stat"><span className="stat-label">Expenses</span><span className="stat-value money-out">{summary ? formatMoney(summary.expense) : '…'}</span></div>
        <div className="card stat">
          <span className="stat-label">Net</span>
          <span className={`stat-value ${summary && summary.net < 0 ? 'money-out' : 'money-in'}`}>{summary ? formatMoney(summary.net) : '…'}</span>
        </div>
      </div>

      <div className="finance-overview">
        <div className="card">
          <h3>Monthly cash flow</h3>
          <div className="legend"><span className="dot income" /> Income <span className="dot expense" /> Expenses</div>
          <MonthBars months={summary ? summary.by_month : []} />
        </div>
        <div className="card">
          <h3>Where the money goes</h3>
          {expenseCategories.length === 0 ? (
            <p className="muted">No expenses in this period.</p>
          ) : (
            <ul className="category-bars">
              {expenseCategories.map((c) => (
                <li key={c.category}>
                  <div className="category-row"><span>{c.category}</span><strong>{formatMoney(c.total)}</strong></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.total / topExpense) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {deleteError && <div className="alert alert-error">{deleteError}</div>}

      {loading ? (
        <Loader />
      ) : records.length === 0 ? (
        <div className="card empty"><p>No transactions in this period.</p></div>
      ) : (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Description</th><th className="num">Amount</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.record_id}>
                  <td>{fmtDate(r.record_date)}</td>
                  <td>{r.category}</td>
                  <td>
                    {r.description || '—'}
                    {r.cattle_id && <> · <Link to={`/cattle/${r.cattle_id}`}>{r.cattle_name || r.cattle_tag}</Link></>}
                  </td>
                  <td className={`num ${r.record_type === 'Income' ? 'money-in' : 'money-out'}`}>
                    {r.record_type === 'Income' ? '+' : '−'}{formatMoney(r.amount)}
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/finance/${r.record_id}/edit`)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => { setDeleteError(''); setToDelete(r); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toDelete && (
        <Modal title="Delete transaction" confirmText="Delete" loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete}>
          <p>
            Delete the {toDelete.category.toLowerCase()} {toDelete.record_type.toLowerCase()} of{' '}
            <strong>{formatMoney(toDelete.amount)}</strong> on {fmtDate(toDelete.record_date)}?
          </p>
        </Modal>
      )}
    </div>
  );
};

export default Finance;

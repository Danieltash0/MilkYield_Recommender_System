import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceCategories } from '../../api/useFinance';
import { useCattle } from '../../api/useCattle';
import { CURRENCY } from '../../utils/money';

// Local date as YYYY-MM-DD (toISOString would give the UTC date)
export const localDate = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const emptyFinance = () => ({
  record_type: 'Expense',
  category: '',
  amount: '',
  record_date: localDate(),
  description: '',
  cattle_id: ''
});

// Shared by AddFinance and EditFinance
const FinanceForm = ({ initial, onSubmit, submitLabel }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const categories = useFinanceCategories();
  const { cattle } = useCattle();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  // Categories differ per type, so switching type clears the category
  const setType = (record_type) => setForm({ ...form, record_type, category: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const result = await onSubmit({
      ...form,
      amount: Number(form.amount),
      cattle_id: form.cattle_id ? Number(form.cattle_id) : null
    });
    if (!result.success) {
      setError(result.error || 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="form-group">
        <span className="label">Type</span>
        <div className="type-toggle" role="radiogroup" aria-label="Type">
          {['Income', 'Expense'].map((t) => (
            <button
              type="button"
              key={t}
              role="radio"
              aria-checked={form.record_type === t}
              className={`${t.toLowerCase()}${form.record_type === t ? ' active' : ''}`}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" value={form.category} onChange={handleChange} required>
            <option value="">Select a category</option>
            {(categories[form.record_type] || []).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="amount">Amount ({CURRENCY})</label>
          <input id="amount" name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={handleChange} required />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="record_date">Date</label>
          <input id="record_date" name="record_date" type="date" value={form.record_date} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="cattle_id">Related animal (optional)</label>
          <select id="cattle_id" name="cattle_id" value={form.cattle_id} onChange={handleChange}>
            <option value="">None</option>
            {cattle.map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.name || 'Unnamed'} · {c.tag_number}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <input id="description" name="description" maxLength={255} value={form.description} onChange={handleChange} placeholder="e.g. Dairy meal, 20 bags" />
      </div>

      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <Link to="/finance" className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
};

export default FinanceForm;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';

export const SESSION_OPTIONS = ['Morning', 'Afternoon', 'Evening'];

// Local date as YYYY-MM-DD (toISOString would give the UTC date)
export const localDate = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const emptyRecord = () => ({
  cattle_id: '',
  milking_date: localDate(),
  session: new Date().getHours() < 12 ? 'Morning' : 'Evening',
  quantity: '',
  fat_percentage: '',
  notes: ''
});

// Shared by LogMilking and EditMilking
const MilkingForm = ({ initial, onSubmit, submitLabel, keepOpen = false }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const { cattle } = useCattle();
  const cows = cattle.filter((c) => c.gender === 'Female');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved('');
    const result = await onSubmit({
      ...form,
      cattle_id: Number(form.cattle_id),
      quantity: Number(form.quantity),
      fat_percentage: form.fat_percentage === '' ? null : Number(form.fat_percentage)
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || 'Something went wrong');
    } else if (keepOpen) {
      // Stay on the form so a worker can log the next cow straight away
      const cow = cows.find((c) => String(c.cattle_id) === String(form.cattle_id));
      setSaved(`Saved ${form.quantity} L for ${cow ? cow.name || cow.tag_number : 'cow'}.`);
      setForm({ ...form, cattle_id: '', quantity: '', fat_percentage: '', notes: '' });
    }
  };

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {saved && <div className="alert alert-success" role="status">{saved}</div>}

      <div className="form-group">
        <label htmlFor="cattle_id">Cow</label>
        <select id="cattle_id" name="cattle_id" value={form.cattle_id} onChange={handleChange} required>
          <option value="">Select a cow</option>
          {cows.map((c) => (
            <option key={c.cattle_id} value={c.cattle_id}>{c.name || 'Unnamed'} · {c.tag_number}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="milking_date">Date</label>
          <input id="milking_date" name="milking_date" type="date" max={localDate()} value={form.milking_date} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="session">Session</label>
          <select id="session" name="session" value={form.session} onChange={handleChange}>
            {SESSION_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="quantity">Quantity (litres)</label>
          <input id="quantity" name="quantity" type="number" min="0.1" max="60" step="0.1" value={form.quantity} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="fat_percentage">Fat % (optional)</label>
          <input id="fat_percentage" name="fat_percentage" type="number" min="0" max="15" step="0.1" value={form.fat_percentage} onChange={handleChange} />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} value={form.notes} onChange={handleChange} />
      </div>

      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <Link to="/milking" className="btn btn-secondary">{keepOpen ? 'Done' : 'Cancel'}</Link>
      </div>
    </form>
  );
};

export default MilkingForm;

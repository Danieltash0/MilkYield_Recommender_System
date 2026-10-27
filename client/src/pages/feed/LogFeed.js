import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';
import { useFeed } from '../../api/useFeed';
import { localDate } from '../milking/MilkingForm';
import '../../styles/tables.css';

const emptyFeed = () => ({ cattle_id: '', fed_on: localDate(), concentrate_kg: '', forage_kg: '', notes: '' });

// Daily feed per cow. Concentrate is one of the recommender's yield factors.
const LogFeed = () => {
  const { cattle } = useCattle();
  const cows = cattle.filter((c) => c.category === 'Cow');
  const { records, saveRecord } = useFeed({ from: localDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)) });
  const [form, setForm] = useState(emptyFeed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved('');
    const result = await saveRecord({
      ...form,
      cattle_id: Number(form.cattle_id),
      concentrate_kg: Number(form.concentrate_kg),
      forage_kg: form.forage_kg === '' ? null : Number(form.forage_kg)
    });
    setSaving(false);
    if (!result.success) return setError(result.error || 'Something went wrong');
    // Stay on the form so the next cow can be logged straight away
    const cow = cows.find((c) => String(c.cattle_id) === String(form.cattle_id));
    const name = cow ? cow.name || cow.tag_number : 'cow';
    setSaved(`${result.data.replaced ? 'Updated' : 'Saved'} ${form.concentrate_kg} kg concentrate for ${name} on ${form.fed_on}.`);
    setForm({ ...emptyFeed(), fed_on: form.fed_on });
  };

  return (
    <div className="container narrow">
      <div className="page-header">
        <div>
          <h1>Log feed</h1>
          <p className="muted">One entry per cow per day; saving the same day again replaces it.</p>
        </div>
      </div>

      <form className="card form-card" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {saved && <div className="alert alert-success" role="status">{saved}</div>}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cattle_id">Cow</label>
            <select id="cattle_id" name="cattle_id" value={form.cattle_id} onChange={handleChange} required>
              <option value="">Select a cow</option>
              {cows.map((c) => (
                <option key={c.cattle_id} value={c.cattle_id}>{c.name || 'Unnamed'} · {c.tag_number}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="fed_on">Date</label>
            <input id="fed_on" name="fed_on" type="date" max={localDate()} value={form.fed_on} onChange={handleChange} required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="concentrate_kg">Concentrate (kg)</label>
            <input id="concentrate_kg" name="concentrate_kg" type="number" min="0" max="30" step="0.1" value={form.concentrate_kg} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="forage_kg">Forage (kg, optional)</label>
            <input id="forage_kg" name="forage_kg" type="number" min="0" max="150" step="0.1" value={form.forage_kg} onChange={handleChange} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes</label>
          <input id="notes" name="notes" maxLength={255} value={form.notes} onChange={handleChange} />
        </div>

        <div className="card-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save feed'}</button>
          <Link to="/milking" className="btn btn-secondary">Done</Link>
        </div>
      </form>

      {records.length > 0 && (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Cow</th><th>Concentrate</th><th>Forage</th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.feed_id}>
                  <td>{r.fed_on}</td>
                  <td>{r.cattle_name || r.cattle_tag}</td>
                  <td>{r.concentrate_kg} kg</td>
                  <td>{r.forage_kg === null ? '—' : `${r.forage_kg} kg`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LogFeed;

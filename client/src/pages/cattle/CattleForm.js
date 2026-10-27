import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export const HEALTH_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
export const GENDER_OPTIONS = ['Female', 'Male'];
export const CATEGORY_OPTIONS = ['Calf', 'Heifer', 'Cow'];

export const emptyCattle = {
  tag_number: '',
  name: '',
  breed: '',
  health: 'Good',
  gender: 'Female',
  category: 'Cow',
  date_of_birth: '',
  last_calving_date: '',
  parity: '',
  conception_date: '',
  prev_lactation_yield_l: '',
  notes: ''
};

// Blank lactation fields are sent as null (not recorded)
const LACTATION_FIELDS = ['last_calving_date', 'parity', 'conception_date', 'prev_lactation_yield_l'];
const toPayload = (form) => ({
  ...form,
  ...Object.fromEntries(LACTATION_FIELDS.map((f) => [f, form[f] === '' || form[f] === undefined ? null : form[f]]))
});

// Shared by AddCattle and EditCattle
const CattleForm = ({ initial = emptyCattle, onSubmit, submitLabel, tagRequired = false }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toISOString().split('T')[0];

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Males are always Bull; switching back to Female restores a female category
    if (name === 'gender') return setForm({ ...form, gender: value, category: value === 'Male' ? 'Bull' : 'Cow' });
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const result = await onSubmit(toPayload(form));
    if (!result.success) {
      setError(result.error || 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="tag_number">Tag number{tagRequired ? '' : ' (auto-generated if blank)'}</label>
          <input id="tag_number" name="tag_number" value={form.tag_number} onChange={handleChange} required={tagRequired} />
        </div>
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} required />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="breed">Breed</label>
          <input id="breed" name="breed" value={form.breed} onChange={handleChange} placeholder="e.g. Holstein-Friesian, Jersey, Ayrshire" />
        </div>
        <div className="form-group">
          <label htmlFor="date_of_birth">Date of birth</label>
          <input id="date_of_birth" name="date_of_birth" type="date" max={today} value={form.date_of_birth} onChange={handleChange} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="gender">Gender</label>
          <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
            {GENDER_OPTIONS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" value={form.category} onChange={handleChange} disabled={form.gender === 'Male'}>
            {(form.gender === 'Male' ? ['Bull'] : CATEGORY_OPTIONS).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="health">Health status</label>
          <select id="health" name="health" value={form.health} onChange={handleChange}>
            {HEALTH_OPTIONS.map((h) => <option key={h}>{h}</option>)}
          </select>
        </div>
      </div>

      {/* Lactation details feed the milk yield recommender; all optional */}
      {form.category === 'Cow' && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="last_calving_date">Last calving date</label>
              <input id="last_calving_date" name="last_calving_date" type="date" min={form.date_of_birth || undefined} max={today} value={form.last_calving_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="parity">Parity (calvings so far)</label>
              <input id="parity" name="parity" type="number" min="0" max="20" step="1" value={form.parity} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="conception_date">Conception date (blank if not pregnant)</label>
              <input id="conception_date" name="conception_date" type="date" min={form.date_of_birth || undefined} max={today} value={form.conception_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="prev_lactation_yield_l">Previous lactation yield (litres)</label>
              <input id="prev_lactation_yield_l" name="prev_lactation_yield_l" type="number" min="0" max="20000" step="0.1" value={form.prev_lactation_yield_l} onChange={handleChange} />
            </div>
          </div>
        </>
      )}

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} value={form.notes} onChange={handleChange} />
      </div>

      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <Link to="/cattle" className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
};

export default CattleForm;

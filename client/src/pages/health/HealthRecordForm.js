import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';

export const RECORD_TYPES = ['Checkup', 'Treatment', 'Vaccination', 'Illness', 'Injury', 'Other'];
export const HEALTH_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor'];

// Local date as YYYY-MM-DD (toISOString would give the UTC date)
export const localDate = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const emptyHealthRecord = () => ({
  cattle_id: '',
  record_date: localDate(),
  record_type: 'Checkup',
  diagnosis: '',
  treatment: '',
  medication: '',
  health_status: '',
  next_checkup: '',
  notes: ''
});

// Shared by AddHealthRecord and EditHealthRecord
const HealthRecordForm = ({ initial, onSubmit, submitLabel }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { cattle } = useCattle();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const result = await onSubmit({ ...form, cattle_id: Number(form.cattle_id) });
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
          <label htmlFor="cattle_id">Cattle</label>
          <select id="cattle_id" name="cattle_id" value={form.cattle_id} onChange={handleChange} required>
            <option value="">Select an animal</option>
            {cattle.map((c) => (
              <option key={c.cattle_id} value={c.cattle_id}>{c.name || 'Unnamed'} · {c.tag_number}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="record_date">Date</label>
          <input id="record_date" name="record_date" type="date" max={localDate()} value={form.record_date} onChange={handleChange} required />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="record_type">Type</label>
          <select id="record_type" name="record_type" value={form.record_type} onChange={handleChange}>
            {RECORD_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="health_status">Health after this visit</label>
          <select id="health_status" name="health_status" value={form.health_status} onChange={handleChange}>
            <option value="">No change</option>
            {HEALTH_OPTIONS.map((h) => <option key={h}>{h}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="diagnosis">Diagnosis</label>
        <input id="diagnosis" name="diagnosis" maxLength={255} value={form.diagnosis} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label htmlFor="treatment">Treatment</label>
        <textarea id="treatment" name="treatment" rows={2} value={form.treatment} onChange={handleChange} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="medication">Medication</label>
          <input id="medication" name="medication" maxLength={255} value={form.medication} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label htmlFor="next_checkup">Next checkup</label>
          <input id="next_checkup" name="next_checkup" type="date" min={form.record_date} value={form.next_checkup} onChange={handleChange} />
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
        <Link to="/health" className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
};

export default HealthRecordForm;

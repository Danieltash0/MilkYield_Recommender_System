import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCattle } from '../../api/useCattle';
import { useVets } from '../../api/useHealth';

// Local 'YYYY-MM-DDTHH:MM' for <input type="datetime-local">
export const localDateTime = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const emptyAppointment = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return { cattle_id: '', vet_id: '', appointment_date: localDateTime(tomorrow), reason: '', notes: '' };
};

// Shared by AddAppointment and EditAppointment
const AppointmentForm = ({ initial, onSubmit, submitLabel, isNew = true }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { cattle } = useCattle();
  const vets = useVets();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const result = await onSubmit({
      ...form,
      cattle_id: Number(form.cattle_id),
      vet_id: form.vet_id ? Number(form.vet_id) : null
    });
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
          <label htmlFor="vet_id">Vet</label>
          <select id="vet_id" name="vet_id" value={form.vet_id} onChange={handleChange}>
            <option value="">Any available vet</option>
            {vets.map((v) => <option key={v.user_id} value={v.user_id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="appointment_date">Date and time</label>
          <input
            id="appointment_date"
            name="appointment_date"
            type="datetime-local"
            min={isNew ? localDateTime() : undefined}
            value={form.appointment_date}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="reason">Reason</label>
          <input id="reason" name="reason" maxLength={255} value={form.reason} onChange={handleChange} placeholder="e.g. Pregnancy check" required />
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
        <Link to="/appointments" className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
};

export default AppointmentForm;

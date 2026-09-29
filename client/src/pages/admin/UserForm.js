import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROLE_OPTIONS } from '../../api/useAdmin';

export const emptyUser = { name: '', email: '', role: 'worker', status: 'active', password: '' };

// Shared by AddUser and EditUser; the password field only appears for new accounts
const UserForm = ({ initial = emptyUser, onSubmit, submitLabel, isNew = false, isSelf = false }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { password, ...rest } = form;
    const result = await onSubmit(isNew ? form : rest);
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
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" maxLength={100} value={form.name} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="role">Role</label>
          <select id="role" name="role" value={form.role} onChange={handleChange} disabled={isSelf}>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" value={form.status} onChange={handleChange} disabled={isSelf}>
            <option value="active">Active</option>
            <option value="inactive">Inactive (cannot sign in)</option>
          </select>
        </div>
      </div>
      {isSelf && <p className="muted">You cannot change your own role or status.</p>}

      {isNew && (
        <div className="form-group">
          <label htmlFor="password">Temporary password</label>
          <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={handleChange} required />
          <p className="muted">At least 8 characters. Share it with the user and ask them to change it.</p>
        </div>
      )}

      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <Link to="/admin/users" className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
};

export default UserForm;

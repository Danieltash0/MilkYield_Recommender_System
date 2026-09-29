import React, { useEffect, useState } from 'react';
import { useSettings } from '../../api/useAdmin';
import Loader from '../../components/Loader';
import AdminTabs from './AdminTabs';
import '../../styles/tables.css';
import '../../styles/admin.css';

// Field layout; labels and current values come from the API
const GROUPS = [
  { title: 'Farm', fields: [['farm_name', 'text'], ['farm_location', 'text']] },
  { title: 'Contact', fields: [['contact_email', 'email'], ['contact_phone', 'tel']] },
  { title: 'Finance', fields: [['currency', 'text'], ['milk_price_per_litre', 'number']] }
];

const HINTS = {
  currency: 'Three-letter code, e.g. KES',
  milk_price_per_litre: 'Used to estimate milk income'
};

const Settings = () => {
  const { settings, loading, error, saveSettings } = useSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  useEffect(() => {
    if (settings) setForm(settings.values);
  }, [settings]);

  const handleChange = (e) => {
    const value = e.target.name === 'currency' ? e.target.value.toUpperCase() : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const result = await saveSettings(form);
    setSaving(false);
    if (result.success) {
      setForm(result.data.values);
      setNotice({ type: 'success', text: 'Settings saved.' });
    } else {
      setNotice({ type: 'error', text: result.error });
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <p className="muted">Farm details used across the app.</p>
        </div>
      </div>
      <AdminTabs />

      {error && <div className="alert alert-error">{error}</div>}
      {loading || !form ? (
        <Loader />
      ) : (
        <form className="card form-card" onSubmit={handleSubmit}>
          {notice.text && <div className={`alert alert-${notice.type}`} role="status">{notice.text}</div>}
          {GROUPS.map((group) => (
            <fieldset className="settings-group" key={group.title}>
              <legend>{group.title}</legend>
              <div className="form-row">
                {group.fields.map(([key, type]) => (
                  <div className="form-group" key={key}>
                    <label htmlFor={key}>{settings.labels[key]}</label>
                    <input
                      id={key}
                      name={key}
                      type={type}
                      step={type === 'number' ? '0.01' : undefined}
                      min={type === 'number' ? '0' : undefined}
                      maxLength={key === 'currency' ? 3 : undefined}
                      value={form[key] ?? ''}
                      onChange={handleChange}
                      required={key === 'farm_name' || key === 'currency'}
                    />
                    {HINTS[key] && <p className="muted">{HINTS[key]}</p>}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="card-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Settings;

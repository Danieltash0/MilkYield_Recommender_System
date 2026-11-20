import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import PasswordInput, { passwordChecks } from '../../components/PasswordInput';

// Admin accounts are never self-registered; the server enforces this too
const ROLE_OPTIONS = ['Farm Manager', 'Veterinarian', 'Worker'];

const Signup = () => {
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: ROLE_OPTIONS[0] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const checks = passwordChecks(form.password);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const failed = checks.find((c) => !c.ok);
    if (failed) return setError(`Password needs: ${failed.label.toLowerCase()}`);
    if (form.password !== form.confirm) return setError('Passwords do not match');

    // On success App.js redirects to the role's dashboard once `user` is set
    setLoading(true);
    const { name, email, password, role } = form;
    const result = await signup({ name: name.trim(), email: email.trim(), password, role });
    if (!result.success) {
      setError(result.error || 'Signup failed');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container auth-signup">
      <div className="auth-card">
        <Link to="/" className="brand auth-brand">
          <Logo />
          DairyDan
        </Link>
        <h2>Create your account</h2>
        <p className="muted">Join your farm team on DairyDan</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="form-group">
            <label htmlFor="name">Full name</label>
            <input id="name" name="name" autoComplete="name" maxLength={100} value={form.name} onChange={handleChange} required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" maxLength={100} value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" value={form.role} onChange={handleChange}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" name="password" autoComplete="new-password" value={form.password} onChange={handleChange} required minLength={5} aria-describedby="password-rules" />
            <ul className="password-rules" id="password-rules">
              {checks.map((c) => (
                <li key={c.label} className={c.ok ? 'ok' : undefined}>{c.label}</li>
              ))}
            </ul>
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Confirm password</label>
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" value={form.confirm} onChange={handleChange} required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;

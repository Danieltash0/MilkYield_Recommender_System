import React, { useState } from 'react';

// Password field with a show/hide toggle
const PasswordInput = ({ id, ...props }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input id={id} type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-controls={id}
        aria-pressed={visible}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
};

// Mirrors server/utils/password.js so most problems show before submitting
export const passwordChecks = (password) => [
  { label: 'At least 5 characters', ok: password.length >= 5 },
  { label: 'A letter and a number', ok: /[A-Za-z]/.test(password) && /\d/.test(password) }
];

export default PasswordInput;

// One password rule for signup, admin-created accounts and admin resets.
// Returns an error message, or null when the password is acceptable.
const MIN_LENGTH = 5;
const MAX_LENGTH = 72; // bcrypt ignores anything past 72 bytes

const passwordProblem = (password) => {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_LENGTH) {
    return `Password must be ${MAX_LENGTH} characters or fewer`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
};

module.exports = { passwordProblem, MIN_LENGTH, MAX_LENGTH };

const bcrypt = require('bcryptjs');

const hashPassword = (plain) => bcrypt.hash(plain, 10);
const hashPasswordSync = (plain) => bcrypt.hashSync(plain, 10);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

module.exports = { hashPassword, hashPasswordSync, comparePassword };

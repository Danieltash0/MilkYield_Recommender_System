// Shared connection helper for the db/ scripts.
// mysql2 and dotenv live in server/node_modules, so resolve them from there.
const path = require('path');
const serverDir = path.join(__dirname, '..', 'server');
const requireFromServer = require('module').createRequire(path.join(serverDir, 'package.json'));

requireFromServer('dotenv').config({ path: path.join(serverDir, '.env') });
const mysql = requireFromServer('mysql2/promise');

module.exports = function connect() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dairydan_db',
    multipleStatements: true
  });
};

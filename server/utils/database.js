require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dairydan_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Return DATE/TIMESTAMP columns as plain strings so dates such as a cow's
  // date_of_birth are not shifted by timezone conversion on the way to the client.
  dateStrings: true
});

module.exports = pool;

// Creates the tables from db/schema.sql (CREATE TABLE IF NOT EXISTS, so it is
// safe on a database that already has them), for a database that was not
// created by docker-compose, such as a hosted MySQL.
// Run with:  npm run db:schema   then  npm run db:migrate  and optionally  npm run db:seed
const fs = require('fs');
const path = require('path');
const connect = require('./connect');

(async () => {
  const conn = await connect();
  try {
    await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('Schema applied.');
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error('Schema failed:', err.message);
  process.exit(1);
});

const db = require('./database');
const FinancialRecord = require('../models/FinancialRecord');

// Each report type turns a date range into { summary, sections }, where every
// section is a table: { title, columns, rows }. The client renders and exports
// any report the same way, so adding a type here is all a new report needs.

const herd = async ({ from, to }) => {
  const [cattle] = await db.execute(
    `SELECT tag_number, name, breed, gender, health, date_of_birth, created_at
     FROM cattle ORDER BY tag_number`
  );
  const [registered] = await db.execute(
    `SELECT tag_number, name, breed, gender, DATE(created_at) AS registered
     FROM cattle WHERE DATE(created_at) BETWEEN ? AND ? ORDER BY created_at`,
    [from, to]
  );
  const count = (key) =>
    Object.entries(cattle.reduce((acc, c) => ({ ...acc, [c[key] || 'Not recorded']: (acc[c[key] || 'Not recorded'] || 0) + 1 }), {}))
      .sort((a, b) => b[1] - a[1]);

  return {
    summary: [
      { label: 'Cattle in herd', value: cattle.length },
      { label: 'Female', value: cattle.filter((c) => c.gender === 'Female').length },
      { label: 'Male', value: cattle.filter((c) => c.gender === 'Male').length },
      { label: 'Registered in period', value: registered.length },
      { label: 'Fair or Poor health', value: cattle.filter((c) => c.health === 'Fair' || c.health === 'Poor').length }
    ],
    sections: [
      { title: 'Health status', columns: ['Status', 'Animals'], rows: count('health') },
      { title: 'Breeds', columns: ['Breed', 'Animals'], rows: count('breed') },
      {
        title: 'Registered in period',
        columns: ['Tag', 'Name', 'Breed', 'Gender', 'Registered'],
        rows: registered.map((c) => [c.tag_number, c.name || '—', c.breed || '—', c.gender, c.registered])
      },
      {
        title: 'Full herd register',
        columns: ['Tag', 'Name', 'Breed', 'Gender', 'Health', 'Born'],
        rows: cattle.map((c) => [c.tag_number, c.name || '—', c.breed || '—', c.gender, c.health, c.date_of_birth || '—'])
      }
    ]
  };
};

const financial = async ({ from, to }) => {
  const s = await FinancialRecord.getSummary({ from, to });
  const records = await FinancialRecord.getRecords({ from, to });
  return {
    summary: [
      { label: 'Income', value: s.income, money: true },
      { label: 'Expenses', value: s.expense, money: true },
      { label: 'Net', value: s.net, money: true },
      { label: 'Entries', value: records.length }
    ],
    sections: [
      {
        title: 'By month',
        columns: ['Month', 'Income', 'Expenses', 'Net'],
        money: [1, 2, 3],
        rows: s.by_month.map((m) => [m.month, m.income, m.expense, Math.round((m.income - m.expense) * 100) / 100])
      },
      {
        title: 'By category',
        columns: ['Type', 'Category', 'Entries', 'Total'],
        money: [3],
        rows: s.by_category.map((c) => [c.record_type, c.category, c.entries, c.total])
      },
      {
        title: 'Transactions',
        columns: ['Date', 'Type', 'Category', 'Description', 'Amount'],
        money: [4],
        rows: records
          .slice()
          .reverse()
          .map((r) => [r.record_date, r.record_type, r.category, r.description || '', r.record_type === 'Expense' ? -r.amount : r.amount])
      }
    ]
  };
};

module.exports = {
  herd: { title: 'Herd inventory', build: herd },
  financial: { title: 'Financial statement', build: financial }
};

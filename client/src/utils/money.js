// Farm currency. Change here to re-label every amount in the app and in PDFs.
export const CURRENCY = 'KES';

const formatter = new Intl.NumberFormat('en-KE', { style: 'currency', currency: CURRENCY });

// Plain spaces instead of the non-breaking ones Intl inserts (keeps PDFs clean)
export const formatMoney = (n) => formatter.format(Number(n) || 0).replace(/ /g, ' ');

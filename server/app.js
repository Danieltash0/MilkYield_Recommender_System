require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { checkSecret, corsOptions } = require('./middleware/security');

checkSecret();

const app = express();

// Which proxies to trust for the client IP (rate limits, activity log).
// Locally that is the CRA dev proxy on loopback; on Render set TRUST_PROXY=1
// (one load balancer in front of the app).
const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy === undefined ? 'loopback' : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'DairyDan backend is running', timestamp: new Date().toISOString() });
});

// Feature routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/cattle', require('./routes/cattleRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/milking', require('./routes/milkingRoutes'));
app.use('/api/health-records', require('./routes/healthRecordRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/qr', require('./routes/qrRoutes'));
app.use('/api/finance', require('./routes/financeRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/feed', require('./routes/feedRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

module.exports = app;

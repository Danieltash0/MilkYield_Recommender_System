require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

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

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

module.exports = app;

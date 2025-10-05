const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { startScheduler, getScheduleStatus, updateSchedule } = require('./schedulers/cronScheduler');
const { performBackup, getLastBackupInfo, getAllBackups } = require('./services/backupService');
const { getMongoStats } = require('./services/mongoService');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Start the cron scheduler
startScheduler();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get schedule status
app.get('/api/schedule/status', (req, res) => {
  try {
    const status = getScheduleStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update schedule
app.post('/api/schedule/update', async (req, res) => {
  try {
    const scheduleConfig = req.body; // Now accepts full config object
    const result = await updateSchedule(scheduleConfig);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual backup
app.post('/api/backup/trigger', async (req, res) => {
  try {
    console.log('🔄 Manual backup triggered...');
    const result = await performBackup();
    res.json(result);
  } catch (error) {
    console.error('❌ Manual backup failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get last backup info
app.get('/api/backup/last', async (req, res) => {
  try {
    const info = await getLastBackupInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all backups
app.get('/api/backup/all', async (req, res) => {
  try {
    const backups = await getAllBackups();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get MongoDB statistics
app.get('/api/mongo/stats', async (req, res) => {
  try {
    const stats = await getMongoStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: process.env.MONGODB_URI ? 'configured' : 'not configured',
    firebase: process.env.VITE_FIREBASE_PROJECT_ID ? 'configured' : 'not configured'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 DB Management Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`⏰ Scheduler: ${getScheduleStatus().isRunning ? 'Active' : 'Inactive'}`);
});
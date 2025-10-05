const API_URL = 'http://localhost:4000';

let lastBackupId = null;

// Load initial data
document.addEventListener('DOMContentLoaded', () => {
  loadMongoStats();
  loadSchedulerStatus();
  loadLastBackup();
  loadBackupHistory();
  
  // Set up event listeners
  document.getElementById('schedule-form').addEventListener('submit', handleScheduleUpdate);
  document.getElementById('trigger-backup').addEventListener('click', handleManualBackup);
  
  // Frequency type change handlers
  document.querySelectorAll('input[name="frequency-type"]').forEach(radio => {
    radio.addEventListener('change', handleFrequencyChange);
  });
  
  // Time and day selection change handlers
  document.getElementById('hour').addEventListener('change', updateSchedulePreview);
  document.getElementById('minute').addEventListener('change', updateSchedulePreview);
  document.getElementById('day-of-month').addEventListener('change', updateSchedulePreview);
  document.querySelectorAll('input[name="weekday"]').forEach(checkbox => {
    checkbox.addEventListener('change', updateSchedulePreview);
  });
  
  // Initial preview
  updateSchedulePreview();
  
  // Refresh data every 10 seconds
  setInterval(() => {
    loadMongoStats();
    loadSchedulerStatus();
    checkForNewBackups();
  }, 10000);
});

// Check for new backups and show notification
async function checkForNewBackups() {
  try {
    const response = await fetch(`${API_URL}/api/backup/last`);
    const backup = await response.json();
    
    if (backup && backup._id !== lastBackupId) {
      // New backup detected!
      lastBackupId = backup._id;
      
      // Show notification
      showBackupNotification(backup);
      
      // Refresh displays
      loadLastBackup();
      loadBackupHistory();
      loadMongoStats();
    }
  } catch (error) {
    // Silent fail
  }
}

function showBackupNotification(backup) {
  const notification = document.createElement('div');
  notification.className = 'backup-notification';
  
  if (backup.skipped) {
    notification.innerHTML = `
      <div class="notification-header">⏭️ Backup Skipped</div>
      <div class="notification-body">
        No changes detected since last backup<br>
        <small>${new Date(backup.timestamp).toLocaleTimeString()}</small>
      </div>
    `;
    notification.style.background = '#bee3f8';
    notification.style.borderColor = '#2c5282';
  } else {
    notification.innerHTML = `
      <div class="notification-header">✅ Backup Completed</div>
      <div class="notification-body">
        ${backup.totalDocuments || 0} documents backed up<br>
        <small>${new Date(backup.timestamp).toLocaleTimeString()}</small>
      </div>
    `;
    notification.style.background = '#c6f6d5';
    notification.style.borderColor = '#22543d';
  }
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

function handleFrequencyChange(e) {
  const type = e.target.value;
  
  // Hide all conditional options
  document.getElementById('weekly-options').style.display = 'none';
  document.getElementById('monthly-options').style.display = 'none';
  document.getElementById('time-options').style.display = 'block';
  
  // For hourly, hide the hour selector, show only minute
  const hourGroup = document.getElementById('hour').parentElement;
  if (type === 'hourly') {
    hourGroup.style.display = 'none';
  } else {
    hourGroup.style.display = 'block';
  }
  
  // Show relevant options
  if (type === 'weekly') {
    document.getElementById('weekly-options').style.display = 'block';
  } else if (type === 'monthly') {
    document.getElementById('monthly-options').style.display = 'block';
  }
  
  updateSchedulePreview();
}

function updateSchedulePreview() {
  const frequencyType = document.querySelector('input[name="frequency-type"]:checked').value;
  const hour = document.getElementById('hour').value;
  const minute = document.getElementById('minute').value;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  
  let preview = '';
  
  if (frequencyType === 'hourly') {
    preview = `⏱️ Every hour at minute ${minute}`;
  } else if (frequencyType === 'daily') {
    preview = `📅 Every day at ${timeStr}`;
  } else if (frequencyType === 'weekly') {
    const selectedDays = Array.from(document.querySelectorAll('input[name="weekday"]:checked'))
      .map(cb => cb.nextElementSibling.textContent);
    
    if (selectedDays.length === 0) {
      preview = `📆 Weekly (no days selected) at ${timeStr}`;
    } else if (selectedDays.length === 7) {
      preview = `📆 Every day at ${timeStr}`;
    } else {
      preview = `📆 Every ${selectedDays.join(', ')} at ${timeStr}`;
    }
  } else if (frequencyType === 'monthly') {
    const day = document.getElementById('day-of-month').value;
    preview = `🗓️ Monthly on day ${day} at ${timeStr}`;
  }
  
  document.getElementById('schedule-preview-text').textContent = preview;
}

async function loadMongoStats() {
  try {
    const response = await fetch(`${API_URL}/api/mongo/stats`);
    const stats = await response.json();
    
    document.getElementById('mongo-status').innerHTML = `
      <div><strong>Database:</strong> ${stats.database}</div>
      <div><strong>Collections:</strong> ${stats.collections}</div>
      <div><strong>Total Size:</strong> ${formatBytes(stats.totalSize)}</div>
    `;
  } catch (error) {
    document.getElementById('mongo-status').innerHTML = '<div style="color: red;">❌ Error loading stats</div>';
  }
}

async function loadSchedulerStatus() {
  try {
    const response = await fetch(`${API_URL}/api/schedule/status`);
    const status = await response.json();
    
    const schedule = status.schedule;
    document.getElementById('scheduler-status').innerHTML = `
      <div><strong>Status:</strong> ${status.isRunning ? '🟢 Running' : '🔴 Stopped'}</div>
      <div><strong>Schedule:</strong> ${status.description}</div>
      <div><strong>Next run:</strong> ${status.nextRunLocal}</div>
      <div><strong>Time remaining:</strong> <span id="countdown" style="color: #667eea; font-weight: 700;">${status.timeUntilNext}</span></div>
      <div><strong>Cron:</strong> <code>${status.cronExpression}</code></div>
    `;
    
    // Update form with current schedule
    const typeRadio = document.querySelector(`input[name="frequency-type"][value="${schedule.type}"]`);
    if (typeRadio) typeRadio.checked = true;
    
    document.getElementById('hour').value = schedule.hour;
    document.getElementById('minute').value = schedule.minute;
    
    if (schedule.type === 'weekly' && schedule.weekdays) {
      // Clear all first
      document.querySelectorAll('input[name="weekday"]').forEach(cb => cb.checked = false);
      schedule.weekdays.forEach(day => {
        const checkbox = document.querySelector(`input[name="weekday"][value="${day}"]`);
        if (checkbox) checkbox.checked = true;
      });
    }
    
    if (schedule.type === 'monthly' && schedule.dayOfMonth) {
      document.getElementById('day-of-month').value = schedule.dayOfMonth;
    }
    
    handleFrequencyChange({ target: { value: schedule.type } });
    updateSchedulePreview();
  } catch (error) {
    document.getElementById('scheduler-status').innerHTML = '<div style="color: red;">❌ Error loading status</div>';
  }
}

// Live countdown update every second
setInterval(async () => {
  try {
    const response = await fetch(`${API_URL}/api/schedule/status`);
    const status = await response.json();
    const countdownEl = document.getElementById('countdown');
    if (countdownEl) {
      countdownEl.textContent = status.timeUntilNext;
    }
  } catch (error) {
    // Silent fail for countdown updates
  }
}, 1000);

async function loadLastBackup() {
  try {
    const response = await fetch(`${API_URL}/api/backup/last`);
    const backup = await response.json();
    
    if (backup) {
      lastBackupId = backup._id; // Initialize lastBackupId
      
      const date = new Date(backup.timestamp);
      const statusClass = backup.skipped ? 'skipped' : backup.status;
      const statusText = backup.skipped ? '⏭️ Skipped (no changes)' : backup.status;
      
      document.getElementById('last-backup').innerHTML = `
        <div><strong>Time:</strong> ${date.toLocaleString()}</div>
        <div><strong>Documents:</strong> ${backup.totalDocuments || 'N/A'}</div>
        <div><strong>Status:</strong> <span class="status-badge ${statusClass}">${statusText}</span></div>
      `;
    } else {
      document.getElementById('last-backup').innerHTML = '<div>No backups yet</div>';
    }
  } catch (error) {
    document.getElementById('last-backup').innerHTML = '<div style="color: red;">❌ Error loading backup</div>';
  }
}

async function loadBackupHistory() {
  try {
    const response = await fetch(`${API_URL}/api/backup/all`);
    const backups = await response.json();
    
    if (backups.length === 0) {
      document.getElementById('backup-history').innerHTML = '<div>No backups found</div>';
      return;
    }
    
    const html = backups.slice(0, 20).map(backup => { // Show only last 20
      const date = new Date(backup.timestamp);
      const statusClass = backup.skipped ? 'skipped' : backup.status;
      const statusText = backup.skipped ? 'skipped' : backup.status;
      
      return `
        <div class="backup-item">
          <div class="backup-info">
            <div class="backup-id">${backup._id}</div>
            <div class="backup-meta">
              ${date.toLocaleString()} • ${backup.totalDocuments || 0} documents
              ${backup.skipped ? ' • No changes detected' : ''}
            </div>
          </div>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
      `;
    }).join('');
    
    document.getElementById('backup-history').innerHTML = html;
  } catch (error) {
    document.getElementById('backup-history').innerHTML = '<div style="color: red;">❌ Error loading history</div>';
  }
}

async function handleScheduleUpdate(e) {
  e.preventDefault();
  
  const type = document.querySelector('input[name="frequency-type"]:checked').value;
  const hour = parseInt(document.getElementById('hour').value);
  const minute = parseInt(document.getElementById('minute').value);
  
  const scheduleConfig = {
    type,
    hour,
    minute
  };
  
  if (type === 'weekly') {
    const weekdays = Array.from(document.querySelectorAll('input[name="weekday"]:checked'))
      .map(cb => parseInt(cb.value));
    
    if (weekdays.length === 0) {
      alert('⚠️ Please select at least one day for weekly backups');
      return;
    }
    
    scheduleConfig.weekdays = weekdays;
  } else if (type === 'monthly') {
    scheduleConfig.dayOfMonth = parseInt(document.getElementById('day-of-month').value);
  }
  
  try {
    const response = await fetch(`${API_URL}/api/schedule/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleConfig)
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('✅ Schedule updated successfully!');
      setTimeout(() => {
        loadSchedulerStatus();
      }, 1000);
    }
  } catch (error) {
    alert('❌ Failed to update schedule: ' + error.message);
  }
}

async function handleManualBackup() {
  const button = document.getElementById('trigger-backup');
  const statusDiv = document.getElementById('backup-status');
  
  button.disabled = true;
  button.textContent = '⏳ Backing up...';
  statusDiv.className = '';
  statusDiv.style.display = 'none';
  
  try {
    const response = await fetch(`${API_URL}/api/backup/trigger`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.skipped) {
      statusDiv.className = 'success';
      statusDiv.innerHTML = `
        ⏭️ Backup skipped - No changes detected<br>
        <strong>Reason:</strong> ${result.message}<br>
        <strong>Last backup:</strong> ${new Date(result.lastBackup).toLocaleString()}
      `;
    } else if (result.success) {
      statusDiv.className = 'success';
      statusDiv.innerHTML = `
        ✅ Backup completed successfully!<br>
        <strong>Backup ID:</strong> ${result.backupId}<br>
        <strong>Duration:</strong> ${result.duration}<br>
        <strong>Documents:</strong> ${result.totalDocuments}
      `;
    } else {
      throw new Error('Backup failed');
    }
    
    loadLastBackup();
    loadBackupHistory();
    loadMongoStats();
  } catch (error) {
    statusDiv.className = 'error';
    statusDiv.textContent = '❌ Backup failed: ' + error.message;
  } finally {
    button.disabled = false;
    button.textContent = '▶️ Run Backup Now';
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
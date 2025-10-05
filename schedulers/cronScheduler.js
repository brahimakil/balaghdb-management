const cron = require('node-cron');
const { performBackup } = require('../services/backupService');

let cronJob = null;
let currentSchedule = {
  type: process.env.BACKUP_FREQUENCY || 'daily',
  hour: parseInt(process.env.BACKUP_HOUR) || 2,
  minute: parseInt(process.env.BACKUP_MINUTE) || 0,
  second: parseInt(process.env.BACKUP_SECOND) || 0,
  weekdays: [1], // Default: Monday
  dayOfMonth: 1  // Default: 1st
};

function getCronExpression(schedule) {
  const { type, hour, minute, second, weekdays, dayOfMonth } = schedule;
  
  switch (type) {
    case 'every-second':
      return `* * * * * *`; // Every second (for testing)
      
    case 'every-minute':
      return `${second || 0} * * * * *`; // Every minute at specified second
      
    case 'hourly':
      return `${second || 0} ${minute} * * * *`; // Every hour at specified minute:second
      
    case 'daily':
      return `${second || 0} ${minute} ${hour} * * *`; // Every day at specified time
      
    case 'weekly':
      const days = weekdays && weekdays.length > 0 ? weekdays.join(',') : '1';
      return `${second || 0} ${minute} ${hour} * * ${days}`;
      
    case 'monthly':
      const day = dayOfMonth || 1;
      return `${second || 0} ${minute} ${hour} ${day} * *`;
      
    default:
      return `${second || 0} ${minute} ${hour} * * *`; // Default to daily
  }
}

function calculateNextRun(schedule) {
  const now = new Date();
  const { type, hour, minute, second, weekdays, dayOfMonth } = schedule;
  
  let next = new Date(now);
  
  switch (type) {
    case 'every-second':
      next.setSeconds(next.getSeconds() + 1);
      break;
      
    case 'every-minute':
      next.setMinutes(next.getMinutes() + 1);
      next.setSeconds(second || 0);
      if (next <= now) next.setMinutes(next.getMinutes() + 1);
      break;
      
    case 'hourly':
      // Set to the target minute in the current hour
      next.setMinutes(minute);
      next.setSeconds(second || 0);
      next.setMilliseconds(0);
      
      // If the time has already passed this hour, move to next hour
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
      break;
      
    case 'daily':
      next.setHours(hour);
      next.setMinutes(minute);
      next.setSeconds(second || 0);
      next.setMilliseconds(0);
      if (next <= now) next.setDate(next.getDate() + 1);
      break;
      
    case 'weekly':
      next.setHours(hour);
      next.setMinutes(minute);
      next.setSeconds(second || 0);
      next.setMilliseconds(0);
      const currentDay = next.getDay();
      const sortedDays = [...(weekdays || [1])].sort((a, b) => a - b);
      
      // Find next occurrence
      let targetDay = sortedDays.find(d => {
        if (d > currentDay) return true;
        if (d === currentDay && next > now) return true;
        return false;
      });
      
      if (!targetDay) {
        // No day found this week, get first day of next week
        targetDay = sortedDays[0];
        const daysToAdd = (targetDay - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysToAdd);
      } else if (targetDay === currentDay) {
        // Today, time hasn't passed yet
      } else {
        // Later this week
        next.setDate(next.getDate() + (targetDay - currentDay));
      }
      break;
      
    case 'monthly':
      next.setDate(dayOfMonth || 1);
      next.setHours(hour);
      next.setMinutes(minute);
      next.setSeconds(second || 0);
      next.setMilliseconds(0);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      break;
  }
  
  return next;
}

function getTimeUntilNext(schedule) {
  const next = calculateNextRun(schedule);
  const now = new Date();
  const diff = next - now;
  
  if (diff < 0) return 'Calculating...';
  
  const totalSeconds = Math.floor(diff / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

function getScheduleDescription(schedule) {
  const { type, hour, minute, second, weekdays, dayOfMonth } = schedule;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  
  switch (type) {
    case 'every-second':
      return '⚡ Every second (TESTING MODE)';
      
    case 'every-minute':
      return `⚡ Every minute at second ${second || 0} (TESTING MODE)`;
      
    case 'hourly':
      return `⏱️ Every hour at minute ${minute}`;
      
    case 'daily':
      return `📅 Every day at ${timeStr}`;
      
    case 'weekly':
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const selectedDays = weekdays && weekdays.length > 0 
        ? weekdays.map(d => dayNames[d]).join(', ')
        : 'Monday';
      return `📆 Every ${selectedDays} at ${timeStr}`;
      
    case 'monthly':
      const day = dayOfMonth || 1;
      return `🗓️ Monthly on day ${day} at ${timeStr}`;
      
    default:
      return `Daily at ${timeStr}`;
  }
}

function startScheduler() {
  if (cronJob) {
    cronJob.stop();
  }
  
  const cronExpression = getCronExpression(currentSchedule);
  const description = getScheduleDescription(currentSchedule);
  
  console.log(`⏰ Starting scheduler with cron: ${cronExpression}`);
  console.log(`📅 Schedule: ${description}`);
  
  cronJob = cron.schedule(cronExpression, async () => {
    console.log('\n🔔 Scheduled backup triggered');
    try {
      await performBackup();
    } catch (error) {
      console.error('❌ Scheduled backup failed:', error);
    }
  });
  
  return {
    success: true,
    schedule: currentSchedule,
    cronExpression,
    description
  };
}

function getScheduleStatus() {
  const cronExpression = getCronExpression(currentSchedule);
  const description = getScheduleDescription(currentSchedule);
  const nextRunDate = calculateNextRun(currentSchedule);
  const timeUntil = getTimeUntilNext(currentSchedule);
  
  return {
    isRunning: cronJob !== null,
    schedule: currentSchedule,
    cronExpression,
    description,
    nextRunDate: nextRunDate.toISOString(),
    nextRunLocal: nextRunDate.toLocaleString(),
    timeUntilNext: timeUntil
  };
}

async function updateSchedule(scheduleConfig) {
  currentSchedule = {
    type: scheduleConfig.type || 'daily',
    hour: parseInt(scheduleConfig.hour) || 2,
    minute: parseInt(scheduleConfig.minute) || 0,
    second: parseInt(scheduleConfig.second) || 0,
    weekdays: scheduleConfig.weekdays || [1],
    dayOfMonth: parseInt(scheduleConfig.dayOfMonth) || 1
  };
  
  return startScheduler();
}

module.exports = {
  startScheduler,
  getScheduleStatus,
  updateSchedule
};
const { fetchAllData, getCollectionsSchema } = require('./firebaseService');
const { saveBackupToMongo, getBackupsList } = require('./mongoService');

async function performBackup() {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting backup process...');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    
    // Fetch all data from Firebase
    const firebaseData = await fetchAllData();
    
    // Calculate statistics
    const stats = {};
    let totalDocuments = 0;
    
    for (const [collection, documents] of Object.entries(firebaseData)) {
      stats[collection] = documents.length;
      totalDocuments += documents.length;
    }
    
    console.log(`📊 Total documents to backup: ${totalDocuments}`);
    
    // Save to MongoDB
    const metadata = {
      source: 'firebase',
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      totalDocuments,
      stats,
      schema: getCollectionsSchema()
    };
    
    const result = await saveBackupToMongo(firebaseData, metadata);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Backup completed in ${duration}s`);
    console.log(`📦 Backup ID: ${result.backupId}`);
    
    return {
      success: true,
      backupId: result.backupId,
      timestamp: result.timestamp,
      duration: `${duration}s`,
      totalDocuments,
      stats: result.results
    };
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

async function getLastBackupInfo() {
  try {
    const backups = await getBackupsList();
    return backups.length > 0 ? backups[0] : null;
  } catch (error) {
    console.error('❌ Error fetching last backup:', error);
    throw error;
  }
}

async function getAllBackups() {
  try {
    return await getBackupsList();
  } catch (error) {
    console.error('❌ Error fetching all backups:', error);
    throw error;
  }
}

module.exports = {
  performBackup,
  getLastBackupInfo,
  getAllBackups
};
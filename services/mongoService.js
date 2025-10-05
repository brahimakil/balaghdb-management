const { getCollection, connectMongoDB } = require('../config/mongodb');
const crypto = require('crypto');

// Generate hash of data to detect changes
function generateDataHash(data) {
  const dataString = JSON.stringify(data);
  return crypto.createHash('md5').update(dataString).digest('hex');
}

async function saveBackupToMongo(data, metadata) {
  try {
    await connectMongoDB();
    
    const timestamp = new Date();
    
    // Calculate hash of the data
    const dataHash = generateDataHash(data);
    
    // Check if this exact data was already backed up
    const metadataCollection = await getCollection('_backup_metadata');
    const existingBackup = await metadataCollection.findOne({ 
      dataHash,
      status: 'completed'
    });
    
    if (existingBackup) {
      console.log(`⏭️  Data unchanged since ${existingBackup.timestamp.toISOString()}`);
      console.log('✅ Skipping duplicate backup');
      return {
        skipped: true,
        reason: 'Data unchanged',
        lastBackup: existingBackup.timestamp,
        message: 'No changes detected since last backup'
      };
    }
    
    const backupId = `backup_${Date.now()}`;
    
    // Save metadata
    await metadataCollection.insertOne({
      _id: backupId,
      timestamp,
      dataHash,
      ...metadata,
      status: 'in_progress'
    });
    
    console.log(`📝 Backup ${backupId} started...`);
    
    // Save each collection directly (overwrite existing data)
    const results = {};
    for (const [collectionName, documents] of Object.entries(data)) {
      if (documents.length === 0) {
        console.log(`⏭️  Skipping empty collection: ${collectionName}`);
        results[collectionName] = { inserted: 0, skipped: true };
        continue;
      }
      
      const collection = await getCollection(collectionName);
      
      // Clear existing data in this collection
      await collection.deleteMany({});
      
      // Create indexes for relationships
      if (documents[0]._firebaseId) {
        await collection.createIndex({ _firebaseId: 1 }, { unique: true });
      }
      
      // Insert new data
      const result = await collection.insertMany(documents);
      results[collectionName] = {
        inserted: result.insertedCount,
        total: documents.length
      };
      
      console.log(`✅ Saved ${result.insertedCount} documents to ${collectionName}`);
    }
    
    // Update metadata with completion status
    await metadataCollection.updateOne(
      { _id: backupId },
      { 
        $set: { 
          status: 'completed',
          completedAt: new Date(),
          results
        }
      }
    );
    
    console.log(`✅ Backup ${backupId} completed successfully`);
    
    return {
      backupId,
      timestamp,
      results,
      skipped: false
    };
  } catch (error) {
    console.error('❌ Error saving backup to MongoDB:', error);
    throw error;
  }
}

async function getBackupsList() {
  try {
    await connectMongoDB();
    const metadataCollection = await getCollection('_backup_metadata');
    const backups = await metadataCollection.find({}).sort({ timestamp: -1 }).toArray();
    return backups;
  } catch (error) {
    console.error('❌ Error fetching backups list:', error);
    throw error;
  }
}

async function getMongoStats() {
  try {
    const database = await connectMongoDB();
    
    const stats = await database.stats();
    const collections = await database.listCollections().toArray();
    
    return {
      database: database.databaseName,
      collections: collections.length,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      totalSize: stats.totalSize
    };
  } catch (error) {
    console.error('❌ Error fetching MongoDB stats:', error);
    throw error;
  }
}

module.exports = {
  saveBackupToMongo,
  getBackupsList,
  getMongoStats
};
const { MongoClient } = require('mongodb');

let client = null;
let db = null;
let keepAliveInterval = null;

async function connectMongoDB() {
  if (db) return db;
  
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in .env');
    }
    
    // Connection options with SSL fixes for Railway/Production
    const options = {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 300000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
    };
    
    client = new MongoClient(uri, options);
    await client.connect();
    
    // Extract database name from URI or use default
    const dbName = process.env.MONGODB_DB_NAME || 'balagh_backups';
    db = client.db(dbName);
    
    console.log('✅ Connected to MongoDB');
    
    // Start keep-alive ping every 1 minute
    startKeepAlive();
    
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    client = null;
    db = null;
    throw error;
  }
}

async function pingMongoDB() {
  try {
    if (db) {
      await db.admin().ping();
      console.log('🏓 MongoDB ping successful');
    }
  } catch (error) {
    console.error('❌ MongoDB ping failed:', error.message);
    // Reset connection so it reconnects on next request
    client = null;
    db = null;
    stopKeepAlive();
    
    // Try to reconnect
    console.log('🔄 Attempting to reconnect...');
    try {
      await connectMongoDB();
    } catch (reconnectError) {
      console.error('❌ Reconnection failed:', reconnectError.message);
    }
  }
}

function startKeepAlive() {
  if (keepAliveInterval) return;
  
  console.log('🏓 Starting MongoDB keep-alive ping (every 60 seconds)');
  keepAliveInterval = setInterval(() => {
    pingMongoDB();
  }, 60000);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('🛑 Stopped MongoDB keep-alive ping');
  }
}

async function getCollection(collectionName) {
  const database = await connectMongoDB();
  return database.collection(collectionName);
}

async function closeConnection() {
  stopKeepAlive();
  
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🔌 MongoDB connection closed');
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = {
  connectMongoDB,
  getCollection,
  closeConnection,
  pingMongoDB,
  db: () => db
};

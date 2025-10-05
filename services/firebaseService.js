const { getFirestore } = require('../config/firebase');

// Define all Firebase collections with their relationships
const COLLECTIONS_SCHEMA = {
  martyrs: {
    name: 'martyrs',
    relations: {
      warId: { collection: 'wars', field: 'id' },
      locationId: { collection: 'locations', field: 'id' }
    }
  },
  wars: {
    name: 'wars',
    relations: {}
  },
  locations: {
    name: 'locations',
    relations: {
      sectorId: { collection: 'sectors', field: 'id' }
    }
  },
  villages: {
    name: 'villages',
    relations: {}
  },
  sectors: {
    name: 'sectors',
    relations: {}
  },
  legends: {
    name: 'legends',
    relations: {
      locationId: { collection: 'locations', field: 'id' }
    }
  },
  activities: {
    name: 'activities',
    relations: {
      villageId: { collection: 'villages', field: 'id' },
      activityTypeId: { collection: 'activityTypes', field: 'id' }
    }
  },
  activityTypes: {
    name: 'activityTypes',
    relations: {}
  },
  news: {
    name: 'news',
    relations: {}
  },
  martyrFriendStories: {
    name: 'martyrFriendStories',
    relations: {
      martyrId: { collection: 'martyrs', field: 'id' }
    }
  },
  users: {
    name: 'users',
    relations: {
      assignedVillageId: { collection: 'villages', field: 'id' }
    }
  },
  websiteSettings: {
    name: 'websiteSettings',
    relations: {}
  },
  notifications: {
    name: 'notifications',
    relations: {}
  },
  dynamicPages: {
    name: 'dynamicPages',
    relations: {
      categoryId: { collection: 'pageCategories', field: 'id' }
    }
  },
  pageCategories: {
    name: 'pageCategories',
    relations: {}
  },
  dashboardSections: {
    name: 'dashboardSections',
    relations: {
      pageId: { collection: 'dynamicPages', field: 'id' }
    }
  }
};

async function getAllCollectionData(collectionName) {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(collectionName).get();
    
    const data = [];
    snapshot.forEach(doc => {
      const docData = doc.data();
      
      // Convert Firestore Timestamps to ISO strings
      Object.keys(docData).forEach(key => {
        if (docData[key] && typeof docData[key].toDate === 'function') {
          docData[key] = docData[key].toDate().toISOString();
        }
      });
      
      data.push({
        _id: doc.id,
        ...docData,
        _firebaseId: doc.id, // Preserve original Firebase ID
        _collection: collectionName // Store source collection
      });
    });
    
    console.log(`✅ Fetched ${data.length} documents from ${collectionName}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching ${collectionName}:`, error);
    throw error;
  }
}

async function fetchAllData() {
  const allData = {};
  
  console.log('📦 Fetching all Firebase collections...');
  
  for (const [key, schema] of Object.entries(COLLECTIONS_SCHEMA)) {
    try {
      allData[key] = await getAllCollectionData(schema.name);
    } catch (error) {
      console.warn(`⚠️  Skipping ${key}:`, error.message);
      allData[key] = [];
    }
  }
  
  return allData;
}

function getCollectionsSchema() {
  return COLLECTIONS_SCHEMA;
}

module.exports = {
  getAllCollectionData,
  fetchAllData,
  getCollectionsSchema,
  COLLECTIONS_SCHEMA
};
const { MongoClient } = require('mongodb');

let db = null;

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trigardening';
    const client = new MongoClient(uri);
    
    await client.connect();
    console.log('MongoDB Connected successfully');
    
    // Determine db name from URI or default
    const dbName = uri.split('/').pop().split('?')[0] || 'trigardening';
    db = client.db(dbName);
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized! Call connectDB first.');
  }
  return db;
};

module.exports = { connectDB, getDB };

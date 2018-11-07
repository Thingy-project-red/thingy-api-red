const log = require('debug')('mongo');
const { MongoClient } = require('mongodb');

// Collection where users are stored (increment version when changing schema)
const collectionName = 'user-v1';
// Reference to the users collection in our DB
let usersCollection;

async function mongoInit() {
  try {
    const client = await MongoClient.connect(
      'mongodb://user-db:27017', { useNewUrlParser: true }
    );
    // Store reference to users collection
    usersCollection = client.db('users').collection(collectionName);
  } catch (err) {
    log('Error connecting to MongoDB, trying again');
    await mongoInit();
  }
}

async function getCollection() {
  if (!usersCollection) {
    await mongoInit();
  }
  return usersCollection;
}

module.exports = getCollection;

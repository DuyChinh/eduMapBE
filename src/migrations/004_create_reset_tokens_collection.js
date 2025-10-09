const { MongoClient } = require('mongodb');

module.exports = {
  async up(db, client) {
    // Tạo collection reset_tokens
    await db.createCollection('resettokens');
    
    // Tạo indexes
    await db.collection('resettokens').createIndex({ userId: 1 });
    await db.collection('resettokens').createIndex({ token: 1 }, { unique: true });
    await db.collection('resettokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection('resettokens').createIndex({ token: 1, used: 1 });
    
    console.log('Created reset_tokens collection with indexes');
  },

  async down(db, client) {
    // Xóa collection reset_tokens
    await db.collection('resettokens').drop();
    console.log('Dropped reset_tokens collection');
  }
};

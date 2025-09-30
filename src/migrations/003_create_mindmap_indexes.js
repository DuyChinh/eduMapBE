module.exports = {
    async up(db) {
      const collection = await db.createCollection('mindmaps').catch(() => db.collection('mindmaps'));
      await collection.createIndex({ userId: 1, favorite: 1 });
      await collection.createIndex({ orgId: 1 });
      await collection.createIndex({ deletedAt: 1 });
      await collection.createIndex({ title: 'text' });
    },
  
    async down(db) {
      const collection = db.collection('mindmaps');
      await collection.dropIndex('userId_1_favorite_1').catch(() => {});
      await collection.dropIndex('orgId_1').catch(() => {});
      await collection.dropIndex('deletedAt_1').catch(() => {});
      await collection.dropIndex('title_text').catch(() => {});
      await db.collection('mindmaps').drop().catch(() => {});
    }
  };
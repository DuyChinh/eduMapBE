module.exports = {
  async up(db) {
    console.log('Adding status field to existing chat history messages...');
    
    const result = await db.collection('ai_chat_messages').updateMany(
      { status: { $exists: false } },
      { $set: { status: 'completed' } }
    );
    
    console.log(`Updated ${result.modifiedCount} messages with default status 'completed'`);
    
    console.log('Creating index on status field...');
    await db.collection('ai_chat_messages').createIndex({ status: 1 });
    
    console.log('Migration 022 completed successfully');
  },

  async down(db) {
    console.log('Removing status field from chat history messages...');
    
    await db.collection('ai_chat_messages').updateMany(
      {},
      { $unset: { status: '' } }
    );
    
    console.log('Dropping index on status field...');
    await db.collection('ai_chat_messages').dropIndex('status_1');
    
    console.log('Migration 022 rollback completed');
  }
};


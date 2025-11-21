const mongoose = require('mongoose');
const config = require('../config');

async function up() {
  console.log('Updating unique constraints in classes collection...');
  
  try {
    const mongoUri = config.DATABASE_MG_URL || config.MIGRATE_MG_URL || 'mongodb://localhost:27017/EduMap';
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const classesCollection = db.collection('classes');
    
    console.log('1. Removing unique constraint from name field...');
    try {
      await classesCollection.dropIndex('name_1');
      console.log('✅ Dropped unique index on name field');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index name_1 does not exist, skipping...');
      } else {
        console.log('⚠️  Error dropping name_1 index:', error.message);
      }
    }
    
    console.log('2. Adding unique constraint to code field...');
    try {
      // Drop existing code index if exists
      await classesCollection.dropIndex('code_1');
      console.log('✅ Dropped existing code index');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index code_1 does not exist, skipping...');
      } else {
        console.log('⚠️  Error dropping code_1 index:', error.message);
      }
    }
    
    // Create new unique index on code field
    await classesCollection.createIndex({ code: 1 }, { unique: true });
    console.log('✅ Created unique index on code field');
    
    console.log('3. Listing all indexes...');
    const indexes = await classesCollection.indexes();
    console.log('Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '(unique)' : ''}`);
    });
    
  } catch (error) {
    console.error('Error updating unique constraints:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

async function down() {
  console.log('Reverting unique constraints in classes collection...');
  
  try {
    const mongoUri = config.DATABASE_MG_URL || config.MIGRATE_MG_URL || 'mongodb://localhost:27017/EduMap';
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const classesCollection = db.collection('classes');
    
    console.log('1. Removing unique constraint from code field...');
    try {
      await classesCollection.dropIndex('code_1');
      console.log('✅ Dropped unique index on code field');
    } catch (error) {
      console.log('⚠️  Error dropping code_1 index:', error.message);
    }
    
    console.log('2. Adding unique constraint back to name field...');
    await classesCollection.createIndex({ name: 1 }, { unique: true });
    console.log('✅ Recreated unique index on name field');
    
  } catch (error) {
    console.error('Error reverting unique constraints:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { up, down };

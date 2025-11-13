const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MIGRATE_MG_URL || process.env.MONGODB_URI || process.env.DATABASE_MG_URL || 'mongodb://localhost:27017/edumap';

/**
 * Generate a random 8-character alphanumeric code
 */
function generateShareCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function runMigration() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const examsCollection = db.collection('exams');

    // Drop existing shareCode index if exists (to recreate with sparse)
    try {
      await examsCollection.dropIndex('shareCode_1');
      console.log('✅ Dropped existing shareCode index');
    } catch (error) {
      if (error.code !== 27) { // Index not found
        console.log('ℹ️  No existing shareCode index to drop');
      }
    }

    // Create sparse unique index on shareCode (allows multiple nulls)
    try {
      await examsCollection.createIndex({ shareCode: 1 }, { unique: true, sparse: true });
      console.log('✅ Created sparse unique index on shareCode');
    } catch (error) {
      console.log('ℹ️  Index may already exist:', error.message);
    }

    // Add shareCode field to all existing exams (only if not exists, don't set to null)
    // We'll only add it when needed (when publishing)
    console.log('✅ Migration setup completed');

    // Generate shareCode for published exams
    const publishedExams = await examsCollection.find({ status: 'published' }).toArray();
    console.log(`📋 Found ${publishedExams.length} published exams`);
    
    for (const exam of publishedExams) {
      if (!exam.shareCode) {
        // Generate a unique share code
        let shareCode = generateShareCode();
        
        // Ensure uniqueness
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
          const existing = await examsCollection.findOne({ shareCode });
          if (!existing) {
            isUnique = true;
          } else {
            shareCode = generateShareCode();
            attempts++;
          }
        }
        
        await examsCollection.updateOne(
          { _id: exam._id },
          { $set: { shareCode } }
        );
        console.log(`✅ Generated shareCode ${shareCode} for exam: ${exam.name}`);
      }
    }

    console.log('✅ Migration 020 completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();


const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Migration: Add shareCode field to Exam model
 * This allows generating shareable links for published exams
 */
async function up() {
  const db = mongoose.connection.db;
  const examsCollection = db.collection('exams');

  // Add shareCode field to all existing exams
  await examsCollection.updateMany(
    { shareCode: { $exists: false } },
    { $set: { shareCode: null } }
  );

  // Generate shareCode for published exams
  const publishedExams = await examsCollection.find({ status: 'published' }).toArray();
  
  for (const exam of publishedExams) {
    if (!exam.shareCode) {
      // Generate a unique share code (8 characters, alphanumeric)
      const shareCode = generateShareCode();
      
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
    }
  }

  console.log('✅ Migration 020: Added shareCode field to Exam model');
}

async function down() {
  const db = mongoose.connection.db;
  const examsCollection = db.collection('exams');

  // Remove shareCode field
  await examsCollection.updateMany(
    {},
    { $unset: { shareCode: '' } }
  );

  console.log('✅ Migration 020: Removed shareCode field from Exam model');
}

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

module.exports = { up, down };


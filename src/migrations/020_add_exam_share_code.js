/**
 * Migration: Add shareCode field to Exam model
 * This allows generating shareable links for published exams
 */
async function up(db) {
  const examsCollection = db.collection('exams');

  // First, drop the old index if it exists (might not be sparse)
  try {
    await examsCollection.dropIndex('shareCode_1');
    console.log('Dropped old shareCode index');
  } catch (error) {
    // Index might not exist, that's okay
    console.log('No existing shareCode index to drop');
  }

  // Create sparse unique index for shareCode
  await examsCollection.createIndex(
    { shareCode: 1 },
    { unique: true, sparse: true, name: 'shareCode_1' }
  );
  console.log('Created sparse unique index for shareCode');

  // Generate shareCode for published exams (don't set null for others)
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

async function down(db) {
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


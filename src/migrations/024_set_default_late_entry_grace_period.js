/**
 * Migration: Set default lateEntryGracePeriod to -1
 * 
 * Purpose: Set lateEntryGracePeriod to -1 for all exams that don't have this field
 * or have it set to null/undefined. This ensures the default behavior is to allow 
 * late entry anytime (when lateEntryGracePeriod = -1).
 * 
 * Background: 
 * - Previously, lateEntryGracePeriod was unset (migration 023)
 * - New behavior: -1 = allow late entry anytime (default)
 * - Only when explicitly set with a number >= 0, late entry is restricted
 */

module.exports = {
  async up(db) {
    console.log('Starting migration: Set default lateEntryGracePeriod to -1...');
    
    try {
      // Set lateEntryGracePeriod to -1 for exams that:
      // 1. Don't have the field
      // 2. Have it set to null
      const result = await db.collection('exams').updateMany(
        {
          $or: [
            { lateEntryGracePeriod: { $exists: false } },
            { lateEntryGracePeriod: null }
          ]
        },
        {
          $set: { lateEntryGracePeriod: -1 }
        }
      );

      console.log(`✓ Migration completed successfully`);
      console.log(`  - Modified ${result.modifiedCount} exam(s)`);
      console.log(`  - All exams without lateEntryGracePeriod now have default value -1 (allow late entry anytime)`);
      
      return true;
    } catch (error) {
      console.error('✗ Migration failed:', error);
      throw error;
    }
  },

  async down(db) {
    console.log('Rolling back migration: Set default lateEntryGracePeriod to -1...');
    
    try {
      // Rollback: Remove lateEntryGracePeriod field from exams that have it set to -1
      const result = await db.collection('exams').updateMany(
        { lateEntryGracePeriod: -1 },
        {
          $unset: { lateEntryGracePeriod: "" }
        }
      );

      console.log(`✓ Rollback completed successfully`);
      console.log(`  - Modified ${result.modifiedCount} exam(s)`);
      console.log(`  - Removed lateEntryGracePeriod field from exams that had value -1`);
      
      return true;
    } catch (error) {
      console.error('✗ Rollback failed:', error);
      throw error;
    }
  }
};


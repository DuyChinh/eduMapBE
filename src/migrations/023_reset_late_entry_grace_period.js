/**
 * Migration: Reset lateEntryGracePeriod field
 * 
 * Purpose: Remove/unset lateEntryGracePeriod from all existing exams
 * to ensure the default behavior is to allow late entry anytime.
 * 
 * Background: 
 * - Previously, lateEntryGracePeriod had a default value of 0
 * - New behavior: undefined/null = allow late entry anytime
 * - Only when explicitly set with a number, late entry is restricted
 */

module.exports = {
  async up(db) {
    console.log('Starting migration: Reset lateEntryGracePeriod...');
    
    try {
      // Remove lateEntryGracePeriod field from all exams
      // This ensures all existing exams will allow late entry anytime (default behavior)
      const result = await db.collection('exams').updateMany(
        {}, // Match all exams
        {
          $unset: { lateEntryGracePeriod: "" }
        }
      );

      console.log(`✓ Migration completed successfully`);
      console.log(`  - Modified ${result.modifiedCount} exam(s)`);
      console.log(`  - All exams now allow late entry anytime (default behavior)`);
      
      return true;
    } catch (error) {
      console.error('✗ Migration failed:', error);
      throw error;
    }
  },

  async down(db) {
    console.log('Rolling back migration: Reset lateEntryGracePeriod...');
    
    try {
      // Rollback: Set lateEntryGracePeriod back to 0 for all exams
      const result = await db.collection('exams').updateMany(
        {},
        {
          $set: { lateEntryGracePeriod: 0 }
        }
      );

      console.log(`✓ Rollback completed successfully`);
      console.log(`  - Modified ${result.modifiedCount} exam(s)`);
      
      return true;
    } catch (error) {
      console.error('✗ Rollback failed:', error);
      throw error;
    }
  }
};


/**
 * Migration 019: Remove legacy exam fields (allowGuest, accessType)
 * 
 * This migration removes deprecated fields from the Exam collection:
 * - allowGuest
 * - accessType
 * 
 * These fields have been replaced by isAllowUser
 */

module.exports = {
  async up(db, client) {
    const examsCollection = db.collection('exams');
    
    console.log('🔄 Starting migration 019: Remove legacy exam fields');
    
    // Count exams with legacy fields
    const countWithAllowGuest = await examsCollection.countDocuments({ allowGuest: { $exists: true } });
    const countWithAccessType = await examsCollection.countDocuments({ accessType: { $exists: true } });
    
    console.log(`📊 Found ${countWithAllowGuest} exams with allowGuest field`);
    console.log(`📊 Found ${countWithAccessType} exams with accessType field`);
    
    // Remove allowGuest field
    if (countWithAllowGuest > 0) {
      const resultAllowGuest = await examsCollection.updateMany(
        { allowGuest: { $exists: true } },
        { $unset: { allowGuest: "" } }
      );
      console.log(`✅ Removed allowGuest from ${resultAllowGuest.modifiedCount} exams`);
    }
    
    // Remove accessType field
    if (countWithAccessType > 0) {
      const resultAccessType = await examsCollection.updateMany(
        { accessType: { $exists: true } },
        { $unset: { accessType: "" } }
      );
      console.log(`✅ Removed accessType from ${resultAccessType.modifiedCount} exams`);
    }
    
    console.log('✅ Migration 019 completed successfully');
  },

  async down(db, client) {
    // Note: We don't restore these fields as they have been replaced by isAllowUser
    // If needed, you can manually map isAllowUser back to these fields:
    // - allowGuest: true when isAllowUser is 'everyone'
    // - accessType: 'public' when isAllowUser is 'everyone', 'private' when isAllowUser is 'class'
    
    console.log('⚠️  Down migration for 019 skipped - legacy fields should not be restored');
  }
};



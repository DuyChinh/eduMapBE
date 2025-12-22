/**
 * Migration: Remove legacy fields from profile (phone, department)
 * 
 * Purpose: Cleanup User profile after schema update.
 * - Moves profile.phone to phone (root) if root phone is missing.
 * - Removes profile.phone and profile.department.
 */

module.exports = {
    async up(db) {
        console.log('Starting migration: Cleanup profile fields...');

        try {
            // 1. Migrate phone numbers from profile to root if root is empty
            // We use a cursor to handle this logic safely
            // Only target users who have profile.phone and NO root phone
            const usersToMigrate = await db.collection('users').find({
                'profile.phone': { $exists: true, $ne: null, $ne: "" },
                $or: [{ phone: { $exists: false } }, { phone: null }]
            }).toArray();

            if (usersToMigrate.length > 0) {
                console.log(`Found ${usersToMigrate.length} users to migrate phone number from profile to root.`);

                let migratedCount = 0;
                let errorCount = 0;

                for (const user of usersToMigrate) {
                    try {
                        // Check for duplicate phone before updating to avoid duplicate key error
                        const existingPhone = await db.collection('users').findOne({
                            phone: user.profile.phone,
                            _id: { $ne: user._id }
                        });

                        if (!existingPhone) {
                            await db.collection('users').updateOne(
                                { _id: user._id },
                                { $set: { phone: user.profile.phone } }
                            );
                            migratedCount++;
                        } else {
                            console.warn(`Skipping phone migration for user ${user._id}: Phone ${user.profile.phone} already exists on another user.`);
                            errorCount++;
                        }
                    } catch (err) {
                        console.error(`Failed to migrate phone for user ${user._id}`, err);
                        errorCount++;
                    }
                }
                console.log(`Migrated phones: ${migratedCount}, Skipped/Failed: ${errorCount}`);
            }

            // 2. Remove phone and department from profile for ALL users
            const result = await db.collection('users').updateMany(
                {
                    $or: [
                        { 'profile.phone': { $exists: true } },
                        { 'profile.department': { $exists: true } }
                    ]
                },
                {
                    $unset: {
                        'profile.phone': "",
                        'profile.department': ""
                    }
                }
            );

            console.log(`✓ Cleanup completed`);
            console.log(`  - Modified ${result.modifiedCount} users (removed profile.phone/department)`);

            return true;
        } catch (error) {
            console.error('✗ Migration failed:', error);
            throw error;
        }
    },

    async down(db) {
        console.log('Rolling back migration: Cleanup profile fields...');
        // Data destruction in 'up' makes full rollback impossible without backup.
        // We can at least try to move root phone back to profile.phone for users who have it?
        // But we don't know who had it there originally vs who had it at root.
        // So we will just leave it, or maybe add the fields back as empty?

        // For 'department', we definitely lost the data.
        // This is a destructive migration.

        console.log('⚠ This migration was destructive (removed fields). Full rollback of data is not possible.');
        console.log('Restoring schema fields support (no-op in DB, just code revert presumed).');

        return true;
    }
};

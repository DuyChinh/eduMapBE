/**
 * Migration: Add user details fields (dob, phone, address)
 * 
 * Purpose: Ensure unique index for phone field and establish schema support.
 * The fields themselves (dob, phone, address) are optional and usually 
 * added via application logic, but the unique index requires DB-level creation.
 */

module.exports = {
    async up(db) {
        console.log('Starting migration: Add user phone index...');

        try {
            // Create unique sparse index for phone
            // sparse: true is important because many users might not have a phone number initially
            await db.collection('users').createIndex(
                { phone: 1 },
                {
                    unique: true,
                    sparse: true,
                    name: "phone_1" // Explicit name to make rollback easier
                }
            );

            console.log(`✓ Created unique index for 'phone' field on 'users' collection`);

            // Optionally we could iterate over users and set default nulls, but for sparse index and optional fields usually better to leave them out if undefined.

            return true;
        } catch (error) {
            console.error('✗ Migration failed:', error);
            throw error;
        }
    },

    async down(db) {
        console.log('Rolling back migration: Remove user phone index...');

        try {
            // Check if index exists before dropping to avoid errors
            const indexes = await db.collection('users').indexes();
            const indexExists = indexes.some(idx => idx.name === 'phone_1');

            if (indexExists) {
                await db.collection('users').dropIndex("phone_1");
                console.log(`✓ Dropped index 'phone_1'`);
            } else {
                console.log(`ℹ Index 'phone_1' not found, skipping drop`);
            }

            return true;
        } catch (error) {
            console.error('✗ Rollback failed:', error);
            throw error;
        }
    }
};

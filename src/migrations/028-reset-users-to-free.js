module.exports = {
    async up(db, client) {
        const result = await db.collection('users').updateMany(
            {},
            {
                $set: {
                    'subscription.plan': 'free',
                    'subscription.expiresAt': null
                }
            }
        );
        console.log(`Reset ${result.modifiedCount} users to FREE plan.`);
    },

    async down(db, client) {
        // Rollback logic is not applicable as we don't store previous state
        console.log('Rollback for reset-users-to-free is not implemented.');
    }
};

/**
 * Migration: Create AuditLogs collection
 * Purpose: Track system-wide CRUD operations for admin auditing
 */

module.exports = {
    async up(db) {
        console.log('Creating AuditLogs collection with indexes...');

        // Check if collection exists
        const collections = await db.listCollections({ name: 'auditlogs' }).toArray();

        if (collections.length === 0) {
            // Create the collection
            await db.createCollection('auditlogs', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['action', 'collectionName', 'documentId', 'timestamp'],
                        properties: {
                            action: {
                                enum: ['CREATE', 'UPDATE', 'DELETE'],
                                description: 'Type of action - required'
                            },
                            collectionName: {
                                bsonType: 'string',
                                description: 'Name of the collection - required'
                            },
                            documentId: {
                                bsonType: 'objectId',
                                description: 'ID of the changed document - required'
                            },
                            documentData: {
                                bsonType: 'object',
                                description: 'Snapshot of the document data'
                            },
                            performedBy: {
                                bsonType: 'object',
                                properties: {
                                    userId: { bsonType: ['objectId', 'null'] },
                                    email: { bsonType: ['string', 'null'] },
                                    role: { bsonType: ['string', 'null'] }
                                }
                            },
                            timestamp: {
                                bsonType: 'date',
                                description: 'When the activity occurred - required'
                            },
                            ipAddress: { bsonType: ['string', 'null'] },
                            userAgent: { bsonType: ['string', 'null'] },
                            createdAt: { bsonType: 'date' },
                            updatedAt: { bsonType: 'date' }
                        }
                    }
                }
            });
            console.log('AuditLogs collection created');
        } else {
            console.log('AuditLogs collection already exists, skipping creation');
        }

        // Create indexes for performance
        const indexes = [
            { keys: { timestamp: -1 }, options: { name: 'idx_timestamp_desc' } },
            { keys: { collectionName: 1, action: 1 }, options: { name: 'idx_collection_action' } },
            { keys: { 'performedBy.userId': 1 }, options: { name: 'idx_performed_by_user' } }
        ];

        for (const index of indexes) {
            try {
                await db.collection('auditlogs').createIndex(index.keys, index.options);
                console.log(`Created index: ${index.options.name}`);
            } catch (error) {
                if (error.code === 85 || error.message.includes('already exists')) {
                    console.log(`Index ${index.options.name} already exists, skipping`);
                } else {
                    throw error;
                }
            }
        }

        console.log('AuditLogs collection setup completed successfully');
    },

    async down(db) {
        console.log('Dropping AuditLogs collection...');
        try {
            await db.collection('auditlogs').drop();
            console.log('AuditLogs collection dropped successfully');
        } catch (error) {
            if (error.code === 26) {
                console.log('AuditLogs collection does not exist');
            } else {
                throw error;
            }
        }
    }
};

const mongoose = require('mongoose');

class ChangeStreamService {
    constructor(io) {
        this.io = io;
        this.watchedCollections = ['users', 'exams', 'classes', 'questions']; // Collections to watch
    }

    init() {

        this.watchedCollections.forEach(collectionName => {
            const collection = mongoose.connection.collection(collectionName);
            const changeStream = collection.watch([], { fullDocument: 'updateLookup' });

            changeStream.on('change', async (change) => {
                await this.handleDbChange(collectionName, change);
            });

            changeStream.on('error', (error) => {
                console.error(`Change Stream error in ${collectionName}:`, error);
            });
        });
    }

    async handleDbChange(collectionName, change) {
        // Only care about insert, update, replace, delete
        const relevantOps = ['insert', 'update', 'replace', 'delete'];
        if (!relevantOps.includes(change.operationType)) return;

        // Emit to Socket.io for Realtime Audit Log UI refresh
        // Note: Actual audit logs with user info are created in controllers via auditLogService
        this.io.emit('db_change', {
            action: this.mapOperationType(change.operationType),
            collectionName: collectionName,
            documentId: change.documentKey._id,
            timestamp: new Date()
        });
    }

    mapOperationType(opType) {
        switch (opType) {
            case 'insert': return 'CREATE';
            case 'update':
            case 'replace': return 'UPDATE';
            case 'delete': return 'DELETE';
            default: return opType.toUpperCase();
        }
    }
}

module.exports = ChangeStreamService;

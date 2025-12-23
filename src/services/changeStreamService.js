const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

class ChangeStreamService {
    constructor(io) {
        this.io = io;
        this.watchedCollections = ['users', 'exams', 'classes', 'questions']; // Collections to watch
    }

    init() {
        console.log('Initializing Change Streams...');

        // We can watch the entire database or specific collections.
        // Watching specific collections is safer and more controlled.
        this.watchedCollections.forEach(collectionName => {
            // Get the model dynamically if possible, or use mongoose.connection.collection
            const collection = mongoose.connection.collection(collectionName);

            const changeStream = collection.watch([], { fullDocument: 'updateLookup' });

            changeStream.on('change', async (change) => {
                console.log(`[DEBUG] Change Stream Event in ${collectionName}:`, change.operationType);
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

        const logData = {
            action: this.mapOperationType(change.operationType),
            collectionName: collectionName,
            documentId: change.documentKey._id,
            timestamp: new Date(),
            // Note: Change Streams don't give us "performedBy" naturally. 
            // This will be "System/Unknown" unless we cross-reference logs or trigger explicit log creation elsewhere.
            // For this implementation, we focus on capturing the EVENT.
            documentData: change.fullDocument || {},
            performedBy: {
                email: 'System / ChangeStream', // Placeholder
                role: 'system'
            }
        };

        // 1. Emit to Socket.io for Realtime Audit Log UI
        console.log('[DEBUG] Emitting socket event: db_change');
        this.io.emit('db_change', logData);

        // 2. Persist to AuditLog collection
        try {
            if (collectionName === 'auditlogs') return;

            const newLog = await AuditLog.create(logData);
            console.log('[DEBUG] AuditLog saved to DB:', newLog._id);
        } catch (err) {
            console.error('Failed to create AuditLog from stream:', err);
        }
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

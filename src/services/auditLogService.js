const AuditLog = require('../models/AuditLog');

/**
 * Create an audit log entry
 * @param {Object} params - Audit log parameters
 * @param {string} params.action - 'CREATE', 'UPDATE', or 'DELETE'
 * @param {string} params.collectionName - Name of the collection
 * @param {ObjectId} params.documentId - ID of the document
 * @param {Object} params.documentData - Data of the document (optional)
 * @param {Object} params.user - User who performed the action (from req.user)
 * @param {string} params.ipAddress - IP address (optional)
 * @param {string} params.userAgent - User agent (optional)
 */
async function createLog({ action, collectionName, documentId, documentData = {}, user, ipAddress, userAgent }) {
    try {
        const logData = {
            action,
            collectionName,
            documentId,
            documentData,
            timestamp: new Date(),
            performedBy: {
                userId: user?.id || user?.userId || user?._id,
                email: user?.email || 'Unknown',
                role: user?.role || 'unknown'
            },
            ipAddress,
            userAgent
        };

        await AuditLog.create(logData);
    } catch (err) {
        console.error('Failed to create AuditLog:', err.message);
    }
}

/**
 * Log a CREATE action
 */
async function logCreate(collectionName, documentId, documentData, user, req) {
    await createLog({
        action: 'CREATE',
        collectionName,
        documentId,
        documentData,
        user,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.get?.('User-Agent')
    });
}

/**
 * Log an UPDATE action
 */
async function logUpdate(collectionName, documentId, documentData, user, req) {
    await createLog({
        action: 'UPDATE',
        collectionName,
        documentId,
        documentData,
        user,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.get?.('User-Agent')
    });
}

/**
 * Log a DELETE action
 */
async function logDelete(collectionName, documentId, documentData, user, req) {
    await createLog({
        action: 'DELETE',
        collectionName,
        documentId,
        documentData,
        user,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.get?.('User-Agent')
    });
}

module.exports = {
    createLog,
    logCreate,
    logUpdate,
    logDelete
};

const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: ['CREATE', 'UPDATE', 'DELETE']
    },
    collectionName: {
        type: String,
        required: true
    },
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    documentData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    performedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        email: String,
        role: String
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    ipAddress: String,
    userAgent: String
}, {
    timestamps: true
});

// Index for efficient sorting and filtering
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ collectionName: 1, action: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);

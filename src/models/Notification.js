const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    },
    type: {
        type: String,
        enum: ['NEW_POST', 'NEW_COMMENT', 'CUSTOM', 'CLASS_REMOVAL', 'CLASS_ADDITION', 'EXAM_PUBLISHED', 'SUBMISSION_GRADED', 'LATE_SUBMISSION', 'MINDMAP_SHARED'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeedPost'
    },
    onModel: {
        type: String,
        enum: ['FeedPost', 'Class', 'Mindmap', 'Exam', 'Submission'],
        default: 'FeedPost'
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Notification', NotificationSchema);

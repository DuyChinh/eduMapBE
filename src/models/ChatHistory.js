const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['image', 'file'],
        required: true
    },
    url: { type: String, required: true },
    name: { type: String }
}, { _id: false });

const chatHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatSession',
        required: true
    },
    sender: {
        type: String,
        enum: ['user', 'bot'],
        required: true
    },
    message: {
        type: String,
        default: ''
    },
    attachments: [attachmentSchema],
    isError: {
        type: Boolean,
        default: false
    }
}, { timestamps: true, collection: 'ai_chat_messages' });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);

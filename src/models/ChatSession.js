const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: 'New Chat'
    },
    lastMessage: {
        type: String
    },
    pinned: {
        type: Boolean,
        default: false
    }
}, { timestamps: true, collection: 'ai_chat_sessions' });

module.exports = mongoose.model('ChatSession', chatSessionSchema);

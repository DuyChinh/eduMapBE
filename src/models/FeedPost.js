const mongoose = require('mongoose');

// Reaction schema for both posts and comments
const ReactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
        default: 'like'
    }
}, { _id: false });

const CommentSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        trim: true
    },
    images: [{
        type: String
    }],
    files: [{
        name: String,
        url: String,
        type: { type: String }
    }],
    links: [{
        title: String,
        url: String,
        description: String
    }],
    // Mentions support
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Reactions for comments
    reactions: [ReactionSchema],
    // Reply threading
    parentCommentId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    replyToUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

const FeedPostSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
        index: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    images: [{
        type: String
    }],
    files: [{
        name: String,
        url: String,
        type: { type: String }
    }],
    links: [{
        title: String,
        url: String,
        description: String
    }],
    // Mentions support
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Reactions instead of simple likes
    reactions: [ReactionSchema],
    // Keep likes for backward compatibility (migration)
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isLocked: {
        type: Boolean,
        default: false
    },
    comments: [CommentSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('FeedPost', FeedPostSchema);


const mongoose = require('mongoose');

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
    }]
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

const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
    orgId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    name_en: {
        type: String,
        trim: true
    },
    name_jp: {
        type: String,
        trim: true
    },
    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    grade: {
        type: String,
        trim: true
    },
    // For search and display convenience
    slug: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Unique within an organization (or system-wide if orgId is not used)
SubjectSchema.index({
    orgId: 1,
    code: 1
}, {
    unique: true,
    partialFilterExpression: {
        code: {
            $exists: true
        }
    }
});
SubjectSchema.index({
    orgId: 1,
    name: 1
});

module.exports = mongoose.model('Subject', SubjectSchema);
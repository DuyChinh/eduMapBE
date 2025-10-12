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
    // tiện tìm kiếm/hiển thị
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

// unique trong 1 org (hoặc toàn hệ thống nếu bạn không dùng orgId)
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
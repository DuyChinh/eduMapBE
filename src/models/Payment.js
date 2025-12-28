const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'VND'
    },
    orderInfo: {
        type: String,
        required: true
    },
    orderType: {
        type: String,
        default: 'other'
    },
    status: {
        type: String,
        enum: ['PENDING', 'SUCCESS', 'FAILED'],
        default: 'PENDING'
    },
    txnRef: {
        type: String,
        required: true,
        unique: true
    },
    // Fields from VNPAY response
    vnpTransactionNo: String,
    vnpBankCode: String,
    vnpBankTranNo: String,
    vnpCardType: String,
    vnpPayDate: String,
    vnpResponseCode: String,
    vnpTmnCode: String,
    vnpTransactionStatus: String,
    statusDescription: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);

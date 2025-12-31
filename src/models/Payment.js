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
    // Generic Gateway Fields (Normalized for VNPay, SePay, etc.)
    gatewayTransactionId: String, // Transaction ID from the Payment Gateway (e.g. SePay ID, VNPay TransactionNo)
    gatewayBankCode: String,      // Bank Code (e.g. MB, VCB, NCB)
    gatewayCardType: String,      // Card Type (e.g. ATM, QRCODE, VISA)
    gatewayPayDate: String,       // Payment Date from Gateway
    gatewayResponseCode: String,  // Response Code (e.g. 00, SUCCESS)
    statusDescription: String     // Human readable status description
}, {
    timestamps: true
});

// Auto-delete PENDING transactions after 24 hours to keep DB clean
paymentSchema.index({ createdAt: 1 }, {
    expireAfterSeconds: 86400,
    partialFilterExpression: { status: 'PENDING' }
});

module.exports = mongoose.model('Payment', paymentSchema);

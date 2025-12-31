const vnpayService = require('../services/vnpayService');
const Payment = require('../models/Payment');
const User = require('../models/User');
const emailService = require('../services/emailService');

const updateUserSubscription = async (userId, amount) => {
    try {
        if (!userId) return;

        const amountNum = parseFloat(amount);
        let newPlan = 'free';

        if (amountNum >= 20000) {
            newPlan = 'pro';
        } else if (amountNum >= 10000) {
            newPlan = 'plus';
        } else {
            return; // No upgrade for small amounts
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); // 30 days validity

        const updatedUser = await User.findByIdAndUpdate(userId, {
            'subscription.plan': newPlan,
            'subscription.expiresAt': expiryDate
        }, { new: true });

        console.log(`User ${userId} upgraded to ${newPlan} until ${expiryDate}`);

        // Send Email Notification
        if (updatedUser && updatedUser.email) {
            const userName = updatedUser.fullName || updatedUser.username || 'User';
            await emailService.sendSubscriptionSuccessEmail(
                updatedUser.email,
                userName,
                newPlan,
                expiryDate,
                updatedUser.language || 'vi'
            );
        }

    } catch (error) {
        console.error('Failed to update user subscription:', error);
    }
};

const paymentController = {
    createSePayTransaction: async (req, res) => {
        try {
            const { amount, orderInfo } = req.body;
            const userId = req.user ? req.user._id : null;

            if (!amount || !orderInfo) {
                return res.status(400).json({ message: 'Amount and Order Info are required' });
            }

            process.env.TZ = 'Asia/Ho_Chi_Minh';
            const date = new Date();
            // Format: DDHHmmss (day + hours + minutes + seconds)
            const formatTxnRef = (d) => {
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');
                return `${day}${hours}${minutes}${seconds}`;
            };
            const txnRef = formatTxnRef(date);

            // Create pending transaction
            if (userId) {
                try {
                    await Payment.create({
                        userId,
                        amount,
                        orderInfo,
                        orderType: 'sepay',
                        txnRef,
                        status: 'PENDING'
                    });
                } catch (dbError) {
                    console.error('DB Create Error:', dbError);
                    return res.status(500).json({ message: 'Database Error' });
                }
            } else {
                return res.status(400).json({ message: 'User not authenticated' });
            }

            res.status(200).json({
                status: 'success',
                txnRef,
                amount,
                orderInfo: `EDUMAP ${txnRef}`
            });

        } catch (error) {
            console.error('Create SePay Transaction Error:', error);
            res.status(500).json({
                message: 'Internal Server Error',
                error: error.message
            });
        }
    },

    sepayWebhook: async (req, res) => {
        try {
            const sepayConfig = require('../config/sepay');
            const data = req.body;

            // Verify Authorization Header (API Key Authentication)
            const authHeader = req.headers['authorization'];
            const apiKey = sepayConfig.apiKey;

            if (!authHeader || !authHeader.includes(apiKey)) {
                console.warn('SePay Webhook: Unauthorized. Key not found in header.');
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            const { transactionDate, content, transferAmount, referenceCode } = data;

            // regex to extract txnRef
            const match = content.match(/EDUMAP\s*(\d+)/i);
            if (!match) {
                console.log('SePay Webhook: No matching content found', content);
                return res.status(200).json({ success: true, message: 'No matching content' });
            }

            const txnRef = match[1];

            const payment = await Payment.findOne({ txnRef });

            if (!payment) {
                console.log('SePay Webhook: Transaction not found', txnRef);
                return res.status(200).json({ success: true, message: 'Transaction not found' });
            }

            if (payment.status === 'SUCCESS') {
                return res.status(200).json({ success: true, message: 'Transaction already processed' });
            }

            // Verify Amount
            if (parseFloat(transferAmount) < payment.amount) {
                console.log('SePay Webhook: Amount mismatch', transferAmount, payment.amount);
                return res.status(200).json({ success: true, message: 'Amount mismatch' });
            }

            // Update Transaction
            payment.status = 'SUCCESS';
            payment.gatewayTransactionId = String(data.id); // Save SePay ID
            payment.gatewayBankCode = data.gateway;
            payment.gatewayPayDate = transactionDate;
            payment.statusDescription = 'SePay Success';
            await payment.save();

            // Update User Subscription
            await updateUserSubscription(payment.userId, payment.amount);

            const socketService = require('../services/socketService');
            socketService.emitPaymentUpdate(payment.userId, {
                status: 'SUCCESS',
                txnRef: payment.txnRef,
                amount: payment.amount
            });

            return res.status(200).json({ success: true, message: 'Updated successfully' });

        } catch (error) {
            console.error('SePay Webhook Error:', error);
            res.status(500).json({ success: false, message: 'Internal Error' });
        }
    },

    createPaymentUrl: async (req, res) => {
        try {
            const { amount, orderInfo, orderType } = req.body;
            const userId = req.user ? req.user._id : null;

            if (!amount || !orderInfo) {
                return res.status(400).json({ message: 'Amount and Order Info are required' });
            }

            process.env.TZ = 'Asia/Ho_Chi_Minh';
            const date = new Date();
            // Format: DDHHmmss (day + hours + minutes + seconds)
            const formatTxnRef = (d) => {
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');
                return `${day}${hours}${minutes}${seconds}`;
            };
            const txnRef = formatTxnRef(date);

            const paymentUrl = vnpayService.createPaymentUrl(req, amount, orderInfo, orderType, txnRef);

            if (userId) {
                try {
                    await Payment.create({
                        userId,
                        amount,
                        orderInfo,
                        orderType,
                        txnRef,
                        status: 'PENDING'
                    });
                } catch (dbError) {
                    console.error('DB Create Error:', dbError);
                }
            } else {
                console.warn('Warning: No User ID found. Transaction not saved to DB.');
            }

            res.status(200).json({ paymentUrl });
        } catch (error) {
            console.error('Create Payment URL Error:', error);
            res.status(500).json({
                message: 'Internal Server Error',
                error: error.message
            });
        }
    },

    verifyReturn: async (req, res) => {
        try {
            const vnp_Params = req.query;

            const isVerified = vnpayService.verifyReturnUrl(vnp_Params);

            const vnpPayDate = vnp_Params['vnp_PayDate'];
            // Format from YYYYMMDDHHmmss to YYYY-MM-DD HH:mm:ss
            const formatPayDate = (dateStr) => {
                if (!dateStr || dateStr.length !== 14) return dateStr;
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                const hours = dateStr.substring(8, 10);
                const minutes = dateStr.substring(10, 12);
                const seconds = dateStr.substring(12, 14);
                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            };
            const formattedPayDate = vnpPayDate ? formatPayDate(vnpPayDate) : vnpPayDate;

            const RESPONSE_MAP = {
                '00': 'Giao dịch thành công',
                '01': 'Giao dịch chưa hoàn tất',
                '02': 'Giao dịch bị lỗi',
                '04': 'Giao dịch đảo (Khách hàng đã bị trừ tiền tại Ngân hàng nhưng GD chưa thành công ở VNPAY)',
                '05': 'VNPAY đang xử lý giao dịch này (GD hoàn tiền)',
                '06': 'VNPAY đã gửi yêu cầu hoàn tiền sang Ngân hàng (GD hoàn tiền)',
                '07': 'Giao dịch bị nghi ngờ gian lận',
                '09': 'GD Hoàn trả bị từ chối',
                '10': 'Đã hoàn trả',
                '11': 'Đã hoàn trả (Chờ xử lý)',
                '12': 'Đã hoàn trả (Từ chối)',
                '24': 'Giao dịch hủy do khách hàng không xác nhận',
                '51': 'Tài khoản không đủ số dư',
                '65': 'Tài khoản quá hạn sử dụng',
                '75': 'Ngân hàng thanh toán đang bảo trì',
                '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
                '99': 'Lỗi không xác định'
            };

            const txnRef = vnp_Params['vnp_TxnRef'];
            const responseCode = vnp_Params['vnp_ResponseCode'];
            const transactionUpdate = {
                gatewayTransactionId: vnp_Params['vnp_TransactionNo'],
                gatewayBankCode: vnp_Params['vnp_BankCode'],
                gatewayCardType: vnp_Params['vnp_CardType'],
                gatewayPayDate: formattedPayDate,
                gatewayResponseCode: responseCode,
                statusDescription: RESPONSE_MAP[responseCode] || 'Trạng thái không xác định',
                currency: vnp_Params['vnp_CurrCode'] || 'VND'
            };

            if (isVerified) {
                if (vnp_Params['vnp_ResponseCode'] === '00') {
                    // Success
                    transactionUpdate.status = 'SUCCESS';

                    // Respond First
                    res.status(200).json({
                        status: 'success',
                        message: 'Payment Verified',
                        code: vnp_Params['vnp_ResponseCode']
                    });
                } else {
                    // Failed
                    transactionUpdate.status = 'FAILED';
                    res.status(200).json({
                        status: 'failed',
                        message: 'Payment Failed',
                        code: vnp_Params['vnp_ResponseCode']
                    });
                }
            } else {
                // Checksum failed
                transactionUpdate.status = 'FAILED';
                console.error("Checksum verification failed for TxnRef:", txnRef);
                res.status(200).json({
                    status: 'failed',
                    message: 'Invalid Checksum',
                    code: '97'
                });
            }

            if (txnRef) {
                await Payment.findOneAndUpdate(
                    { txnRef: txnRef },
                    transactionUpdate,
                    { new: true, upsert: false }
                );
            }

        } catch (error) {
            console.error('Verify Return Error:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    },

    vnpayReturn: async (req, res) => {
        try {
            let vnp_Params = { ...req.query };

            const isVerified = vnpayService.verifyReturnUrl(vnp_Params);
            const txnRef = vnp_Params['vnp_TxnRef'];

            if (isVerified) {
                if (vnp_Params['vnp_ResponseCode'] === '00') {
                    // Success
                    const payment = await Payment.findOneAndUpdate(
                        { txnRef: txnRef },
                        {
                            status: 'SUCCESS',
                            gatewayTransactionId: vnp_Params['vnp_TransactionNo'],
                            gatewayBankCode: vnp_Params['vnp_BankCode'],
                            gatewayCardType: vnp_Params['vnp_CardType'],
                            gatewayPayDate: vnp_Params['vnp_PayDate'],
                            gatewayResponseCode: vnp_Params['vnp_ResponseCode'],
                            statusDescription: 'Giao dịch thành công'
                        },
                        { new: true }
                    );

                    // Update User Subscription
                    if (payment) {
                        await updateUserSubscription(payment.userId, payment.amount);
                    }

                    console.log('Payment Successful. Redirecting to success page.');
                    const frontendUrl = `http://localhost:5173/payment/result?status=success&code=${vnp_Params['vnp_ResponseCode']}`;
                    return res.redirect(frontendUrl);
                } else {
                    // Failed
                    await Payment.findOneAndUpdate(
                        { txnRef: txnRef },
                        {
                            status: 'FAILED',
                            gatewayResponseCode: vnp_Params['vnp_ResponseCode'],
                            statusDescription: 'Giao dịch thất bại'
                        },
                        { new: true }
                    );

                    console.log('Payment Failed/Cancelled via Response Code.');
                    const frontendUrl = `http://localhost:5173/payment/result?status=failed&code=${vnp_Params['vnp_ResponseCode']}`;
                    return res.redirect(frontendUrl);
                }
            } else {
                console.log('Checksum Mismatch! Redirecting with code 97.');
                const frontendUrl = `http://localhost:5173/payment/result?status=failed&code=97`;
                return res.redirect(frontendUrl);
            }
        } catch (error) {
            console.error('VNPAY Return Error:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    },

    vnpayIpn: async (req, res) => {
        try {
            const vnp_Params = req.query;

            const isVerified = vnpayService.verifyIpn(vnp_Params);

            if (isVerified) {
                const txnRef = vnp_Params['vnp_TxnRef'];
                const rspCode = vnp_Params['vnp_ResponseCode'];

                if (rspCode === '00') {
                    const payment = await Payment.findOneAndUpdate(
                        { txnRef: txnRef },
                        {
                            status: 'SUCCESS',
                            gatewayTransactionId: vnp_Params['vnp_TransactionNo'],
                            gatewayBankCode: vnp_Params['vnp_BankCode'],
                            gatewayPayDate: vnp_Params['vnp_PayDate'],
                            gatewayResponseCode: rspCode,
                            statusDescription: 'Giao dịch thành công'
                        },
                        { new: true }
                    );

                    // Update User Subscription
                    if (payment) {
                        await updateUserSubscription(payment.userId, payment.amount);
                    }
                } else {
                    await Payment.findOneAndUpdate(
                        { txnRef: txnRef },
                        {
                            status: 'FAILED',
                            gatewayResponseCode: rspCode,
                            statusDescription: 'Giao dịch thất bại'
                        },
                        { new: true }
                    );
                }

                res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
            } else {
                res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum' });
            }
        } catch (error) {
            console.error('VNPAY IPN Error:', error);
            res.status(200).json({ RspCode: '99', Message: 'Unknown Error' });
        }
    },

    getPaymentHistory: async (req, res) => {
        try {
            const userId = req.user._id;
            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const payments = await Payment.find({ userId }).sort({ createdAt: -1 });

            try {
                const now = new Date();
                let activePlan = 'free';
                let activeExpiry = null;

                for (const p of payments) {
                    if (p.status === 'SUCCESS') {
                        const payDate = p.gatewayPayDate ? new Date(p.gatewayPayDate) : new Date(p.createdAt);
                        const expiryDate = new Date(payDate);
                        expiryDate.setDate(expiryDate.getDate() + 30);

                        if (expiryDate > now) {
                            let planFromPayment = 'free';
                            if (p.amount >= 20000) planFromPayment = 'pro';
                            else if (p.amount >= 10000) planFromPayment = 'plus';

                            const PLAN_PRIORITY = { 'free': 0, 'plus': 1, 'pro': 2 };

                            if (PLAN_PRIORITY[planFromPayment] > PLAN_PRIORITY[activePlan]) {
                                activePlan = planFromPayment;
                                activeExpiry = expiryDate;
                            } else if (PLAN_PRIORITY[planFromPayment] === PLAN_PRIORITY[activePlan]) {
                                if (activeExpiry && expiryDate > activeExpiry) {
                                    activeExpiry = expiryDate;
                                } else if (!activeExpiry) {
                                    activeExpiry = expiryDate;
                                }
                            }
                        }
                    }
                }

                if (activePlan !== 'free') {
                    const User = require('../models/User');
                    const currentUser = await User.findById(userId);

                    const currentExpiry = currentUser.subscription?.expiresAt ? new Date(currentUser.subscription.expiresAt).getTime() : 0;
                    const newExpiry = activeExpiry ? activeExpiry.getTime() : 0;

                    // Trigger if plan is different OR expiry is extended (Renewal)
                    // Added 60s buffer to avoid duplicate triggering on same-time refreshes
                    const isDifferentPlan = !currentUser.subscription || currentUser.subscription.plan !== activePlan;
                    const isExtended = newExpiry > (currentExpiry + 60000);

                    if (isDifferentPlan || isExtended) {
                        const updatedUser = await User.findByIdAndUpdate(userId, {
                            'subscription.plan': activePlan,
                            'subscription.expiresAt': activeExpiry
                        }, { new: true });

                        if (updatedUser && updatedUser.email) {
                            const userName = updatedUser.fullName || updatedUser.username || 'User';
                            await emailService.sendSubscriptionSuccessEmail(
                                updatedUser.email,
                                userName,
                                activePlan,
                                activeExpiry,
                                updatedUser.language || 'vi'
                            );
                        }
                    }
                }
            } catch (syncError) {
                console.error('Lazy Sync Subscription Error:', syncError);
            }
            // ------------------------------------------------------------

            res.status(200).json({ success: true, data: payments });
        } catch (error) {
            console.error('Get Payment History Error:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
};

module.exports = paymentController;

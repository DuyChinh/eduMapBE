const vnpayService = require('../services/vnpayService');
const Payment = require('../models/Payment');

const paymentController = {
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
                    const newTransaction = await Payment.create({
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
                vnpTransactionNo: vnp_Params['vnp_TransactionNo'],
                vnpBankCode: vnp_Params['vnp_BankCode'],
                vnpBankTranNo: vnp_Params['vnp_BankTranNo'],
                vnpCardType: vnp_Params['vnp_CardType'],
                vnpPayDate: formattedPayDate,
                vnpResponseCode: responseCode,
                vnpTmnCode: vnp_Params['vnp_TmnCode'],
                vnpTransactionStatus: vnp_Params['vnp_TransactionStatus'],
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
            const secureHash = vnp_Params['vnp_SecureHash'];

            // Verify checksum
            const isVerified = vnpayService.verifyReturnUrl(vnp_Params);
            const txnRef = vnp_Params['vnp_TxnRef'];

            if (isVerified) {
                if (vnp_Params['vnp_ResponseCode'] === '00') {
                    // Success
                    await Payment.findOneAndUpdate(
                        { txnRef: txnRef },
                        { 
                            status: 'SUCCESS',
                            vnpTransactionNo: vnp_Params['vnp_TransactionNo'],
                            vnpBankCode: vnp_Params['vnp_BankCode'],
                            vnpCardType: vnp_Params['vnp_CardType'],
                            vnpPayDate: vnp_Params['vnp_PayDate'],
                            vnpResponseCode: vnp_Params['vnp_ResponseCode'],
                            statusDescription: 'Giao dịch thành công'
                        },
                        { new: true }
                    );

                    console.log('Payment Successful. Redirecting to success page.');
                    const frontendUrl = `http://localhost:5173/payment/result?status=success&code=${vnp_Params['vnp_ResponseCode']}`;
                    return res.redirect(frontendUrl);
                } else {
                    // Failed
                    await PaymentTransaction.findOneAndUpdate(
                        { txnRef: txnRef },
                        { 
                            status: 'FAILED',
                            vnpResponseCode: vnp_Params['vnp_ResponseCode'],
                            statusDescription: 'Giao dịch thất bại'
                        },
                        { new: true }
                    );

                    console.log('Payment Failed/Cancelled via Response Code.');
                    const frontendUrl = `http://localhost:5173/payment/result?status=failed&code=${vnp_Params['vnp_ResponseCode']}`;
                    return res.redirect(frontendUrl);
                }
            } else {
                // Checksum failed
                console.log('Checksum Mismatch! Redirecting with code 97.');
                const frontendUrl = `http://localhost:5173/payment/result?status=failed&code=97`; // 97: Invalid Checksum
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
            const secureHash = vnp_Params['vnp_SecureHash'];

            const isVerified = vnpayService.verifyIpn(vnp_Params);

            if (isVerified) {
                const txnRef = vnp_Params['vnp_TxnRef'];
                const rspCode = vnp_Params['vnp_ResponseCode'];
                
                if (rspCode === '00') {
                    await Payment.findOneAndUpdate(
                        { txnRef: txnRef },
                        { 
                            status: 'SUCCESS',
                            vnpTransactionNo: vnp_Params['vnp_TransactionNo'],
                            vnpBankCode: vnp_Params['vnp_BankCode'],
                            vnpCardType: vnp_Params['vnp_CardType'],
                            vnpPayDate: vnp_Params['vnp_PayDate'],
                            vnpResponseCode: rspCode,
                            statusDescription: 'Giao dịch thành công'
                        },
                        { new: true }
                    );
                } else {
                    await Payment.findOneAndUpdate(
                        { txnRef: txnRef },
                        { 
                            status: 'FAILED',
                            vnpResponseCode: rspCode,
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
    }
};

module.exports = paymentController;

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

const authMiddleware = require('../middlewares/auth');

router.post('/create_payment_url', authMiddleware, paymentController.createPaymentUrl);
router.get('/verify_return', paymentController.verifyReturn);
router.get('/vnpay_return', paymentController.vnpayReturn);
router.get('/vnpay_ipn', paymentController.vnpayIpn);

module.exports = router;

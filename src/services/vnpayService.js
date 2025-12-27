const vnpayConfig = require('../config/vnpay');
const crypto = require('crypto');
const querystring = require('qs');

class VnpayService {
    createPaymentUrl(req, amount, orderInfo, orderType = 'other', txnRef = null) {
        process.env.TZ = 'Asia/Ho_Chi_Minh';

        let date = new Date();
        // Format: YYYYMMDDHHmmss
        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}${hours}${minutes}${seconds}`;
        };
        let createDate = formatDate(date);

        let ipAddr = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;

        if (ipAddr === '::1') {
            ipAddr = '127.0.0.1';
        }

        let tmnCode = (vnpayConfig.vnp_TmnCode || '').trim();
        let secretKey = (vnpayConfig.vnp_HashSecret || '').trim();
        let vnpUrl = vnpayConfig.vnp_Url;
        let returnUrl = vnpayConfig.vnp_ReturnUrl;

        let vnp_Params = {};
        vnp_Params['vnp_Version'] = '2.1.0';
        vnp_Params['vnp_Command'] = 'pay';
        vnp_Params['vnp_TmnCode'] = tmnCode;
        vnp_Params['vnp_Locale'] = 'vn';
        vnp_Params['vnp_CurrCode'] = 'VND';
        // Format: DDHHmmss (day + hours + minutes + seconds)
        const formatTxnRef = (d) => {
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            return `${day}${hours}${minutes}${seconds}`;
        };
        vnp_Params['vnp_TxnRef'] = txnRef || formatTxnRef(date);
        vnp_Params['vnp_OrderInfo'] = orderInfo;
        vnp_Params['vnp_OrderType'] = orderType;
        vnp_Params['vnp_Amount'] = amount * 100;
        vnp_Params['vnp_ReturnUrl'] = returnUrl;
        vnp_Params['vnp_IpAddr'] = ipAddr;
        vnp_Params['vnp_CreateDate'] = createDate;

        vnp_Params = this.sortObject(vnp_Params);

        let signData = querystring.stringify(vnp_Params, { encode: false });



        let hmac = crypto.createHmac("sha512", secretKey);
        let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        vnp_Params['vnp_SecureHash'] = signed;
        vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

        return vnpUrl;
    }

    verifyReturnUrl(vnp_Params_Input) {
        let vnp_Params = { ...vnp_Params_Input };
        let secureHash = vnp_Params['vnp_SecureHash'];

        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        vnp_Params = this.sortObject(vnp_Params);
        let secretKey = (vnpayConfig.vnp_HashSecret || '').trim();

        let signData = querystring.stringify(vnp_Params, { encode: false });

        let hmac = crypto.createHmac("sha512", secretKey);
        let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");


        return secureHash === signed;
    }

    verifyIpn(vnp_Params) {
        return this.verifyReturnUrl(vnp_Params);
    }

    sortObject(obj) {
        let sorted = {};
        let str = [];
        let key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                str.push(encodeURIComponent(key));
            }
        }
        str.sort();
        for (key = 0; key < str.length; key++) {
            sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
        }
        return sorted;
    }
}

module.exports = new VnpayService();

const sepayConfig = {
    apiKey: process.env.SEPAY_API_KEY,
    bankAccount: process.env.SEPAY_BANK_ACCOUNT,
    bankName: process.env.SEPAY_BANK_NAME,
    accountName: process.env.SEPAY_ACCOUNT_NAME,
    bankCode: 'MB' // For VietQR
};

module.exports = sepayConfig;

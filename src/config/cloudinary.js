const cloudinary = require('cloudinary').v2;
require('dotenv').config();

console.log('Cloudinary Config Debug:');
console.log('CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('API_KEY:', process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'MISSING');
console.log('API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '***' : 'MISSING');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = cloudinary;

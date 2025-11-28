const multer = require('multer');

// Use memory storage to get buffer for Cloudinary and Gemini
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images (jpeg, png, webp) and PDFs are allowed!'), false);
        }
    }
});

module.exports = upload;

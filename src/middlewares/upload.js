const multer = require('multer');

// Use memory storage to get buffer for Cloudinary and Gemini
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream' // Sometimes ZIPs or other binaries show up as this
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            console.log('Blocked file type:', file.mimetype);
            cb(new Error('Invalid file type. Allowed: Images, PDF, Word, Excel, PowerPoint, Zip, Text'), false);
        }
    }
});

module.exports = upload;

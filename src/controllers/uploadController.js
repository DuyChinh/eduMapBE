const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'questions',
                        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
                    },
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };

        const result = await streamUpload(req);

        res.status(200).json({
            success: true,
            data: {
                url: result.secure_url,
                public_id: result.public_id
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading image',
            error: error.message
        });
    }
};

const getPublicIdFromUrl = (url) => {
    if (!url) return null;
    try {
        const parts = url.split('/upload/');
        if (parts.length < 2) return null;
        let publicId = parts[1];
        // Remove version if present
        publicId = publicId.replace(/^v\d+\//, '');
        // Remove extension
        publicId = publicId.substring(0, publicId.lastIndexOf('.'));
        return publicId;
    } catch (e) {
        return null;
    }
};

const deleteImage = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, message: 'URL is required' });
        }

        const publicId = getPublicIdFromUrl(url);
        if (!publicId) {
            return res.status(400).json({ success: false, message: 'Invalid URL' });
        }

        await cloudinary.uploader.destroy(publicId);

        res.json({ success: true, message: 'Image deleted' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
};

module.exports = {
    uploadImage,
    deleteImage
};

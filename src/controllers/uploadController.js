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
                const isImage = req.file.mimetype.startsWith('image/');
                const options = {
                    resource_type: isImage ? 'image' : 'raw'
                };

                if (isImage) {
                    options.folder = 'questions';
                    options.allowed_formats = ['jpg', 'png', 'jpeg', 'webp', 'gif'];
                } else {
                    const sanitize = (name) => name.replace(/[^a-zA-Z0-9.-]/g, '_');
                    const ext = req.file.originalname.split('.').pop();
                    const nameWithoutExt = req.file.originalname.substring(0, req.file.originalname.lastIndexOf('.'));

                    // Strategy: Upload as RAW with NO extension to bypass 'Strict PDF' security
                    options.folder = 'files';
                    options.public_id = `${Date.now()}_${sanitize(nameWithoutExt)}`;
                    options.resource_type = 'raw';
                    options.type = 'upload';
                }

                const stream = cloudinary.uploader.upload_stream(
                    options,
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

const deleteImageInternal = async (public_id) => {
    if (!public_id) throw new Error('public_id is required');
    return cloudinary.uploader.destroy(public_id);
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
        const { public_id } = req.body;

        if (!public_id) {
            return res.status(400).json({
                success: false,
                message: 'public_id is required'
            });
        }

        // Delete image from Cloudinary
        const result = await deleteImageInternal(public_id);

        if (result.result === 'ok' || result.result === 'not found') {
            return res.status(200).json({
                success: true,
                message: 'Image deleted successfully',
                data: result
            });
        } else {
            throw new Error('Failed to delete image');
        }

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting image',
            error: error.message
        });
    }
};

module.exports = {
    uploadImage,
    deleteImage,
    deleteImageInternal,
    getPublicIdFromUrl
};

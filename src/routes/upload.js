const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const upload = require('../middlewares/upload');
const auth = require('../middlewares/auth');

router.post('/', auth, upload.single('file'), uploadController.uploadImage);
router.delete('/', auth, uploadController.deleteImage);

module.exports = router;

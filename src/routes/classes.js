const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const auth = require('../middlewares/auth');

router.post('/', auth, classController.create);

module.exports = router;

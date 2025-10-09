const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const auth = require('../middlewares/auth');

router.post('/', auth, subjectController.create);
router.get('/', auth, subjectController.list);

module.exports = router;

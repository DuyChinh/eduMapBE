const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middlewares/auth');

// Get class report
router.get('/class/:classId', auth, reportController.getClassReport);

// Export class report as CSV
router.get('/class/:classId/export', auth, reportController.exportClassReport);

module.exports = router;


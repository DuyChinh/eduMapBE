const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middlewares/auth');

// Teacher dashboard
router.get('/teacher', auth, dashboardController.getTeacherDashboard);

// Student dashboard
router.get('/student', auth, dashboardController.getStudentDashboard);

module.exports = router;


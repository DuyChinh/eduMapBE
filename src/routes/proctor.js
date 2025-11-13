const express = require('express');
const router = express.Router();
const proctorController = require('../controllers/proctorController');
const auth = require('../middlewares/auth');

// Log proctoring event
router.post('/log', auth, proctorController.logEvent);

// Get logs for a submission
router.get('/submission/:submissionId', auth, proctorController.getSubmissionLogs);

// Get logs for an exam (teacher/admin only)
router.get('/exam/:examId', auth, proctorController.getExamLogs);

module.exports = router;


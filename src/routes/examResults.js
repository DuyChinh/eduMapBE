const express = require('express');
const router = express.Router();
const examStatsController = require('../controllers/examStatsController');
const auth = require('../middlewares/auth');

// Student exam results routes
router.get('/', auth, examStatsController.getOverallExamResults);
router.get('/subject-averages', auth, examStatsController.getSubjectAverageScores);

module.exports = router;


const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const auth = require('../middlewares/auth');

// Start exam submission
router.post('/start', auth, submissionController.startSubmission);

// Get submission by ID
router.get('/:id', auth, submissionController.getSubmissionById);

// Update answers (auto-save)
router.patch('/:id/answers', auth, submissionController.updateAnswers);

// Submit exam
router.post('/:id/submit', auth, submissionController.submitExam);

// Get all submissions for an exam (teacher/admin only)
router.get('/exam/:examId', auth, submissionController.getExamSubmissions);

// Get leaderboard for an exam
router.get('/exam/:examId/leaderboard', auth, submissionController.getExamLeaderboard);

module.exports = router;


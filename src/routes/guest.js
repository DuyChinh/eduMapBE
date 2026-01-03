const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guestController');

// Guest exam routes - NO authentication required
// These endpoints are for users who want to take exams without logging in

// Start a guest submission
router.post('/submissions/start', guestController.startGuestSubmission);

// Update guest answers (auto-save)
router.patch('/submissions/:id/answers', guestController.updateGuestAnswers);

// Submit guest exam
router.post('/submissions/:id/submit', guestController.submitGuestExam);

// Get guest submission by ID
router.get('/submissions/:id', guestController.getGuestSubmission);

module.exports = router;

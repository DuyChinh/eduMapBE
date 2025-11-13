const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const auth = require('../middlewares/auth');

// Exam CRUD operations
router.post('/', auth, examController.createExam);
router.get('/', auth, examController.getAllExams);
router.get('/share/:shareCode', examController.getExamByShareCode); // Public route - no auth required
router.get('/:id', auth, examController.getExamById);
router.patch('/:id', auth, examController.updateExam);
router.delete('/:id', auth, examController.deleteExam);

// Question management in exams
router.post('/:id/questions', auth, examController.addQuestionsToExam);
router.delete('/:id/questions/:questionId', auth, examController.removeQuestionFromExam);

module.exports = router;
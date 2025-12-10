const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const examStatsController = require('../controllers/examStatsController');
const pdfExamController = require('../controllers/pdfExamController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// PDF Exam Upload - Must be before /:id routes
router.post('/upload-pdf', auth, upload.single('pdf'), pdfExamController.uploadAndParse);
router.post('/create-from-pdf', auth, pdfExamController.createExamFromPDF);

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

// Exam statistics and analytics
router.get('/:examId/statistics', auth, examStatsController.getExamStatistics);
router.get('/:examId/score-distribution', auth, examStatsController.getScoreDistribution);
router.get('/:examId/leaderboard', auth, examStatsController.getExamLeaderboard);
router.get('/:examId/submissions', auth, examStatsController.getExamSubmissions);
router.get('/:examId/submissions/detail/:submissionId', auth, examStatsController.getSubmissionDetailById);
router.get('/:examId/submissions/:studentId', auth, examStatsController.getStudentSubmissionDetail);
router.get('/:examId/submissions/:studentId/activity', auth, examStatsController.getSubmissionActivityLog);
router.delete('/:examId/submissions/:studentId/reset', auth, examStatsController.resetStudentAttempt);

module.exports = router;
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

// All admin routes require authentication and admin role
router.use(authMiddleware.authenticate);
router.use(authMiddleware.isAdmin);

// API routes - These return JSON data
router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.getUsers);
router.get('/users/:userId', adminController.getUserById);
router.put('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);
router.get('/organizations', adminController.getOrganizations);
router.get('/organizations/:orgId', adminController.getOrganizationById);
router.put('/organizations/:orgId', adminController.updateOrganization);
router.delete('/organizations/:orgId', adminController.deleteOrganization);
router.get('/analytics', adminController.getAnalytics);

// Chat Sessions routes
router.get('/chat-sessions', adminController.getChatSessions);
router.get('/chat-sessions/:sessionId', adminController.getChatSessionById);
router.put('/chat-sessions/:sessionId', adminController.updateChatSession);
router.delete('/chat-sessions/:sessionId', adminController.deleteChatSession);

// Chat History routes
router.get('/chat-history', adminController.getChatHistory);
router.get('/chat-history/:historyId', adminController.getChatHistoryById);
router.put('/chat-history/:historyId', adminController.updateChatHistory);
router.delete('/chat-history/:historyId', adminController.deleteChatHistory);

// Questions routes
router.get('/questions', adminController.getQuestions);
router.get('/questions/:questionId', adminController.getQuestionById);
router.put('/questions/:questionId', adminController.updateQuestion);
router.delete('/questions/:questionId', adminController.deleteQuestion);

// Submissions routes
router.put('/submissions/:submissionId', adminController.updateSubmission);
router.delete('/submissions/:submissionId', adminController.deleteSubmission);

// Exams routes
router.put('/exams/:examId', adminController.updateExam);

// Classes routes
router.get('/classes', adminController.getClasses);
router.get('/classes/:classId', adminController.getClassById);
router.put('/classes/:classId', adminController.updateClass);
router.delete('/classes/:classId', adminController.deleteClass);

// Proctor Logs routes
router.get('/proctor-logs', adminController.getProctorLogs);
router.get('/proctor-logs/:logId', adminController.getProctorLogById);
router.delete('/proctor-logs/:logId', adminController.deleteProctorLog);

module.exports = router;


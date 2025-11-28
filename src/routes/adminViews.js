const express = require('express');
const router = express.Router();
const adminViewController = require('../controllers/adminViewController');
const authViewMiddleware = require('../middleware/authViewMiddleware');

// Login page (no auth required)
router.get('/login', (req, res) => {
    res.render('admin/login', { 
        title: 'Admin Login',
        error: req.query.error 
    });
});

// Handle admin login (set cookie from server)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Call auth service
        const authService = require('../services/authService');
        const result = await authService.login(email, password);
        
        // Check if user is admin
        if (result.user && result.user.role === 'admin') {
            // Set cookie from server side
            res.cookie('admin_token', result.token, {
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                httpOnly: false, // Allow JavaScript to read it
                sameSite: 'Lax',
                path: '/'
            });
            
            // Redirect to dashboard
            return res.redirect('/admin');
        } else {
            return res.redirect('/admin/login?error=access_denied');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        return res.redirect('/admin/login?error=login_failed');
    }
});

// All other admin routes require authentication and admin role
router.use(authViewMiddleware.authenticate);
router.use(authViewMiddleware.isAdmin);

// View routes (EJS) - These are for rendering HTML pages
router.get('/', adminViewController.renderDashboard);
router.get('/users', adminViewController.renderUsers);
router.get('/users/:userId', adminViewController.renderUserDetail);
router.get('/users/:userId/edit', adminViewController.renderUserEdit);
router.get('/organizations', adminViewController.renderOrganizations);
router.get('/organizations/:orgId', adminViewController.renderOrganizationDetail);
router.get('/organizations/:orgId/edit', adminViewController.renderOrganizationEdit);
router.get('/analytics', adminViewController.renderAnalytics);
router.get('/exams', adminViewController.renderExams);
router.get('/exams/:examId', adminViewController.renderExamDetail);
router.get('/submissions', adminViewController.renderSubmissions);
router.get('/submissions/:submissionId', adminViewController.renderSubmissionDetail);
router.get('/chat-sessions', adminViewController.renderChatSessions);
router.get('/chat-sessions/:sessionId', adminViewController.renderChatSessionDetail);
router.get('/chat-sessions/:sessionId/edit', adminViewController.renderChatSessionEdit);
router.get('/chat-history', adminViewController.renderChatHistory);
router.get('/chat-history/:historyId', adminViewController.renderChatHistoryDetail);
router.get('/chat-history/:historyId/edit', adminViewController.renderChatHistoryEdit);
router.get('/questions', adminViewController.renderQuestions);
router.get('/questions/:questionId', adminViewController.renderQuestionDetail);
router.get('/questions/:questionId/edit', adminViewController.renderQuestionEdit);

module.exports = router;


const adminService = require('../services/adminService');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');

/**
 * Render admin dashboard
 * GET /admin
 */
async function renderDashboard(req, res, next) {
  try {
    console.log('Rendering dashboard for user:', req.user?.email);
    const stats = await adminService.getDashboardStats();
    console.log('Stats loaded:', Object.keys(stats));
    res.render('admin/dashboard', {
      title: 'Dashboard',
      currentPage: 'dashboard',
      user: req.user,
      stats
    });
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    next(error);
  }
}

/**
 * Render users management page
 * GET /admin/users
 */
async function renderUsers(req, res, next) {
  try {
    const { role, status, orgId, search, page = 1, limit = 20 } = req.query;
    
    const result = await adminService.getUsers({
      role,
      status,
      orgId,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.render('admin/users', {
      title: 'Users Management',
      currentPage: 'users',
      user: req.user,
      users: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render organizations management page
 * GET /admin/organizations
 */
async function renderOrganizations(req, res, next) {
  try {
    const { plan, search, page = 1, limit = 20 } = req.query;

    const result = await adminService.getOrganizations({
      plan,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.render('admin/organizations', {
      title: 'Organizations Management',
      currentPage: 'organizations',
      user: req.user,
      organizations: result.organizations,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render analytics page
 * GET /admin/analytics
 */
async function renderAnalytics(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await adminService.getSystemAnalytics({ startDate, endDate });

    res.render('admin/analytics', {
      title: 'Analytics',
      currentPage: 'analytics',
      user: req.user,
      analytics,
      startDate,
      endDate
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render exams management page
 * GET /admin/exams
 */
async function renderExams(req, res, next) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [exams, total] = await Promise.all([
      Exam.find(query)
        .populate('ownerId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Exam.countDocuments(query)
    ]);

    res.render('admin/exams', {
      title: 'Exams Management',
      currentPage: 'exams',
      user: req.user,
      exams,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render submissions management page
 * GET /admin/submissions
 */
async function renderSubmissions(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [submissions, total] = await Promise.all([
      Submission.find(query)
        .populate('userId', 'name email')
        .populate('examId', 'name totalMarks')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Submission.countDocuments(query)
    ]);

    res.render('admin/submissions', {
      title: 'Submissions Management',
      currentPage: 'submissions',
      user: req.user,
      submissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render chat sessions management page
 * GET /admin/chat-sessions
 */
async function renderChatSessions(req, res, next) {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    
    const result = await adminService.getChatSessions({
      search: search || '',
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.render('admin/chat-sessions', {
      title: 'Chat Sessions Management',
      currentPage: 'chat-sessions',
      user: req.user,
      sessions: result.sessions,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render chat history management page
 * GET /admin/chat-history
 */
async function renderChatHistory(req, res, next) {
  try {
    const { search, sessionId, page = 1, limit = 20 } = req.query;
    
    const result = await adminService.getChatHistory({
      search: search || '',
      sessionId: sessionId || null,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.render('admin/chat-history', {
      title: 'Chat History Management',
      currentPage: 'chat-history',
      user: req.user,
      history: result.history,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render user detail page
 * GET /admin/users/:userId
 */
async function renderUserDetail(req, res, next) {
  try {
    const { userId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId)
      .populate('orgId', 'name domain')
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'User not found'
      });
    }

    res.render('admin/user-detail', {
      title: `User: ${user.name}`,
      currentPage: 'users',
      user: req.user,
      detailUser: user
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render organization detail page
 * GET /admin/organizations/:orgId
 */
async function renderOrganizationDetail(req, res, next) {
  try {
    const { orgId } = req.params;
    const mongoose = require('mongoose');
    const Organization = require('../models/Organization');
    
    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid organization ID format'
      });
    }

    const organization = await Organization.findById(orgId).lean();
    const userCount = await User.countDocuments({ orgId });

    if (!organization) {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Organization not found'
      });
    }

    res.render('admin/organization-detail', {
      title: `Organization: ${organization.name}`,
      currentPage: 'organizations',
      user: req.user,
      organization: { ...organization, userCount }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render exam detail page
 * GET /admin/exams/:examId
 */
async function renderExamDetail(req, res, next) {
  try {
    const { examId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid exam ID format'
      });
    }

    const exam = await Exam.findById(examId)
      .populate('ownerId', 'name email')
      .populate('questions.questionId')
      .lean();

    if (!exam) {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Exam not found'
      });
    }

    res.render('admin/exam-detail', {
      title: `Exam: ${exam.name}`,
      currentPage: 'exams',
      user: req.user,
      exam
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render submission detail page
 * GET /admin/submissions/:submissionId
 */
async function renderSubmissionDetail(req, res, next) {
  try {
    const { submissionId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(submissionId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid submission ID format'
      });
    }

    const submission = await Submission.findById(submissionId)
      .populate('userId', 'name email')
      .populate('examId', 'name totalMarks')
      .lean();

    if (!submission) {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Submission not found'
      });
    }

    res.render('admin/submission-detail', {
      title: `Submission: ${submission._id}`,
      currentPage: 'submissions',
      user: req.user,
      submission
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render chat session detail page
 * GET /admin/chat-sessions/:sessionId
 */
async function renderChatSessionDetail(req, res, next) {
  try {
    const { sessionId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid session ID format'
      });
    }

    const session = await adminService.getChatSessionById(sessionId);

    res.render('admin/chat-session-detail', {
      title: `Chat Session: ${session.title || session._id}`,
      currentPage: 'chat-sessions',
      user: req.user,
      session
    });
  } catch (error) {
    if (error.message === 'Chat session not found') {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Chat session not found'
      });
    }
    next(error);
  }
}

/**
 * Render chat history detail page
 * GET /admin/chat-history/:historyId
 */
async function renderChatHistoryDetail(req, res, next) {
  try {
    const { historyId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(historyId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid history ID format'
      });
    }

    const history = await adminService.getChatHistoryById(historyId);

    res.render('admin/chat-history-detail', {
      title: `Chat History: ${history._id}`,
      currentPage: 'chat-history',
      user: req.user,
      history
    });
  } catch (error) {
    if (error.message === 'Chat history not found') {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Chat history not found'
      });
    }
    next(error);
  }
}

/**
 * Render questions management page
 * GET /admin/questions
 */
async function renderQuestions(req, res, next) {
  try {
    const { search, type, subjectId, page = 1, limit = 20 } = req.query;
    
    const result = await adminService.getQuestions({
      search: search || '',
      type: type || null,
      subjectId: subjectId || null,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.render('admin/questions', {
      title: 'Questions Management',
      currentPage: 'questions',
      user: req.user,
      questions: result.questions,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render question detail page
 * GET /admin/questions/:questionId
 */
async function renderQuestionDetail(req, res, next) {
  try {
    const { questionId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(questionId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid question ID format'
      });
    }

    const question = await adminService.getQuestionById(questionId);

    res.render('admin/question-detail', {
      title: `Question: ${question.name || question._id}`,
      currentPage: 'questions',
      user: req.user,
      question
    });
  } catch (error) {
    if (error.message === 'Question not found') {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Question not found'
      });
    }
    next(error);
  }
}

/**
 * Render user edit page
 * GET /admin/users/:userId/edit
 */
async function renderUserEdit(req, res, next) {
  try {
    const { userId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid user ID format'
      });
    }

    const detailUser = await User.findById(userId)
      .populate('orgId', 'name domain')
      .select('-password')
      .lean();

    if (!detailUser) {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'User not found'
      });
    }

    res.render('admin/user-edit', {
      title: `Edit User: ${detailUser.name}`,
      currentPage: 'users',
      user: req.user,
      detailUser
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render organization edit page
 * GET /admin/organizations/:orgId/edit
 */
async function renderOrganizationEdit(req, res, next) {
  try {
    const { orgId } = req.params;
    const mongoose = require('mongoose');
    const Organization = require('../models/Organization');
    
    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid organization ID format'
      });
    }

    const organization = await Organization.findById(orgId).lean();
    const userCount = await User.countDocuments({ orgId });

    if (!organization) {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Organization not found'
      });
    }

    res.render('admin/organization-edit', {
      title: `Edit Organization: ${organization.name}`,
      currentPage: 'organizations',
      user: req.user,
      organization: { ...organization, userCount }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Render chat session edit page
 * GET /admin/chat-sessions/:sessionId/edit
 */
async function renderChatSessionEdit(req, res, next) {
  try {
    const { sessionId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid session ID format'
      });
    }

    const session = await adminService.getChatSessionById(sessionId);

    res.render('admin/chat-session-edit', {
      title: `Edit Chat Session: ${session.title || session._id}`,
      currentPage: 'chat-sessions',
      user: req.user,
      session
    });
  } catch (error) {
    if (error.message === 'Chat session not found') {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Chat session not found'
      });
    }
    next(error);
  }
}

/**
 * Render chat history edit page
 * GET /admin/chat-history/:historyId/edit
 */
async function renderChatHistoryEdit(req, res, next) {
  try {
    const { historyId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(historyId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid history ID format'
      });
    }

    const history = await adminService.getChatHistoryById(historyId);

    res.render('admin/chat-history-edit', {
      title: `Edit Chat History: ${history._id}`,
      currentPage: 'chat-history',
      user: req.user,
      history
    });
  } catch (error) {
    if (error.message === 'Chat history not found') {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Chat history not found'
      });
    }
    next(error);
  }
}

/**
 * Render question edit page
 * GET /admin/questions/:questionId/edit
 */
async function renderQuestionEdit(req, res, next) {
  try {
    const { questionId } = req.params;
    const mongoose = require('mongoose');
    
    if (!mongoose.isValidObjectId(questionId)) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        user: req.user,
        message: 'Invalid question ID format'
      });
    }

    const question = await adminService.getQuestionById(questionId);

    res.render('admin/question-edit', {
      title: `Edit Question: ${question.name || question._id}`,
      currentPage: 'questions',
      user: req.user,
      question
    });
  } catch (error) {
    if (error.message === 'Question not found') {
      return res.status(404).render('admin/error', {
        title: 'Not Found',
        user: req.user,
        message: 'Question not found'
      });
    }
    next(error);
  }
}

module.exports = {
  renderDashboard,
  renderUsers,
  renderUserDetail,
  renderUserEdit,
  renderOrganizations,
  renderOrganizationDetail,
  renderOrganizationEdit,
  renderAnalytics,
  renderExams,
  renderExamDetail,
  renderSubmissions,
  renderSubmissionDetail,
  renderChatSessions,
  renderChatSessionDetail,
  renderChatSessionEdit,
  renderChatHistory,
  renderChatHistoryDetail,
  renderChatHistoryEdit,
  renderQuestions,
  renderQuestionDetail,
  renderQuestionEdit
};


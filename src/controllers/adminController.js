const adminService = require('../services/adminService');
const mongoose = require('mongoose');

/**
 * Get dashboard statistics
 * GET /v1/api/admin/dashboard
 */
async function getDashboard(req, res, next) {
  try {
    const stats = await adminService.getDashboardStats();
    res.json({
      ok: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get users list
 * GET /v1/api/admin/users
 */
async function getUsers(req, res, next) {
  try {
    const { role, status, orgId, search, page, limit } = req.query;
    
    const result = await adminService.getUsers({
      role,
      status,
      orgId,
      search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      ok: true,
      data: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user by ID
 * GET /v1/api/admin/users/:userId
 */
async function getUserById(req, res, next) {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await require('../models/User')
      .findById(userId)
      .populate('orgId', 'name domain')
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'User not found'
      });
    }

    res.json({
      ok: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user
 * PUT /v1/api/admin/users/:userId
 */
async function updateUser(req, res, next) {
  try {
    const { userId } = req.params;
    const updates = req.body;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid user ID format'
      });
    }

    // Validate role if provided
    if (updates.role && !['teacher', 'student', 'admin'].includes(updates.role)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid role. Must be one of: teacher, student, admin'
      });
    }

    // Validate status if provided
    if (updates.status && !['active', 'suspended'].includes(updates.status)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid status. Must be one of: active, suspended'
      });
    }

    const user = await adminService.updateUser({ userId, updates });

    res.json({
      ok: true,
      data: user,
      message: 'User updated successfully'
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Update exam
 * PUT /v1/api/admin/exams/:examId
 */
async function updateExam(req, res, next) {
  try {
    const { examId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid exam ID'
      });
    }
    const exam = await adminService.updateExam(examId, req.body);
    res.json({
      ok: true,
      data: exam,
      message: 'Exam updated successfully'
    });
  } catch (error) {
    if (error.message === 'Exam not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Update submission
 * PUT /v1/api/admin/submissions/:submissionId
 */
async function updateSubmission(req, res, next) {
  try {
    const { submissionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid submission ID'
      });
    }
    const submission = await adminService.updateSubmission(submissionId, req.body);
    res.json({
      ok: true,
      data: submission,
      message: 'Submission updated successfully'
    });
  } catch (error) {
    if (error.message === 'Submission not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Delete user
 * DELETE /v1/api/admin/users/:userId
 */
async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid user ID format'
      });
    }

    // Prevent deleting yourself
    if (userId === req.user.userId) {
      return res.status(400).json({
        ok: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await require('../models/User').findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'User not found'
      });
    }

    res.json({
      ok: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get organizations list
 * GET /v1/api/admin/organizations
 */
async function getOrganizations(req, res, next) {
  try {
    const { plan, search, page, limit } = req.query;

    const result = await adminService.getOrganizations({
      plan,
      search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      ok: true,
      data: result.organizations,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get organization by ID
 * GET /v1/api/admin/organizations/:orgId
 */
async function getOrganizationById(req, res, next) {
  try {
    const { orgId } = req.params;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid organization ID format'
      });
    }

    const organization = await require('../models/Organization')
      .findById(orgId)
      .lean();

    if (!organization) {
      return res.status(404).json({
        ok: false,
        message: 'Organization not found'
      });
    }

    // Get user count
    const userCount = await require('../models/User').countDocuments({ orgId });

    res.json({
      ok: true,
      data: {
        ...organization,
        userCount
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update organization
 * PUT /v1/api/admin/organizations/:orgId
 */
async function updateOrganization(req, res, next) {
  try {
    const { orgId } = req.params;
    const updates = req.body;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid organization ID format'
      });
    }

    // Validate plan if provided
    if (updates.plan && !['free', 'pro', 'enterprise'].includes(updates.plan)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid plan. Must be one of: free, pro, enterprise'
      });
    }

    const organization = await adminService.updateOrganization({ orgId, updates });

    res.json({
      ok: true,
      data: organization,
      message: 'Organization updated successfully'
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Delete organization
 * DELETE /v1/api/admin/organizations/:orgId
 */
async function deleteOrganization(req, res, next) {
  try {
    const { orgId } = req.params;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid organization ID format'
      });
    }

    const organization = await require('../models/Organization').findByIdAndDelete(orgId);

    if (!organization) {
      return res.status(404).json({
        ok: false,
        message: 'Organization not found'
      });
    }

    res.json({
      ok: true,
      message: 'Organization deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get system analytics
 * GET /v1/api/admin/analytics
 */
async function getAnalytics(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await adminService.getSystemAnalytics({ startDate, endDate });

    res.json({
      ok: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get chat sessions list
 * GET /v1/api/admin/chat-sessions
 */
async function getChatSessions(req, res, next) {
  try {
    const { page, limit, search } = req.query;
    const result = await adminService.getChatSessions({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      search: search || ''
    });
    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get chat session by ID
 * GET /v1/api/admin/chat-sessions/:sessionId
 */
async function getChatSessionById(req, res, next) {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid session ID'
      });
    }
    const session = await adminService.getChatSessionById(sessionId);
    res.json({
      ok: true,
      data: session
    });
  } catch (error) {
    if (error.message === 'Chat session not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Update chat session
 * PUT /v1/api/admin/chat-sessions/:sessionId
 */
async function updateChatSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid session ID'
      });
    }
    const session = await adminService.updateChatSession(sessionId, req.body);
    res.json({
      ok: true,
      data: session,
      message: 'Chat session updated successfully'
    });
  } catch (error) {
    if (error.message === 'Chat session not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Delete chat session
 * DELETE /v1/api/admin/chat-sessions/:sessionId
 */
async function deleteChatSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid session ID'
      });
    }
    await adminService.deleteChatSession(sessionId);
    res.json({
      ok: true,
      message: 'Chat session deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Chat session not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Get chat history list
 * GET /v1/api/admin/chat-history
 */
async function getChatHistory(req, res, next) {
  try {
    const { page, limit, search, sessionId } = req.query;
    const result = await adminService.getChatHistory({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      search: search || '',
      sessionId: sessionId || null
    });
    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get chat history by ID
 * GET /v1/api/admin/chat-history/:historyId
 */
async function getChatHistoryById(req, res, next) {
  try {
    const { historyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(historyId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid history ID'
      });
    }
    const history = await adminService.getChatHistoryById(historyId);
    res.json({
      ok: true,
      data: history
    });
  } catch (error) {
    if (error.message === 'Chat history not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Update chat history
 * PUT /v1/api/admin/chat-history/:historyId
 */
async function updateChatHistory(req, res, next) {
  try {
    const { historyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(historyId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid history ID'
      });
    }
    const history = await adminService.updateChatHistory(historyId, req.body);
    res.json({
      ok: true,
      data: history,
      message: 'Chat history updated successfully'
    });
  } catch (error) {
    if (error.message === 'Chat history not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Delete chat history
 * DELETE /v1/api/admin/chat-history/:historyId
 */
async function deleteChatHistory(req, res, next) {
  try {
    const { historyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(historyId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid history ID'
      });
    }
    await adminService.deleteChatHistory(historyId);
    res.json({
      ok: true,
      message: 'Chat history deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Chat history not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Get questions list
 * GET /v1/api/admin/questions
 */
async function getQuestions(req, res, next) {
  try {
    const { page, limit, search, type, subjectId } = req.query;
    const result = await adminService.getQuestions({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      search: search || '',
      type: type || null,
      subjectId: subjectId || null
    });
    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get question by ID
 * GET /v1/api/admin/questions/:questionId
 */
async function getQuestionById(req, res, next) {
  try {
    const { questionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid question ID'
      });
    }
    const question = await adminService.getQuestionById(questionId);
    res.json({
      ok: true,
      data: question
    });
  } catch (error) {
    if (error.message === 'Question not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Update question
 * PUT /v1/api/admin/questions/:questionId
 */
async function updateQuestion(req, res, next) {
  try {
    const { questionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid question ID'
      });
    }
    const question = await adminService.updateQuestion(questionId, req.body);
    res.json({
      ok: true,
      data: question,
      message: 'Question updated successfully'
    });
  } catch (error) {
    if (error.message === 'Question not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Delete question
 * DELETE /v1/api/admin/questions/:questionId
 */
async function deleteQuestion(req, res, next) {
  try {
    const { questionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid question ID'
      });
    }
    await adminService.deleteQuestion(questionId);
    res.json({
      ok: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Question not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Delete submission
 * DELETE /v1/api/admin/submissions/:submissionId
 */
async function deleteSubmission(req, res, next) {
  try {
    const { submissionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid submission ID'
      });
    }
    await adminService.deleteSubmission(submissionId);
    res.json({
      ok: true,
      message: 'Submission deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Submission not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

module.exports = {
  getDashboard,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  getAnalytics,
  getChatSessions,
  getChatSessionById,
  updateChatSession,
  deleteChatSession,
  getChatHistory,
  getChatHistoryById,
  updateChatHistory,
  deleteChatHistory,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  deleteSubmission,
  updateExam,
  updateSubmission
};


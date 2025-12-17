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

/**
 * Get classes list
 * GET /v1/api/admin/classes
 */
async function getClasses(req, res, next) {
  try {
    const { search, orgId, teacherId, page, limit } = req.query;

    const result = await adminService.getClasses({
      search: search || '',
      orgId: orgId || null,
      teacherId: teacherId || null,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      ok: true,
      data: result.classes,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get class by ID
 * GET /v1/api/admin/classes/:classId
 */
async function getClassById(req, res, next) {
  try {
    const { classId } = req.params;
    const mongoose = require('mongoose');

    if (!mongoose.isValidObjectId(classId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid class ID format'
      });
    }

    const classDoc = await adminService.getClassById(classId);

    res.json({
      ok: true,
      data: classDoc
    });
  } catch (error) {
    if (error.message === 'Class not found') {
      return res.status(404).json({
        ok: false,
        message: 'Class not found'
      });
    }
    next(error);
  }
}

/**
 * Update class
 * PUT /v1/api/admin/classes/:classId
 */
async function updateClass(req, res, next) {
  try {
    const { classId } = req.params;
    const mongoose = require('mongoose');

    if (!mongoose.isValidObjectId(classId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid class ID format'
      });
    }

    const classDoc = await adminService.updateClass(classId, req.body);

    res.json({
      ok: true,
      message: 'Class updated successfully',
      data: classDoc
    });
  } catch (error) {
    if (error.message === 'Class not found' || 
        error.message === 'Teacher not found' ||
        error.message === 'Teacher ID must belong to a teacher or admin' ||
        error.message === 'Some student IDs are invalid') {
      return res.status(400).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Delete class
 * DELETE /v1/api/admin/classes/:classId
 */
async function deleteClass(req, res, next) {
  try {
    const { classId } = req.params;
    const mongoose = require('mongoose');

    if (!mongoose.isValidObjectId(classId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid class ID format'
      });
    }

    await adminService.deleteClass(classId);

    res.json({
      ok: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Class not found') {
      return res.status(404).json({
        ok: false,
        message: 'Class not found'
      });
    }
    next(error);
  }
}

/**
 * Get proctor logs list
 * GET /v1/api/admin/proctor-logs
 */
async function getProctorLogs(req, res, next) {
  try {
    const { search, submissionId, userId, event, severity, page, limit } = req.query;

    const result = await adminService.getProctorLogs({
      search: search || '',
      submissionId: submissionId || null,
      userId: userId || null,
      event: event || null,
      severity: severity || null,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      ok: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get proctor log by ID
 * GET /v1/api/admin/proctor-logs/:logId
 */
async function getProctorLogById(req, res, next) {
  try {
    const { logId } = req.params;
    const mongoose = require('mongoose');

    if (!mongoose.isValidObjectId(logId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid log ID format'
      });
    }

    const log = await adminService.getProctorLogById(logId);

    res.json({
      ok: true,
      data: log
    });
  } catch (error) {
    if (error.message === 'Proctor log not found') {
      return res.status(404).json({
        ok: false,
        message: 'Proctor log not found'
      });
    }
    next(error);
  }
}

/**
 * Delete proctor log
 * DELETE /v1/api/admin/proctor-logs/:logId
 */
async function deleteProctorLog(req, res, next) {
  try {
    const { logId } = req.params;
    const mongoose = require('mongoose');

    if (!mongoose.isValidObjectId(logId)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid log ID format'
      });
    }

    await adminService.deleteProctorLog(logId);

    res.json({
      ok: true,
      message: 'Proctor log deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Proctor log not found') {
      return res.status(404).json({
        ok: false,
        message: 'Proctor log not found'
      });
    }
    next(error);
  }
}

// ============== MINDMAP MANAGEMENT ==============

/**
 * Get all mindmaps with pagination
 * GET /v1/api/admin/mindmaps
 */
async function getMindmaps(req, res, next) {
  try {
    const { page, limit, search, userId, status, includeDeleted } = req.query;
    const result = await adminService.getMindmaps({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      search: search || '',
      userId: userId || null,
      status: status !== undefined ? status === 'true' : undefined,
      includeDeleted: includeDeleted === 'true'
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
 * Get mindmap by ID
 * GET /v1/api/admin/mindmaps/:mindmapId
 */
async function getMindmapById(req, res, next) {
  try {
    const { mindmapId } = req.params;
    const mindmap = await adminService.getMindmapById(mindmapId);
    res.json({
      ok: true,
      data: mindmap
    });
  } catch (error) {
    if (error.message === 'Mindmap not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Update mindmap
 * PUT /v1/api/admin/mindmaps/:mindmapId
 */
async function updateMindmap(req, res, next) {
  try {
    const { mindmapId } = req.params;
    const mindmap = await adminService.updateMindmap(mindmapId, req.body);
    res.json({
      ok: true,
      data: mindmap,
      message: 'Mindmap updated successfully'
    });
  } catch (error) {
    if (error.message === 'Mindmap not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Delete mindmap
 * DELETE /v1/api/admin/mindmaps/:mindmapId
 */
async function deleteMindmap(req, res, next) {
  try {
    const { mindmapId } = req.params;
    const { permanent } = req.query;
    const result = await adminService.deleteMindmap(mindmapId, permanent === 'true');
    res.json({
      ok: true,
      message: result.message
    });
  } catch (error) {
    if (error.message === 'Mindmap not found') {
      return res.status(404).json({
        ok: false,
        message: error.message
      });
    }
    next(error);
  }
}

/**
 * Restore deleted mindmap
 * POST /v1/api/admin/mindmaps/:mindmapId/restore
 */
async function restoreMindmap(req, res, next) {
  try {
    const { mindmapId } = req.params;
    const mindmap = await adminService.restoreMindmap(mindmapId);
    res.json({
      ok: true,
      data: mindmap,
      message: 'Mindmap restored successfully'
    });
  } catch (error) {
    if (error.message === 'Mindmap not found') {
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
  updateSubmission,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
  getProctorLogs,
  getProctorLogById,
  deleteProctorLog,
  // Mindmap management
  getMindmaps,
  getMindmapById,
  updateMindmap,
  deleteMindmap,
  restoreMindmap
};


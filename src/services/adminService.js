const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Class = require('../models/Class');
const Question = require('../models/Question');
const ChatSession = require('../models/ChatSession');
const ChatHistory = require('../models/ChatHistory');

/**
 * Get dashboard statistics
 * @returns {Object} - Dashboard statistics
 */
async function getDashboardStats() {
  const [
    totalUsers,
    totalTeachers,
    totalStudents,
    totalAdmins,
    activeUsers,
    suspendedUsers,
    totalOrganizations,
    totalExams,
    publishedExams,
    draftExams,
    totalSubmissions,
    completedSubmissions,
    totalClasses,
    totalQuestions
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'teacher' }),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ status: 'suspended' }),
    Organization.countDocuments(),
    Exam.countDocuments(),
    Exam.countDocuments({ status: 'published' }),
    Exam.countDocuments({ status: 'draft' }),
    Submission.countDocuments(),
    Submission.countDocuments({ status: { $in: ['submitted', 'graded', 'late'] } }),
    Class.countDocuments(),
    Question.countDocuments()
  ]);

  // Get recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    recentUsers,
    recentExams,
    recentSubmissions,
    recentOrganizations
  ] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Exam.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Submission.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Organization.countDocuments({ createdAt: { $gte: sevenDaysAgo } })
  ]);

  // Calculate average score
  const submissionsWithScore = await Submission.find({
    status: { $in: ['submitted', 'graded', 'late'] },
    score: { $exists: true, $ne: null }
  }).select('score maxScore');

  let averageScore = 0;
  let averagePercentage = 0;
  if (submissionsWithScore.length > 0) {
    const totalScore = submissionsWithScore.reduce((sum, s) => sum + (s.score || 0), 0);
    const totalMaxScore = submissionsWithScore.reduce((sum, s) => sum + (s.maxScore || 100), 0);
    averageScore = totalScore / submissionsWithScore.length;
    averagePercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
  }

  return {
    users: {
      total: totalUsers,
      teachers: totalTeachers,
      students: totalStudents,
      admins: totalAdmins,
      active: activeUsers,
      suspended: suspendedUsers,
      recent: recentUsers
    },
    organizations: {
      total: totalOrganizations,
      recent: recentOrganizations
    },
    exams: {
      total: totalExams,
      published: publishedExams,
      draft: draftExams,
      recent: recentExams
    },
    submissions: {
      total: totalSubmissions,
      completed: completedSubmissions,
      recent: recentSubmissions,
      averageScore: Math.round(averageScore * 100) / 100,
      averagePercentage: Math.round(averagePercentage * 100) / 100
    },
    classes: {
      total: totalClasses
    },
    questions: {
      total: totalQuestions
    }
  };
}

/**
 * Get users with filters and pagination
 * @param {Object} params - Parameters
 * @param {string} params.role - Filter by role
 * @param {string} params.status - Filter by status
 * @param {string} params.orgId - Filter by organization
 * @param {string} params.search - Search by name or email
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @returns {Object} - Users list with pagination
 */
async function getUsers({ role, status, orgId, search, page = 1, limit = 20 }) {
  const query = {};

  if (role) {
    query.role = role;
  }

  if (status) {
    query.status = status;
  }

  if (orgId) {
    query.orgId = new mongoose.Types.ObjectId(orgId);
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(query)
      .populate('orgId', 'name domain')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query)
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update user
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @param {Object} params.updates - Updates object
 * @returns {Object} - Updated user
 */
async function updateUser({ userId, updates }) {
  const allowedFields = ['role', 'status', 'name', 'profile', 'preferences'];
  const updateData = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw { status: 400, message: 'No valid fields to update' };
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  return user;
}

/**
 * Get organizations with filters and pagination
 * @param {Object} params - Parameters
 * @param {string} params.plan - Filter by plan
 * @param {string} params.search - Search by name or domain
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @returns {Object} - Organizations list with pagination
 */
async function getOrganizations({ plan, search, page = 1, limit = 20 }) {
  const query = {};

  if (plan) {
    query.plan = plan;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { domain: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [organizations, total] = await Promise.all([
    Organization.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Organization.countDocuments(query)
  ]);

  // Get user counts for each organization
  const orgIds = organizations.map(org => org._id);
  const userCounts = await User.aggregate([
    { $match: { orgId: { $in: orgIds } } },
    { $group: { _id: '$orgId', count: { $sum: 1 } } }
  ]);

  const userCountMap = {};
  userCounts.forEach(item => {
    userCountMap[item._id.toString()] = item.count;
  });

  const organizationsWithCounts = organizations.map(org => ({
    ...org,
    userCount: userCountMap[org._id.toString()] || 0
  }));

  return {
    organizations: organizationsWithCounts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update organization
 * @param {Object} params - Parameters
 * @param {string} params.orgId - Organization ID
 * @param {Object} params.updates - Updates object
 * @returns {Object} - Updated organization
 */
async function updateOrganization({ orgId, updates }) {
  const allowedFields = ['name', 'domain', 'plan', 'settings'];
  const updateData = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw { status: 400, message: 'No valid fields to update' };
  }

  const organization = await Organization.findByIdAndUpdate(
    orgId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!organization) {
    throw { status: 404, message: 'Organization not found' };
  }

  return organization;
}

/**
 * Get system analytics
 * @param {Object} params - Parameters
 * @param {string} params.startDate - Start date (ISO string)
 * @param {string} params.endDate - End date (ISO string)
 * @returns {Object} - Analytics data
 */
async function getSystemAnalytics({ startDate, endDate }) {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
  const end = endDate ? new Date(endDate) : new Date();

  // User growth over time
  const userGrowth = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Exam creation over time
  const examGrowth = await Exam.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Submission activity over time
  const submissionActivity = await Submission.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Users by role
  const usersByRole = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);

  // Exams by status
  const examsByStatus = await Exam.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Submissions by status
  const submissionsByStatus = await Submission.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Organizations by plan
  const organizationsByPlan = await Organization.aggregate([
    {
      $group: {
        _id: '$plan',
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    period: {
      start: start.toISOString(),
      end: end.toISOString()
    },
    userGrowth,
    examGrowth,
    submissionActivity,
    usersByRole,
    examsByStatus,
    submissionsByStatus,
    organizationsByPlan
  };
}

/**
 * Get all chat sessions with pagination
 * @param {Object} options - Query options (page, limit, search)
 * @returns {Object} - Paginated chat sessions
 */
async function getChatSessions(options = {}) {
  const { page = 1, limit = 20, search = '' } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { lastMessage: { $regex: search, $options: 'i' } }
    ];
  }

  const [sessions, total] = await Promise.all([
    ChatSession.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ChatSession.countDocuments(query)
  ]);

  return {
    sessions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get chat session by ID
 * @param {String} sessionId - Session ID
 * @returns {Object} - Chat session
 */
async function getChatSessionById(sessionId) {
  const session = await ChatSession.findById(sessionId)
    .populate('userId', 'name email')
    .lean();
  
  if (!session) {
    throw new Error('Chat session not found');
  }

  return session;
}

/**
 * Update chat session
 * @param {String} sessionId - Session ID
 * @param {Object} updateData - Data to update
 * @returns {Object} - Updated chat session
 */
async function updateChatSession(sessionId, updateData) {
  const allowedFields = ['title', 'lastMessage'];
  const filteredData = {};
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  const session = await ChatSession.findByIdAndUpdate(
    sessionId,
    { $set: filteredData },
    { new: true, runValidators: true }
  ).populate('userId', 'name email').lean();

  if (!session) {
    throw new Error('Chat session not found');
  }

  return session;
}

/**
 * Delete chat session
 * @param {String} sessionId - Session ID
 * @returns {Object} - Deletion result
 */
async function deleteChatSession(sessionId) {
  // Delete all chat history for this session first
  await ChatHistory.deleteMany({ sessionId });
  
  const session = await ChatSession.findByIdAndDelete(sessionId);
  
  if (!session) {
    throw new Error('Chat session not found');
  }

  return { message: 'Chat session deleted successfully' };
}

/**
 * Get all chat history with pagination
 * @param {Object} options - Query options (page, limit, search, sessionId)
 * @returns {Object} - Paginated chat history
 */
async function getChatHistory(options = {}) {
  const { page = 1, limit = 20, search = '', sessionId } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (sessionId) {
    query.sessionId = sessionId;
  }
  if (search) {
    query.message = { $regex: search, $options: 'i' };
  }

  const [history, total] = await Promise.all([
    ChatHistory.find(query)
      .populate('userId', 'name email')
      .populate('sessionId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ChatHistory.countDocuments(query)
  ]);

  return {
    history,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get chat history by ID
 * @param {String} historyId - History ID
 * @returns {Object} - Chat history
 */
async function getChatHistoryById(historyId) {
  const history = await ChatHistory.findById(historyId)
    .populate('userId', 'name email')
    .populate('sessionId', 'title')
    .lean();
  
  if (!history) {
    throw new Error('Chat history not found');
  }

  return history;
}

/**
 * Update chat history
 * @param {String} historyId - History ID
 * @param {Object} updateData - Data to update
 * @returns {Object} - Updated chat history
 */
async function updateChatHistory(historyId, updateData) {
  const allowedFields = ['message', 'isError'];
  const filteredData = {};
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  const history = await ChatHistory.findByIdAndUpdate(
    historyId,
    { $set: filteredData },
    { new: true, runValidators: true }
  )
    .populate('userId', 'name email')
    .populate('sessionId', 'title')
    .lean();

  if (!history) {
    throw new Error('Chat history not found');
  }

  return history;
}

/**
 * Delete chat history
 * @param {String} historyId - History ID
 * @returns {Object} - Deletion result
 */
async function deleteChatHistory(historyId) {
  const history = await ChatHistory.findByIdAndDelete(historyId);
  
  if (!history) {
    throw new Error('Chat history not found');
  }

  return { message: 'Chat history deleted successfully' };
}

/**
 * Get all questions with pagination
 * @param {Object} options - Query options (page, limit, search, type, subjectId)
 * @returns {Object} - Paginated questions
 */
async function getQuestions(options = {}) {
  const { page = 1, limit = 20, search = '', type, subjectId } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (search) {
    query.$or = [
      { text: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }
  if (type) {
    query.type = type;
  }
  if (subjectId) {
    query.subjectId = subjectId;
  }

  const [questions, total] = await Promise.all([
    Question.find(query)
      .populate('ownerId', 'name email')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Question.countDocuments(query)
  ]);

  return {
    questions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get question by ID
 * @param {String} questionId - Question ID
 * @returns {Object} - Question
 */
async function getQuestionById(questionId) {
  const question = await Question.findById(questionId)
    .populate('ownerId', 'name email')
    .populate('subjectId', 'name code')
    .lean();
  
  if (!question) {
    throw new Error('Question not found');
  }

  return question;
}

/**
 * Update question
 * @param {String} questionId - Question ID
 * @param {Object} updateData - Data to update
 * @returns {Object} - Updated question
 */
async function updateQuestion(questionId, updateData) {
  const allowedFields = ['name', 'text', 'choices', 'answer', 'explanation', 'level', 'isPublic', 'tags'];
  const filteredData = {};
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  const question = await Question.findByIdAndUpdate(
    questionId,
    { $set: filteredData },
    { new: true, runValidators: true }
  )
    .populate('ownerId', 'name email')
    .populate('subjectId', 'name code')
    .lean();

  if (!question) {
    throw new Error('Question not found');
  }

  return question;
}

/**
 * Delete question
 * @param {String} questionId - Question ID
 * @returns {Object} - Deletion result
 */
async function deleteQuestion(questionId) {
  const question = await Question.findByIdAndDelete(questionId);
  
  if (!question) {
    throw new Error('Question not found');
  }

  return { message: 'Question deleted successfully' };
}

/**
 * Delete submission
 * @param {String} submissionId - Submission ID
 * @returns {Object} - Deletion result
 */
async function deleteSubmission(submissionId) {
  const submission = await Submission.findByIdAndDelete(submissionId);
  
  if (!submission) {
    throw new Error('Submission not found');
  }

  return { message: 'Submission deleted successfully' };
}

module.exports = {
  getDashboardStats,
  getUsers,
  updateUser,
  getOrganizations,
  updateOrganization,
  getSystemAnalytics,
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
  deleteSubmission
};


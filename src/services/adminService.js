const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Class = require('../models/Class');
const Question = require('../models/Question');
const ChatSession = require('../models/ChatSession');
const ChatHistory = require('../models/ChatHistory');
const ProctorLog = require('../models/ProctorLog');
const Mindmap = require('../models/Mindmap');

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
 * @param {string} params.plan - Filter by plan
 * @param {string} params.orgId - Filter by organization
 * @param {string} params.search - Search by name or email
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @returns {Object} - Users list with pagination
 */
async function getUsers({ role, status, plan, orgId, search, page = 1, limit = 20 }) {
  const query = {};

  if (role) {
    query.role = role;
  }

  if (status) {
    query.status = status;
  }

  if (plan) {
    query['subscription.plan'] = plan;
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

  // Handle plan update
  if (updates.plan !== undefined) {
    if (!['free', 'plus', 'pro'].includes(updates.plan)) {
      throw { status: 400, message: 'Invalid plan. Must be one of: free, plus, pro' };
    }
    updateData['subscription.plan'] = updates.plan;
  }

  // Handle expiresAt update
  if (updates.expiresAt !== undefined) {
    if (updates.expiresAt === null || updates.expiresAt === '') {
      updateData['subscription.expiresAt'] = null;
    } else {
      const expiresDate = new Date(updates.expiresAt);
      if (isNaN(expiresDate.getTime())) {
        throw { status: 400, message: 'Invalid expiresAt date format' };
      }
      updateData['subscription.expiresAt'] = expiresDate;
    }
  }

  // Handle password update separately
  if (updates.password) {
    const bcrypt = require('bcryptjs');
    const { validatePassword } = require('../utils/passwordValidator');
    
    // Validate password strength
    const passwordValidation = validatePassword(updates.password);
    if (!passwordValidation.isValid) {
      throw { status: 400, message: `Password validation failed: ${passwordValidation.errors.join(', ')}` };
    }
    
    // Hash password
    updateData.password = await bcrypt.hash(updates.password, 10);
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
 * Create user
 * @param {Object} params - Parameters
 * @param {string} params.name - User name
 * @param {string} params.email - User email
 * @param {string} params.password - User password
 * @param {string} params.role - User role
 * @param {string} params.status - User status
 * @param {string} params.plan - Subscription plan
 * @param {string} params.expiresAt - Subscription expiration date
 * @returns {Object} - Created user
 */
async function createUser({ name, email, password, role, status, plan, expiresAt }) {
  const bcrypt = require('bcryptjs');
  const { validatePassword } = require('../utils/passwordValidator');

  // Check if email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw { status: 400, message: 'Email already exists' };
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw { status: 400, message: `Password validation failed: ${passwordValidation.errors.join(', ')}` };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Build subscription object
  const subscription = {
    plan: plan || 'free'
  };
  if (expiresAt) {
    const expDate = new Date(expiresAt);
    if (!isNaN(expDate.getTime())) {
      subscription.expiresAt = expDate;
    }
  }

  // Create user
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: role || 'student',
    status: status || 'active',
    subscription
  });

  // Return user without password
  const userObj = user.toObject();
  delete userObj.password;
  return userObj;
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
  const allowedFields = ['name', 'text', 'choices', 'answer', 'explanation', 'level', 'isPublic', 'tags', 'ownerId'];
  const filteredData = {};
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  // Validate ownerId if provided
  if (filteredData.ownerId && !mongoose.isValidObjectId(filteredData.ownerId)) {
    throw new Error('Invalid owner ID format');
  }

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

/**
 * Update exam
 * @param {String} examId - Exam ID
 * @param {Object} updateData - Data to update
 * @returns {Object} - Updated exam
 */
async function updateExam(examId, updateData) {
  const allowedFields = ['name', 'description', 'duration', 'totalMarks', 'status', 'startTime', 'endTime', 'settings', 'examPassword', 'ownerId'];
  const filteredData = {};
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  // Validate ownerId if provided
  if (filteredData.ownerId && !mongoose.isValidObjectId(filteredData.ownerId)) {
    throw new Error('Invalid owner ID format');
  }

  const exam = await Exam.findByIdAndUpdate(
    examId,
    { $set: filteredData },
    { new: true, runValidators: true }
  )
    .populate('ownerId', 'name email')
    .lean();

  if (!exam) {
    throw new Error('Exam not found');
  }

  return exam;
}

/**
 * Update submission
 * @param {String} submissionId - Submission ID
 * @param {Object} updateData - Data to update
 * @returns {Object} - Updated submission
 */
async function updateSubmission(submissionId, updateData) {
  const allowedFields = ['score', 'percentage', 'status', 'timeSpent', 'submittedAt'];
  const filteredData = {};
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  const submission = await Submission.findByIdAndUpdate(
    submissionId,
    { $set: filteredData },
    { new: true, runValidators: true }
  )
    .populate('userId', 'name email')
    .populate('examId', 'name totalMarks')
    .lean();

  if (!submission) {
    throw new Error('Submission not found');
  }

  return submission;
}

/**
 * Get all classes with pagination
 * @param {Object} options - Query options (page, limit, search, orgId, teacherId)
 * @returns {Object} - Paginated classes
 */
async function getClasses(options = {}) {
  const { page = 1, limit = 20, search = '', orgId, teacherId } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }
  if (orgId) {
    query.orgId = orgId;
  }
  if (teacherId) {
    query.teacherId = teacherId;
  }

  const [classes, total] = await Promise.all([
    Class.find(query)
      .populate('orgId', 'name')
      .populate('teacherId', 'name email')
      .populate('studentIds', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Class.countDocuments(query)
  ]);

  return {
    classes,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get class by ID
 * @param {String} classId - Class ID
 * @returns {Object} - Class
 */
async function getClassById(classId) {
  const classDoc = await Class.findById(classId)
    .populate('orgId', 'name domain')
    .populate('teacherId', 'name email role')
    .populate('studentIds', 'name email role')
    .populate('studentJoins.studentId', 'name email')
    .lean();
  
  if (!classDoc) {
    throw new Error('Class not found');
  }

  return classDoc;
}

/**
 * Update class
 * @param {String} classId - Class ID
 * @param {Object} updateData - Data to update
 * @returns {Object} - Updated class
 */
async function updateClass(classId, updateData) {
  const allowedFields = ['name', 'code', 'orgId', 'teacherId', 'studentIds', 'settings', 'metadata'];
  const filteredData = {};
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      // Handle orgId: can be null/undefined to remove organization
      if (key === 'orgId') {
        filteredData.orgId = updateData.orgId || null;
      } else {
        filteredData[key] = updateData[key];
      }
    }
  });

  // Validate orgId if provided
  if (filteredData.orgId) {
    const Organization = require('../models/Organization');
    const org = await Organization.findById(filteredData.orgId);
    if (!org) {
      throw new Error('Organization not found');
    }
  }

  // Validate teacherId if provided
  if (filteredData.teacherId) {
    const teacher = await User.findById(filteredData.teacherId);
    if (!teacher) {
      throw new Error('Teacher not found');
    }
    if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
      throw new Error('Teacher ID must belong to a teacher or admin');
    }
  }

  // Validate studentIds if provided
  if (filteredData.studentIds && Array.isArray(filteredData.studentIds)) {
    const students = await User.find({ _id: { $in: filteredData.studentIds } });
    if (students.length !== filteredData.studentIds.length) {
      throw new Error('Some student IDs are invalid');
    }
  }

  const classDoc = await Class.findByIdAndUpdate(
    classId,
    { $set: filteredData },
    { new: true, runValidators: true }
  )
    .populate('orgId', 'name')
    .populate('teacherId', 'name email')
    .populate('studentIds', 'name email')
    .lean();

  if (!classDoc) {
    throw new Error('Class not found');
  }

  return classDoc;
}

/**
 * Delete class
 * @param {String} classId - Class ID
 * @returns {Object} - Deletion result
 */
async function deleteClass(classId) {
  const classDoc = await Class.findByIdAndDelete(classId);
  
  if (!classDoc) {
    throw new Error('Class not found');
  }

  return { message: 'Class deleted successfully' };
}

/**
 * Get all proctor logs with pagination
 * @param {Object} options - Query options (page, limit, search, submissionId, userId, event, severity)
 * @returns {Object} - Paginated proctor logs
 */
async function getProctorLogs(options = {}) {
  const { page = 1, limit = 20, search = '', submissionId, userId, event, severity } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (submissionId) {
    query.submissionId = submissionId;
  }
  if (userId) {
    query.userId = userId;
  }
  if (event) {
    query.event = event;
  }
  if (severity) {
    query.severity = severity;
  }

  const [logs, total] = await Promise.all([
    ProctorLog.find(query)
      .populate('orgId', 'name')
      .populate('submissionId', 'examId userId status')
      .populate('userId', 'name email')
      .sort({ ts: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProctorLog.countDocuments(query)
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get proctor log by ID
 * @param {String} logId - Log ID
 * @returns {Object} - Proctor log
 */
async function getProctorLogById(logId) {
  const log = await ProctorLog.findById(logId)
    .populate('orgId', 'name domain')
    .populate('submissionId', 'examId userId status score')
    .populate('userId', 'name email role')
    .lean();
  
  if (!log) {
    throw new Error('Proctor log not found');
  }

  return log;
}

/**
 * Delete proctor log
 * @param {String} logId - Log ID
 * @returns {Object} - Deletion result
 */
async function deleteProctorLog(logId) {
  const log = await ProctorLog.findByIdAndDelete(logId);
  
  if (!log) {
    throw new Error('Proctor log not found');
  }

  return { message: 'Proctor log deleted successfully' };
}

// ============== MINDMAP MANAGEMENT ==============

/**
 * Get all mindmaps with pagination and filters
 * @param {Object} options - Query options
 * @returns {Object} - Mindmaps list with pagination
 */
async function getMindmaps(options = {}) {
  const { userId, search, status, favorite, page = 1, limit = 20, includeDeleted = false } = options;

  const query = {};

  // Filter by deleted status
  if (!includeDeleted) {
    query.deleted_at = null;
  }

  // Filter by user
  if (userId) {
    query.user_id = userId;
  }

  // Filter by status
  if (status !== undefined) {
    query.status = status === 'true' || status === true;
  }

  // Filter by favorite
  if (favorite !== undefined) {
    query.favorite = favorite === 'true' || favorite === true;
  }

  // Search by title or desc
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { desc: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [mindmaps, total] = await Promise.all([
    Mindmap.find(query)
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Mindmap.countDocuments(query)
  ]);

  // Populate user info for each mindmap
  const mindmapsWithUser = await Promise.all(
    mindmaps.map(async (mindmap) => {
      let user = null;
      if (mindmap.user_id) {
        user = await User.findById(mindmap.user_id)
          .select('name email avatar role')
          .lean();
      }
      return {
        ...mindmap,
        user: user || { name: 'Unknown', email: 'N/A' }
      };
    })
  );

  return {
    mindmaps: mindmapsWithUser,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get mindmap by ID
 * @param {String} mindmapId - Mindmap ID
 * @returns {Object} - Mindmap data
 */
async function getMindmapById(mindmapId) {
  const mindmap = await Mindmap.findById(mindmapId).lean();

  if (!mindmap) {
    throw new Error('Mindmap not found');
  }

  // Get user info
  let user = null;
  if (mindmap.user_id) {
    user = await User.findById(mindmap.user_id)
      .select('name email avatar role')
      .lean();
  }

  return {
    ...mindmap,
    user: user || { name: 'Unknown', email: 'N/A' }
  };
}

/**
 * Update mindmap
 * @param {String} mindmapId - Mindmap ID
 * @param {Object} updates - Update data
 * @returns {Object} - Updated mindmap
 */
async function updateMindmap(mindmapId, updates) {
  // Don't allow updating certain fields
  const { _id, user_id, created_at, ...allowedUpdates } = updates;

  const mindmap = await Mindmap.findByIdAndUpdate(
    mindmapId,
    { ...allowedUpdates, updated_at: new Date() },
    { new: true }
  ).lean();

  if (!mindmap) {
    throw new Error('Mindmap not found');
  }

  return mindmap;
}

/**
 * Delete mindmap (soft delete)
 * @param {String} mindmapId - Mindmap ID
 * @param {Boolean} permanent - Permanently delete
 * @returns {Object} - Deletion result
 */
async function deleteMindmap(mindmapId, permanent = false) {
  if (permanent) {
    const mindmap = await Mindmap.findByIdAndDelete(mindmapId);
    if (!mindmap) {
      throw new Error('Mindmap not found');
    }
    return { message: 'Mindmap permanently deleted' };
  }

  const mindmap = await Mindmap.findByIdAndUpdate(
    mindmapId,
    { deleted_at: new Date() },
    { new: true }
  );

  if (!mindmap) {
    throw new Error('Mindmap not found');
  }

  return { message: 'Mindmap deleted successfully' };
}

/**
 * Restore deleted mindmap
 * @param {String} mindmapId - Mindmap ID
 * @returns {Object} - Restored mindmap
 */
async function restoreMindmap(mindmapId) {
  const mindmap = await Mindmap.findByIdAndUpdate(
    mindmapId,
    { deleted_at: null },
    { new: true }
  ).lean();

  if (!mindmap) {
    throw new Error('Mindmap not found');
  }

  return mindmap;
}

module.exports = {
  getDashboardStats,
  getUsers,
  createUser,
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


const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Subject = require('../models/Subject');

/**
 * Converts string value to MongoDB ObjectId if valid
 * @param {string} value - String value to convert
 * @returns {ObjectId|undefined} - ObjectId if valid, undefined otherwise
 */
const convertToObjectId = (value) =>
  (value && mongoose.isValidObjectId(value)) ? new mongoose.Types.ObjectId(value) : undefined;

/**
 * Builds filter object for exam queries
 * @param {Object} params - Query parameters
 * @param {string} params.ownerId - Owner ID filter
 * @param {string} params.status - Status filter
 * @param {string} params.q - Search query
 * @returns {Object} - MongoDB filter object
 */
function buildExamFilter({ ownerId, status, q, subjectId }) {
  const filter = {};

  const examOwnerId = convertToObjectId(ownerId);
  if (examOwnerId) filter.ownerId = examOwnerId;

  if (status) filter.status = status;

  const subjectObjectId = convertToObjectId(subjectId);
  if (subjectObjectId) filter.subjectId = subjectObjectId;

  if (q && typeof q === 'string' && q.trim()) {
    const searchRegex = new RegExp(q.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { description: searchRegex }
    ];
  }

  return filter;
}

/**
 * Retrieves all exams with pagination and filtering
 * @param {Object} params - Query parameters
 * @param {string} params.ownerId - Owner ID filter
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.sort - Sort field
 * @param {string} params.status - Status filter
 * @param {string} params.q - Search query
 * @returns {Object} - Paginated exam data
 */
async function getAllExams(params) {
  const {
    ownerId,
    page = 1,
    limit = 20,
    sort = '-createdAt',
    status,
    q,
    subjectId
  } = params;

  let examFilter = buildExamFilter({ ownerId, status, q: null, subjectId });

  // If there's a search query, also search in subject names
  if (q && typeof q === 'string' && q.trim()) {
    const searchRegex = new RegExp(q.trim(), 'i');

    // Find subjects matching the search query
    const matchingSubjects = await Subject.find({
      $or: [
        { name: searchRegex },
        { name_en: searchRegex },
        { name_jp: searchRegex },
        { code: searchRegex }
      ]
    }).select('_id');

    const matchingSubjectIds = matchingSubjects.map(s => s._id);

    // Build $or condition for exam search
    const searchConditions = [
      { name: searchRegex },
      { description: searchRegex }
    ];

    // If we found matching subjects, add subjectId filter
    if (matchingSubjectIds.length > 0) {
      searchConditions.push({ subjectId: { $in: matchingSubjectIds } });
    }

    // If examFilter already has $or, merge it; otherwise create it
    if (examFilter.$or) {
      examFilter.$or = [...examFilter.$or, ...searchConditions];
    } else {
      examFilter.$or = searchConditions;
    }
  }

  const currentPage = Number(page) || 1;
  const pageLimit = Number(limit) || 20;
  const skipCount = (currentPage - 1) * pageLimit;

  const [exams, totalCount] = await Promise.all([
    Exam.find(examFilter)
      .populate('questions.questionId', 'name text type level')
      .populate('subjectId', 'name name_en name_jp code')
      .sort(sort)
      .skip(skipCount)
      .limit(pageLimit)
      .lean(),
    Exam.countDocuments(examFilter)
  ]);

  // Get submission counts for all exams
  const Submission = require('../models/Submission');
  const examIds = exams.map(e => e._id);
  const submissionCounts = await Submission.aggregate([
    { $match: { examId: { $in: examIds } } },
    { $group: { _id: '$examId', count: { $sum: 1 } } }
  ]);

  // Create a map of examId to submission count
  const countMap = new Map(submissionCounts.map(s => [s._id.toString(), s.count]));

  // Add submissionCount to each exam
  const examsWithCounts = exams.map(exam => ({
    ...exam,
    submissionCount: countMap.get(exam._id.toString()) || 0
  }));

  return {
    items: examsWithCounts,
    total: totalCount,
    page: currentPage,
    limit: pageLimit,
    pages: Math.max(1, Math.ceil(totalCount / pageLimit))
  };
}

/**
 * Retrieves a specific exam by ID
 * @param {Object} params - Query parameters
 * @param {string} params.id - Exam ID
 * @returns {Object|null} - Exam data or null if not found
 */
async function getExamById({ id }) {
  const examFilter = { _id: id };

  return Exam.findOne(examFilter)
    .populate('questions.questionId')
    .populate('subjectId', 'name name_en name_jp code')
    .exec();
}

/**
 * Retrieves an exam by share code (for public access)
 * @param {Object} params - Query parameters
 * @param {string} params.shareCode - Share code
 * @returns {Object|null} - Exam data or null if not found
 */
async function getExamByShareCode({ shareCode }) {
  const exam = await Exam.findOne({
    shareCode: shareCode.toUpperCase(),
    status: 'published'
  })
    .populate('questions.questionId')
    .lean();

  if (!exam) {
    return null;
  }

  // Check availability window
  const now = new Date();
  if (exam.availableFrom && now < exam.availableFrom) {
    return null; // Not available yet
  }
  if (exam.availableUntil && now > exam.availableUntil) {
    return null; // No longer available
  }

  // Check if exam has passed endTime
  if (exam.endTime && now > exam.endTime) {
    return null;
  }

  return exam;
}

/**
 * Creates a new exam
 * @param {Object} params - Creation parameters
 * @param {Object} params.payload - Exam data
 * @param {Object} params.user - User creating the exam
 * @returns {Object} - Created exam data
 */
async function createExam({ payload, user }) {
  const examOwnerId = user?.id || user?._id;

  // Validate user ID
  if (!mongoose.isValidObjectId(examOwnerId)) {
    const error = new Error('Invalid user ID');
    error.status = 400;
    throw error;
  }

  // Validate questions belong to the same subject (required)
  if (!payload.questions || payload.questions.length === 0) {
    const error = new Error('questions array is required and cannot be empty');
    error.status = 400;
    throw error;
  }

  if (!payload.subjectId) {
    const error = new Error('subjectId is required when creating exam with questions');
    error.status = 400;
    throw error;
  }

  const questionIds = payload.questions.map(q => q.questionId);

  // Check if all questions exist and belong to the same subject
  const questions = await Question.find({
    _id: { $in: questionIds },
    subjectId: payload.subjectId
  });

  if (questions.length !== questionIds.length) {
    const error = new Error('All questions must belong to the same subject');
    error.status = 400;
    throw error;
  }

  // Auto-fill subjectCode from first question
  if (questions.length > 0) {
    payload.subjectCode = questions[0].subjectCode;
  }

  // Generate shareCode if status is published
  if (payload.status === 'published') {
    payload.shareCode = await generateUniqueShareCode();
  }

  const exam = await Exam.create({
    ...payload,
    ownerId: examOwnerId
  });

  return exam;
}

/**
 * Generates a unique share code for exams
 * @returns {Promise<string>} - Unique 8-character alphanumeric code
 */
async function generateUniqueShareCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let shareCode;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 20) {
    // Generate 8-character code
    shareCode = '';
    for (let i = 0; i < 8; i++) {
      shareCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if code already exists
    const existing = await Exam.findOne({ shareCode });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    // Fallback: use timestamp-based code
    shareCode = Date.now().toString(36).toUpperCase().slice(-8);
  }

  return shareCode;
}

/**
 * Updates an existing exam partially
 * @param {Object} params - Update parameters
 * @param {string} params.id - Exam ID
 * @param {Object} params.payload - Update data
 * @param {string} params.ownerIdEnforce - Owner ID to enforce
 * @returns {Object|null} - Updated exam data or null if not found
 */
async function updateExamPartial({ id, payload, ownerIdEnforce }) {
  const examFilter = { _id: id };

  // If updating status to published and no shareCode exists, generate one
  if (payload.status === 'published') {
    const existingExam = await Exam.findById(id);
    if (existingExam && !existingExam.shareCode) {
      payload.shareCode = await generateUniqueShareCode();
    }
  }

  // If updating status from published to draft, remove shareCode
  if (payload.status === 'draft') {
    const existingExam = await Exam.findById(id);
    if (existingExam && existingExam.status === 'published') {
      payload.shareCode = null;
    }
  }
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    examFilter.ownerId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }

  return Exam.findOneAndUpdate(
    examFilter,
    { $set: payload },
    { new: true, runValidators: true }
  )
    .exec();
}

/**
 * Deletes an existing exam
 * @param {Object} params - Delete parameters
 * @param {string} params.id - Exam ID
 * @param {string} params.ownerIdEnforce - Owner ID to enforce
 * @returns {Object|null} - Deleted exam data or null if not found
 */
async function deleteExam({ id, ownerIdEnforce }) {
  const examFilter = { _id: id };
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    examFilter.ownerId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }

  return Exam.findOneAndDelete(examFilter).exec();
}

/**
 * Adds questions to an existing exam
 * @param {Object} params - Add questions parameters
 * @param {string} params.examId - Exam ID
 * @param {Array} params.questionIds - Array of question IDs
 * @param {string} params.ownerIdEnforce - Owner ID to enforce
 * @param {string} params.subjectId - Subject ID for validation
 * @returns {Object} - Updated exam data
 */
async function addQuestionsToExam({ examId, questionIds, ownerIdEnforce, subjectId }) {
  // Validate question IDs
  const validQuestionIds = questionIds.filter(id => mongoose.isValidObjectId(id));
  if (validQuestionIds.length === 0) {
    const error = new Error('No valid question IDs provided');
    error.status = 400;
    throw error;
  }

  // Check if questions exist and validate subject
  const questionFilter = { _id: { $in: validQuestionIds } };
  if (subjectId) {
    questionFilter.subjectId = new mongoose.Types.ObjectId(subjectId);
  }

  const existingQuestions = await Question.find(questionFilter).select('_id subjectId');
  const existingQuestionIds = existingQuestions.map(q => q._id.toString());
  const missingQuestionIds = validQuestionIds.filter(id => !existingQuestionIds.includes(id));

  if (missingQuestionIds.length > 0) {
    const error = new Error(`Questions not found: ${missingQuestionIds.join(', ')}`);
    error.status = 404;
    throw error;
  }

  // If subjectId provided, check if all questions belong to same subject
  if (subjectId && existingQuestions.length > 0) {
    const questionSubjects = existingQuestions.map(q => q.subjectId?.toString()).filter(Boolean);
    const uniqueSubjects = [...new Set(questionSubjects)];

    if (uniqueSubjects.length > 1) {
      const error = new Error('All questions must belong to the same subject');
      error.status = 400;
      throw error;
    }

    if (uniqueSubjects.length === 1 && uniqueSubjects[0] !== subjectId) {
      const error = new Error('Questions do not belong to the specified subject');
      error.status = 400;
      throw error;
    }
  }

  // Get exam
  const examFilter = { _id: examId };
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    examFilter.ownerId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }

  const exam = await Exam.findOne(examFilter);
  if (!exam) {
    const error = new Error('Exam not found');
    error.status = 404;
    throw error;
  }

  // Add questions to exam
  const existingQuestionIdsInExam = exam.questions.map(q => q.questionId.toString());
  const newQuestionIds = validQuestionIds.filter(id => !existingQuestionIdsInExam.includes(id));

  if (newQuestionIds.length === 0) {
    return exam; // No new questions to add
  }

  // Add new questions
  const maxOrder = Math.max(...exam.questions.map(q => q.order), 0);
  const newQuestions = newQuestionIds.map((questionId, index) => ({
    questionId: new mongoose.Types.ObjectId(questionId),
    order: maxOrder + index + 1,
    marks: 1,
    isRequired: true
  }));

  exam.questions.push(...newQuestions);
  await exam.save();

  return exam;
}

/**
 * Removes a question from an existing exam
 * @param {Object} params - Remove question parameters
 * @param {string} params.examId - Exam ID
 * @param {string} params.questionId - Question ID to remove
 * @param {string} params.ownerIdEnforce - Owner ID to enforce
 * @returns {Object} - Updated exam data
 */
async function removeQuestionFromExam({ examId, questionId, ownerIdEnforce }) {
  const examFilter = { _id: examId };
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    examFilter.ownerId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }

  const exam = await Exam.findOne(examFilter);
  if (!exam) {
    const error = new Error('Exam not found');
    error.status = 404;
    throw error;
  }

  // Remove question from exam
  const initialLength = exam.questions.length;
  exam.questions = exam.questions.filter(q => !q.questionId.equals(questionId));

  if (exam.questions.length === initialLength) {
    const error = new Error('Question not found in exam');
    error.status = 404;
    throw error;
  }

  await exam.save();
  return exam;
}

module.exports = {
  getAllExams,
  getExamById,
  getExamByShareCode,
  createExam,
  updateExamPartial,
  deleteExam,
  addQuestionsToExam,
  removeQuestionFromExam
};
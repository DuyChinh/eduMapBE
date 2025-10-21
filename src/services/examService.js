const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Question = require('../models/Question');

const convertToObjectId = (value) =>
  (value && mongoose.isValidObjectId(value)) ? new mongoose.Types.ObjectId(value) : undefined;

// Build filter for exam queries
function buildExamFilter({ ownerId, status, q }) {
  const filter = {};

  const examOwnerId = convertToObjectId(ownerId);
  if (examOwnerId) filter.ownerId = examOwnerId;

  if (status) filter.status = status;

  if (q && typeof q === 'string' && q.trim()) {
    const searchRegex = new RegExp(q.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { description: searchRegex }
    ];
  }

  return filter;
}

// Get all exams with pagination
async function getAllExams(params) {
  const {
    ownerId,
    page = 1,
    limit = 20,
    sort = '-createdAt',
    status,
    q
  } = params;

  const examFilter = buildExamFilter({ ownerId, status, q });

  const currentPage = Number(page) || 1;
  const pageLimit = Number(limit) || 20;
  const skipCount = (currentPage - 1) * pageLimit;

  const [exams, totalCount] = await Promise.all([
    Exam.find(examFilter)
      .populate('questions.questionId', 'name text type level')
      .sort(sort)
      .skip(skipCount)
      .limit(pageLimit),
    Exam.countDocuments(examFilter)
  ]);

  return {
    items: exams,
    total: totalCount,
    page: currentPage,
    limit: pageLimit,
    pages: Math.max(1, Math.ceil(totalCount / pageLimit))
  };
}

// Get exam by ID
async function getExamById({ id }) {
  const examFilter = { _id: id };

  return Exam.findOne(examFilter)
    .populate('questions.questionId')
    .exec();
}

// Create new exam
async function createExam({ payload, user }) {
  const examOwnerId = user?.id || user?._id;

  const exam = await Exam.create({
    ...payload,
    ownerId: examOwnerId
  });

  return exam;
}

// Update exam partially
async function updateExamPartial({ id, payload, ownerIdEnforce }) {
  const examFilter = { _id: id };
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    examFilter.ownerId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }

  return Exam.findOneAndUpdate(
    examFilter,
    { $set: payload },
    { new: true, runValidators: true }
  );
}

// Delete exam
async function deleteExam({ id, ownerIdEnforce }) {
  const examFilter = { _id: id };
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    examFilter.ownerId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }

  return Exam.findOneAndDelete(examFilter);
}

// Add questions to exam
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

// Remove question from exam
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
  createExam,
  updateExamPartial,
  deleteExam,
  addQuestionsToExam,
  removeQuestionFromExam
};
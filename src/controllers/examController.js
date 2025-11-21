const mongoose = require('mongoose');
const examService = require('../services/examService');

// User role validation helpers
const isTeacher = (user) => user && user.role === 'teacher';
const isAdmin = (user) => user && user.role === 'admin';
const isStudent = (user) => user && user.role === 'student';
const isTeacherOrAdmin = (user) => isTeacher(user) || isAdmin(user);

/**
 * Validates if user has teacher or admin role
 * @param {Object} user - User object
 * @returns {boolean} - True if user is teacher or admin
 */
function validateTeacherOrAdminRole(user) {
  return user && (user.role === 'teacher' || user.role === 'admin');
}

/**
 * Creates a new exam
 * POST /v1/api/exams
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function createExam(req, res, next) {
  try {
    if (!validateTeacherOrAdminRole(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const { 
      name, description, duration, totalMarks, questions, settings, 
      startTime, endTime, timezone, subjectId, gradeId, fee, 
      examPassword, autoMonitoring, studentVerification, eduMapOnly, 
      hideGroupTitles, sectionsStartFromQ1, hideLeaderboard, addTitleInfo, 
      preExamNotification, preExamNotificationText, examPurpose, 
      isAllowUser, allowedClassIds, availableFrom, availableUntil, shuffleQuestions, 
      shuffleChoices, maxAttempts, viewMark, viewExamAndAnswer,
      status // 'draft' or 'published'
    } = req.body;
    
    // Input validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ ok: false, message: 'name is required and cannot be empty' });
    }

    if (!duration || typeof duration !== 'number' || duration <= 0 || duration % 1 !== 0) {
      return res.status(400).json({ ok: false, message: 'duration must be a positive integer (minutes)' });
    }

    if (!totalMarks || typeof totalMarks !== 'number' || totalMarks < 0) {
      return res.status(400).json({ ok: false, message: 'totalMarks must be a non-negative number' });
    }

    // Validate gradeId if provided
    if (gradeId && !mongoose.isValidObjectId(gradeId)) {
      return res.status(400).json({ ok: false, message: 'Invalid gradeId format' });
    }

    // Validate fee if provided
    if (fee !== undefined && (typeof fee !== 'number' || fee < 0)) {
      return res.status(400).json({ ok: false, message: 'fee must be a non-negative number' });
    }

    // Validate examPassword (required)
    if (!examPassword || typeof examPassword !== 'string') {
      return res.status(400).json({ ok: false, message: 'examPassword is required and must be a string' });
    }

    // Validate examPurpose (required)
    if (!examPurpose || !['exam', 'practice', 'quiz', 'assignment'].includes(examPurpose)) {
      return res.status(400).json({ ok: false, message: 'examPurpose is required and must be one of: exam, practice, quiz, assignment' });
    }

    // Validate isAllowUser (required)
    if (!isAllowUser || !['everyone', 'class', 'student'].includes(isAllowUser)) {
      return res.status(400).json({ ok: false, message: 'isAllowUser is required and must be one of: everyone, class, student' });
    }

    // Validate maxAttempts (required)
    if (!maxAttempts || typeof maxAttempts !== 'number' || maxAttempts < 1 || maxAttempts % 1 !== 0) {
      return res.status(400).json({ ok: false, message: 'maxAttempts is required and must be a positive integer >= 1' });
    }

    // Validate viewMark (required)
    if (viewMark === undefined || ![0, 1, 2].includes(viewMark)) {
      return res.status(400).json({ ok: false, message: 'viewMark is required and must be one of: 0 (never), 1 (afterCompletion), 2 (afterAllFinish)' });
    }

    // Validate viewExamAndAnswer (required)
    if (viewExamAndAnswer === undefined || ![0, 1, 2].includes(viewExamAndAnswer)) {
      return res.status(400).json({ ok: false, message: 'viewExamAndAnswer is required and must be one of: 0 (never), 1 (afterCompletion), 2 (afterAllFinish)' });
    }

    // Validate autoMonitoring if provided
    if (autoMonitoring && !['off', 'screenExit', 'fullMonitoring'].includes(autoMonitoring)) {
      return res.status(400).json({ ok: false, message: 'autoMonitoring must be one of: off, screenExit, fullMonitoring' });
    }

    // Validate availability window
    if (availableFrom && availableUntil) {
      const from = new Date(availableFrom);
      const until = new Date(availableUntil);
      
      if (isNaN(from.getTime()) || isNaN(until.getTime())) {
        return res.status(400).json({ ok: false, message: 'Invalid availableFrom or availableUntil format' });
      }
      
      if (from >= until) {
        return res.status(400).json({ ok: false, message: 'availableFrom must be before availableUntil' });
      }
    }

    // Validate preExamNotificationText if preExamNotification is true
    if (preExamNotification && (!preExamNotificationText || typeof preExamNotificationText !== 'string' || !preExamNotificationText.trim())) {
      return res.status(400).json({ ok: false, message: 'preExamNotificationText is required when preExamNotification is enabled' });
    }

    // Validate questions and subject (required)
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ ok: false, message: 'questions array is required and cannot be empty' });
    }
    
    if (!subjectId) {
      return res.status(400).json({ ok: false, message: 'subjectId is required when creating exam with questions' });
    }
    
    if (!mongoose.isValidObjectId(subjectId)) {
      return res.status(400).json({ ok: false, message: 'Invalid subjectId format' });
    }
    
    // Validate each question
    for (const question of questions) {
      if (!question.questionId || !mongoose.isValidObjectId(question.questionId)) {
        return res.status(400).json({ ok: false, message: 'Invalid questionId format' });
      }
      if (!question.order || typeof question.order !== 'number' || question.order < 1) {
        return res.status(400).json({ ok: false, message: 'Question order must be a positive integer' });
      }
      if (question.marks !== undefined && (typeof question.marks !== 'number' || question.marks < 0)) {
        return res.status(400).json({ ok: false, message: 'Question marks must be a non-negative number' });
      }
    }
    
    // Validate total marks vs questions marks
    const totalQuestionMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    if (totalQuestionMarks > totalMarks) {
      return res.status(400).json({ 
        ok: false, 
        message: `Total question marks (${totalQuestionMarks}) cannot exceed exam total marks (${totalMarks})` 
      });
    }

    // Validate scheduling
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ ok: false, message: 'Invalid startTime or endTime format' });
      }
      
      if (start >= end) {
        return res.status(400).json({ ok: false, message: 'startTime must be before endTime' });
      }
      
      const timeDiffMinutes = (end - start) / (1000 * 60);
      if (timeDiffMinutes < duration) {
        return res.status(400).json({ ok: false, message: 'Exam duration cannot exceed the time range' });
      }
    }

    const payload = {
      name: name.trim(),
      description: description?.trim() || '',
      duration,
      totalMarks,
      questions: questions || [],
      settings: settings || {},
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      timezone: timezone || 'Asia/Ho_Chi_Minh',
      subjectId: subjectId || undefined,
      gradeId: gradeId || undefined,
      examPurpose: examPurpose || 'exam',
      isAllowUser: isAllowUser || 'everyone',
      allowedClassIds: (isAllowUser === 'class' && allowedClassIds && Array.isArray(allowedClassIds)) ? allowedClassIds : [],
      availableFrom: availableFrom ? new Date(availableFrom) : undefined,
      availableUntil: availableUntil ? new Date(availableUntil) : undefined,
      fee: fee !== undefined ? fee : 0,
      examPassword: examPassword.trim(),
      autoMonitoring: autoMonitoring || 'off',
      studentVerification: studentVerification || false,
      eduMapOnly: eduMapOnly || false,
      hideGroupTitles: hideGroupTitles || false,
      sectionsStartFromQ1: sectionsStartFromQ1 || false,
      viewMark: viewMark !== undefined ? viewMark : 1,
      viewExamAndAnswer: viewExamAndAnswer !== undefined ? viewExamAndAnswer : 1,
      hideLeaderboard: hideLeaderboard || false,
      addTitleInfo: addTitleInfo || false,
      preExamNotification: preExamNotification || false,
      preExamNotificationText: preExamNotificationText?.trim() || '',
      shuffleQuestions: shuffleQuestions || false,
      shuffleChoices: shuffleChoices || false,
      maxAttempts: maxAttempts || 1,
      status: status || 'draft'
    };

    const createdExam = await examService.createExam({ payload, user: req.user });
    res.status(201).json({ ok: true, data: createdExam });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ ok: false, message: e.message });
    }
    
    // Handle duplicate key error (unique constraint)
    if (e.code === 11000) {
      return res.status(400).json({ ok: false, message: 'An exam with this name already exists for this teacher' });
    }
    
    // Handle validation errors
    if (e.name === 'ValidationError') {
      return res.status(400).json({ ok: false, message: e.message });
    }
    
    next(e);
  }
}

/**
 * Retrieves all exams with pagination and filtering
 * GET /v1/api/exams
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getAllExams(req, res, next) {
  try {
    const { page, limit, sort, status, q, ownerId } = req.query;

    // Teachers can only view their own exams, admins can view all
    const filterOwnerId = isTeacher(req.user) && !ownerId ? req.user.id : ownerId;

    const examData = await examService.getAllExams({
      ownerId: filterOwnerId,
      page,
      limit,
      sort,
      status,
      q
    });

    res.json({ ok: true, ...examData });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves a specific exam by ID
 * GET /v1/api/exams/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getExamById(req, res, next) {
  try {
    const examId = req.params.id;
    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid exam ID format' });
    }

    const examData = await examService.getExamById({ id: examId });
    
    if (!examData) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    // Check permissions - only owner or admin can view
    const isOwner = String(examData.ownerId) === String(req.user.id);
    if (!(isOwner || isAdmin(req.user))) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    res.json({ ok: true, data: examData });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates an existing exam
 * PATCH /v1/api/exams/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function updateExam(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const examId = req.params.id;
    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid exam ID format' });
    }

    // Enforce ownership for non-admin users
    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const updatedExam = await examService.updateExamPartial({
      id: examId,
      payload: req.body,
      ownerIdEnforce
    });

    if (!updatedExam) {
      return res.status(403).json({ ok: false, message: 'Forbidden or exam not found' });
    }

    res.json({ ok: true, data: updatedExam });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ ok: false, message: error.message });
    }
    next(error);
  }
}

/**
 * Deletes an existing exam
 * DELETE /v1/api/exams/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function deleteExam(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const examId = req.params.id;
    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid exam ID format' });
    }

    // Enforce ownership for non-admin users
    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const deletedExam = await examService.deleteExam({ id: examId, ownerIdEnforce });
    
    if (!deletedExam) {
      return res.status(403).json({ ok: false, message: 'Forbidden or exam not found' });
    }

    res.json({ ok: true, message: 'Exam deleted successfully', data: deletedExam });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ ok: false, message: error.message });
    }
    next(error);
  }
}

/**
 * Adds questions to an existing exam
 * POST /v1/api/exams/:id/questions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function addQuestionsToExam(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const examId = req.params.id;
    const { questionIds, subjectId } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'questionIds array is required' });
    }

    // Enforce ownership for non-admin users
    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const updatedExam = await examService.addQuestionsToExam({
      examId,
      questionIds,
      subjectId,
      ownerIdEnforce
    });

    res.json({ ok: true, data: updatedExam });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ ok: false, message: error.message });
    }
    next(error);
  }
}

/**
 * Removes a question from an existing exam
 * DELETE /v1/api/exams/:id/questions/:questionId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function removeQuestionFromExam(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const examId = req.params.id;
    const questionId = req.params.questionId;

    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(questionId)) {
      return res.status(400).json({ ok: false, message: 'Invalid exam or question ID format' });
    }

    // Enforce ownership for non-admin users
    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const updatedExam = await examService.removeQuestionFromExam({
      examId,
      questionId,
      ownerIdEnforce
    });

    res.json({ ok: true, data: updatedExam });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ ok: false, message: error.message });
    }
    next(error);
  }
}

module.exports = {
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
  addQuestionsToExam,
  removeQuestionFromExam
};

const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const Question = require('../models/Question');

/**
 * Starts a new exam submission
 * @param {Object} params - Parameters
 * @param {string} params.examId - Exam ID
 * @param {Object} params.user - User object
 * @param {string} params.orgId - Organization ID
 * @returns {Object} - Submission with exam questions (shuffled if needed)
 */
async function startSubmission({ examId, user, orgId }) {
  // Validate exam exists and is accessible
  const exam = await Exam.findById(examId);
  if (!exam) {
    throw { status: 404, message: 'Exam not found' };
  }

  // Check if exam is published
  if (exam.status !== 'published') {
    throw { status: 403, message: 'Exam is not available' };
  }

  // Check exam availability window
  const now = new Date();
  if (exam.availableFrom && now < exam.availableFrom) {
    throw { status: 403, message: 'Exam is not available yet' };
  }
  if (exam.availableUntil && now > exam.availableUntil) {
    throw { status: 403, message: 'Exam is no longer available' };
  }

  // Check if user has access based on isAllowUser setting
  if (exam.isAllowUser === 'class') {
    if (!exam.allowedClassIds || exam.allowedClassIds.length === 0) {
      throw { status: 403, message: 'This exam is restricted to specific classes. No classes have been assigned.' };
    }
    
    // Check if student is in any of the allowed classes
    const Class = require('../models/Class');
    const userId = new mongoose.Types.ObjectId(user.id);
    
    const allowedClasses = await Class.find({
      _id: { $in: exam.allowedClassIds },
      studentIds: userId
    });
    
    if (!allowedClasses || allowedClasses.length === 0) {
      throw { status: 403, message: 'You are not enrolled in any of the classes allowed for this exam.' };
    }
  }

  const existingSubmissions = await Submission.countDocuments({
    examId,
    userId: user.id,
    status: { $in: ['submitted', 'graded', 'late'] }
  });

  if (existingSubmissions >= exam.maxAttempts) {
    throw { 
      status: 403, 
      message: `You have reached the maximum number of attempts (${existingSubmissions}/${exam.maxAttempts}). You cannot start this exam again.` 
    };
  }

  // Check if there's an in-progress submission
  const inProgressSubmission = await Submission.findOne({
    examId,
    userId: user.id,
    status: 'in_progress'
  });

  if (inProgressSubmission) {
    const startedAt = inProgressSubmission.startedAt;
    if (startedAt) {
      const timeSpent = Math.floor((now - startedAt) / 1000); // seconds
      const durationSeconds = exam.duration * 60;
      const timeRemaining = durationSeconds - timeSpent;

      if (timeRemaining <= 0) {
        const freshSubmission = await Submission.findById(inProgressSubmission._id)
          .populate('examId');
        
        if (!freshSubmission) {
          throw { status: 404, message: 'Submission not found' };
        }

        const autoSubmittedSubmission = await submitExam({
          submissionId: freshSubmission._id,
          user,
          isAutoSubmit: true 
        });
        
        throw { 
          status: 400, 
          message: 'Your exam time has expired. Your submission has been automatically submitted.',
          autoSubmitted: true,
          submissionId: autoSubmittedSubmission._id
        };
      }
    }

    const examWithQuestions = await Exam.findById(examId)
      .populate('questions.questionId')
      .lean();

    return {
      submission: inProgressSubmission,
      exam: examWithQuestions,
      questionOrder: inProgressSubmission.questionOrder
    };
  }

  if (exam.endTime && now > exam.endTime) {
    const recentSubmission = await Submission.findOne({
      examId,
      userId: user.id,
      status: { $in: ['submitted', 'graded', 'late'] }
    })
      .sort({ submittedAt: -1 })
      .limit(1);

    if (recentSubmission && recentSubmission.submittedAt) {
      const timeSinceSubmit = Math.floor((now - recentSubmission.submittedAt) / 1000);
      if (timeSinceSubmit <= 300 && exam.endTime > recentSubmission.submittedAt) {
        throw {
          status: 400,
          message: 'Your exam submission has already been submitted. Please check your results.',
          autoSubmitted: true,
          submissionId: recentSubmission._id
        };
      }
    }

    throw { status: 403, message: 'Exam has expired. The exam end time has passed.' };
  }

  // Get exam questions
  const examWithQuestions = await Exam.findById(examId)
    .populate('questions.questionId')
    .lean();

  if (!examWithQuestions.questions || examWithQuestions.questions.length === 0) {
    throw { status: 400, message: 'Exam has no questions' };
  }

  // Prepare question order (shuffle if needed)
  let questionOrder = examWithQuestions.questions.map(q => q.questionId._id.toString());
  
  if (exam.settings?.randomizeQuestionOrder || exam.settings?.shuffleQuestions) {
    questionOrder = shuffleArray([...questionOrder]);
  }

  // Create new submission
  // Only set orgId if it exists (not required)
  const submissionData = {
    examId,
    userId: user.id,
    questionOrder,
    startedAt: new Date(),
    status: 'in_progress',
    attemptNumber: existingSubmissions + 1,
    maxScore: exam.totalMarks,
    answers: [],
    score: 0,
    percentage: 0
  };
  
  // Only add orgId if it exists
  if (orgId || user.orgId) {
    submissionData.orgId = orgId || user.orgId;
  }
  
  const submission = new Submission(submissionData);

  await submission.save();

  // Shuffle choices for each question if needed
  const questionsWithShuffledChoices = examWithQuestions.questions.map(q => {
    const question = { ...q.questionId };
    
    if (exam.settings?.randomizeChoiceOrder || exam.settings?.shuffleChoices) {
      if (question.choices && Array.isArray(question.choices)) {
        question.choices = shuffleArray([...question.choices]);
      }
    }
    
    return {
      ...q,
      questionId: question
    };
  });

  return {
    submission,
    exam: {
      ...examWithQuestions,
      questions: questionsWithShuffledChoices
    },
    questionOrder
  };
}

/**
 * Updates submission answers (auto-save)
 * @param {Object} params - Parameters
 * @param {string} params.submissionId - Submission ID
 * @param {Array} params.answers - Array of answers
 * @param {Object} params.user - User object
 * @returns {Object} - Updated submission
 */
async function updateSubmissionAnswers({ submissionId, answers, user }) {
  const submission = await Submission.findOne({
    _id: submissionId,
    userId: user.id,
    status: 'in_progress'
  }).populate('examId');

  if (!submission) {
    throw { status: 404, message: 'Submission not found or already submitted' };
  }

  // Check if exam has passed endTime
  const exam = submission.examId;
  if (exam && exam.endTime) {
    const now = new Date();
    if (now > exam.endTime) {
      throw { status: 403, message: 'Cannot update answers: Exam has expired. The exam end time has passed.' };
    }
  }

  // Update answers
  submission.answers = answers.map(answer => ({
    questionId: answer.questionId,
    value: answer.value,
    updatedAt: new Date()
  }));

  submission.autoSavedAt = new Date();
  await submission.save();

  return submission;
}

/**
 * Submits an exam and grades it
 * @param {Object} params - Parameters
 * @param {string} params.submissionId - Submission ID
 * @param {Object} params.user - User object
 * @param {boolean} params.isAutoSubmit - If true, bypass endTime check and set timeSpent = duration
 * @returns {Object} - Graded submission
 */
async function submitExam({ submissionId, user, isAutoSubmit = false }) {
  const submission = await Submission.findOne({
    _id: submissionId,
    userId: user.id,
    status: 'in_progress'
  }).populate('examId');

  if (!submission) {
    throw { status: 404, message: 'Submission not found or already submitted' };
  }

  const exam = submission.examId;
  if (!exam) {
    throw { status: 404, message: 'Exam not found' };
  }

  const now = new Date();
  const durationSeconds = exam.duration * 60;
  let timeSpent;
  let isLate = false;

  if (isAutoSubmit) {
    timeSpent = durationSeconds;
    isLate = true;
  } else {
    if (exam.endTime && now > exam.endTime) {
      throw { status: 403, message: 'Cannot submit: Exam has expired. The exam end time has passed.' };
    }

    // Check if time limit exceeded
    timeSpent = Math.floor((now - submission.startedAt) / 1000); // seconds

    if (timeSpent > durationSeconds) {
      if (!exam.settings?.allowLateSubmission) {
        throw { status: 400, message: 'Time limit exceeded' };
      }
      isLate = true;
    }
  }

  // Grade answers
  const answersArray = submission.answers || [];
  
  console.log('Grading submission:', submission._id);
  console.log('Answers count:', answersArray.length);
  console.log('Is auto-submit:', isAutoSubmit);
  console.log('Is late:', isLate);
  
  // If no answers, still grade and return score 0
  if (answersArray.length === 0) {
    console.log('No answers found, setting score to 0');
    submission.answers = [];
    submission.score = 0;
    submission.maxScore = exam.totalMarks;
    submission.percentage = 0;
    submission.submittedAt = now;
    submission.timeSpent = timeSpent;
    submission.status = isLate ? 'late' : 'graded';
    await submission.save();
    
    // Update exam stats
    await Exam.findByIdAndUpdate(exam._id, {
      $inc: { 'stats.totalAttempts': 1 }
    });
    
    return submission;
  }
  
  // Get question IDs from answers
  const questionIds = answersArray
    .map(a => {
      if (a.questionId) {
        try {
          return mongoose.Types.ObjectId.isValid(a.questionId) 
            ? new mongoose.Types.ObjectId(a.questionId) 
            : null;
        } catch (e) {
          return null;
        }
      }
      return null;
    })
    .filter(Boolean);
  
  console.log('Question IDs to grade:', questionIds.length);
  
  const questions = questionIds.length > 0 
    ? await Question.find({ _id: { $in: questionIds } })
    : [];

  console.log('Questions found:', questions.length);

  // Create a map for quick lookup
  const questionMap = new Map();
  questions.forEach(q => {
    questionMap.set(q._id.toString(), q);
  });

  let totalScore = 0;
  const gradedAnswers = answersArray.map(answer => {
    // Handle both ObjectId and string formats
    let answerQuestionId = null;
    try {
      if (answer.questionId) {
        if (mongoose.Types.ObjectId.isValid(answer.questionId)) {
          answerQuestionId = new mongoose.Types.ObjectId(answer.questionId).toString();
        } else {
          answerQuestionId = String(answer.questionId);
        }
      }
    } catch (e) {
      console.error('Error processing questionId:', answer.questionId, e);
    }
    
    const question = answerQuestionId ? questionMap.get(answerQuestionId) : null;
    
    if (!question) {
      console.log('Question not found for answer, questionId:', answerQuestionId);
      return {
        ...(answer.toObject ? answer.toObject() : answer),
        questionId: answer.questionId,
        value: answer.value,
        isCorrect: false,
        points: 0
      };
    }

    // Find exam question to get marks
    let examQuestion = null;
    for (const eq of exam.questions || []) {
      let eqQuestionId = null;
      try {
        if (eq.questionId) {
          if (mongoose.Types.ObjectId.isValid(eq.questionId)) {
            eqQuestionId = new mongoose.Types.ObjectId(eq.questionId).toString();
          } else {
            eqQuestionId = String(eq.questionId);
          }
        }
      } catch (e) {
        continue;
      }
      
      if (eqQuestionId === answerQuestionId) {
        examQuestion = eq;
        break;
      }
    }
    
    const marks = examQuestion?.marks || 1;

    let isCorrect = false;
    let points = 0;

    // Only grade if answer has a value
    if (answer.value !== null && answer.value !== undefined && answer.value !== '') {
      // Grade based on question type
      if (question.type === 'mcq' || question.type === 'tf') {
        // Multiple choice or true/false
        const correctAnswer = String(question.answer || '').trim();
        const userAnswer = String(answer.value || '').trim();
        isCorrect = correctAnswer === userAnswer && correctAnswer !== '';
        points = isCorrect ? marks : 0;
      } else if (question.type === 'short') {
        // Short answer - simple text comparison (case insensitive)
        const correctAnswer = String(question.answer || '').trim().toLowerCase();
        const userAnswer = String(answer.value || '').trim().toLowerCase();
        isCorrect = correctAnswer === userAnswer && correctAnswer !== '';
        points = isCorrect ? marks : 0;
      } else {
        isCorrect = false;
        points = 0;
      }
    } else {
      // No answer provided
      isCorrect = false;
      points = 0;
    }

    totalScore += points;

    return {
      ...(answer.toObject ? answer.toObject() : answer),
      questionId: answer.questionId,
      value: answer.value,
      isCorrect,
      points
    };
  });
  
  console.log('Total score calculated:', totalScore);

  // Update submission
  submission.answers = gradedAnswers;
  submission.score = totalScore;
  submission.maxScore = exam.totalMarks;
  submission.percentage = exam.totalMarks > 0 
    ? Math.round((totalScore / exam.totalMarks) * 100) 
    : 0;
  submission.submittedAt = now;
  submission.timeSpent = timeSpent;
  submission.status = isLate ? 'late' : 'graded';

  await submission.save();

  // Update exam stats
  await Exam.findByIdAndUpdate(exam._id, {
    $inc: { 'stats.totalAttempts': 1 }
  });

  return submission;
}

/**
 * Gets submission by ID
 * @param {Object} params - Parameters
 * @param {string} params.submissionId - Submission ID
 * @param {Object} params.user - User object
 * @returns {Object} - Submission with exam
 */
async function getSubmissionById({ submissionId, user }) {
  const submission = await Submission.findById(submissionId)
    .populate({
      path: 'examId',
      populate: {
        path: 'questions.questionId'
      }
    })
    .populate('userId', 'name email');

  if (!submission) {
    throw { status: 404, message: 'Submission not found' };
  }

  // Check permissions
  const isOwner = submission.userId._id.toString() === user.id;
  const isTeacher = user.role === 'teacher' || user.role === 'admin';
  const examOwner = submission.examId?.ownerId?.toString() === user.id;

  if (!isOwner && !isTeacher && !examOwner) {
    throw { status: 403, message: 'Forbidden' };
  }

  return submission;
}

/**
 * Gets all submissions for an exam (teacher/admin only)
 * @param {Object} params - Parameters
 * @param {string} params.examId - Exam ID
 * @param {Object} params.user - User object
 * @returns {Array} - List of submissions
 */
async function getExamSubmissions({ examId, user }) {
  if (user.role !== 'teacher' && user.role !== 'admin') {
    throw { status: 403, message: 'Forbidden' };
  }

  const exam = await Exam.findById(examId);
  if (!exam) {
    throw { status: 404, message: 'Exam not found' };
  }

  // Check if user owns the exam (unless admin)
  if (user.role !== 'admin' && exam.ownerId.toString() !== user.id) {
    throw { status: 403, message: 'Forbidden' };
  }

  const submissions = await Submission.find({ examId })
    .populate('userId', 'name email')
    .sort({ submittedAt: -1 });

  return submissions;
}

/**
 * Gets leaderboard for an exam (sorted by score)
 * @param {Object} params - Parameters
 * @param {string} params.examId - Exam ID
 * @param {Object} params.user - User object
 * @returns {Array} - Leaderboard with rankings
 */
async function getExamLeaderboard({ examId, user }) {
  const exam = await Exam.findById(examId);
  if (!exam) {
    throw { status: 404, message: 'Exam not found' };
  }

  // Check if leaderboard is hidden
  if (exam.hideLeaderboard) {
    throw { status: 403, message: 'Leaderboard is hidden for this exam' };
  }

  // Get all graded submissions
  const submissions = await Submission.find({ 
    examId,
    status: { $in: ['graded', 'submitted'] }
  })
    .populate('userId', 'name email')
    .sort({ score: -1, submittedAt: 1 }); // Sort by score descending, then by submittedAt ascending

  // Build leaderboard
  const leaderboard = submissions.map((submission, index) => ({
    rank: index + 1,
    userId: submission.userId._id,
    name: submission.userId.name || 'Unknown',
    email: submission.userId.email,
    score: submission.score || 0,
    maxScore: submission.maxScore || exam.totalMarks,
    percentage: submission.percentage || 0,
    submittedAt: submission.submittedAt,
    timeSpent: submission.timeSpent
  }));

  return leaderboard;
}

/**
 * Gets current user's submissions with filters
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @param {Object} params.filters - Filter options (subject, status, startDate, endDate)
 * @returns {Array} - List of user's submissions
 */
async function getMySubmissions({ userId, filters = {} }) {
  const query = {
    userId,
    status: { $in: ['submitted', 'graded', 'late'] } // Only get completed submissions
  };

  // Apply filters
  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    query.submittedAt = {};
    if (filters.startDate) {
      query.submittedAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.submittedAt.$lte = new Date(filters.endDate);
    }
  }

  // Get submissions with exam info
  let submissions = await Submission.find(query)
    .populate({
      path: 'examId',
      select: 'name subjectId subjectCode description totalMarks ownerId',
      populate: [
        {
          path: 'ownerId',
          select: 'name email'
        },
        {
          path: 'subjectId',
          select: 'name name_en name_jp code'
        }
      ]
    })
    .populate('userId', 'name email')
    .sort({ submittedAt: -1 })
    .lean();

  // Filter by subject if provided
  if (filters.subject) {
    submissions = submissions.filter(submission => {
      const exam = submission.examId;
      if (!exam) return false;
      
      // Check subject name from populated subjectId
      const subject = exam.subjectId;
      if (subject) {
        const subjectName = subject.name || subject.name_en || subject.name_jp || subject.code || '';
        if (subjectName.toLowerCase().includes(filters.subject.toLowerCase())) {
          return true;
        }
      }
      
      // Check subjectCode
      if (exam.subjectCode) {
        if (exam.subjectCode.toLowerCase().includes(filters.subject.toLowerCase())) {
          return true;
        }
      }
      
      return false;
    });
  }

  // Format response
  const formattedSubmissions = submissions.map(submission => {
    const exam = submission.examId || {};
    const subject = exam.subjectId || {};
    
    // Get subject name (prefer current language, fallback to name)
    const getSubjectName = () => {
      if (subject.name) return subject.name;
      if (subject.name_en) return subject.name_en;
      if (subject.name_jp) return subject.name_jp;
      if (subject.code) return subject.code;
      if (exam.subjectCode) return exam.subjectCode;
      return '';
    };
    
    return {
      _id: submission._id,
      examId: exam._id,
      exam: {
        _id: exam._id,
        name: exam.name,
        subject: getSubjectName(),
        subjectId: exam.subjectId?._id || exam.subjectId,
        description: exam.description,
        totalMarks: exam.totalMarks
      },
      score: submission.score || 0,
      totalMarks: submission.maxScore || exam.totalMarks || 0,
      percentage: submission.percentage || 0,
      timeSpent: submission.timeSpent || 0,
      startedAt: submission.startedAt,
      submittedAt: submission.submittedAt,
      status: submission.status,
      attemptNumber: submission.attemptNumber || 1,
      answers: submission.answers || []
    };
  });

  return formattedSubmissions;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = {
  startSubmission,
  updateSubmissionAnswers,
  submitExam,
  getSubmissionById,
  getExamSubmissions,
  getExamLeaderboard,
  getMySubmissions
};


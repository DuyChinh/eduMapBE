const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const Question = require('../models/Question');

/**
 * Grade a submission's answers
 * @param {Object} submission - Submission document
 * @param {Object} exam - Exam document with questions populated
 * @returns {Object} - Graded answers and total score
 */
async function gradeSubmissionAnswers(submission, exam) {
  const questionIds = submission.answers.map(a => a.questionId);
  const questions = await Question.find({ _id: { $in: questionIds } });

  let totalScore = 0;
  const gradedAnswers = submission.answers.map(answer => {
    const question = questions.find(q => q._id.toString() === answer.questionId.toString());
    if (!question) {
      return {
        ...answer.toObject(),
        isCorrect: false,
        points: 0
      };
    }

    // Find exam question to get marks
    const examQuestion = exam.questions.find(
      eq => eq.questionId.toString() === question._id.toString()
    );
    const marks = examQuestion?.marks || 1;

    let isCorrect = false;
    let points = 0;

    // Grade based on question type
    if (question.type === 'mcq' || question.type === 'tf') {
      const correctAnswer = String(question.answer).trim();
      const userAnswer = String(answer.value).trim();
      isCorrect = correctAnswer === userAnswer;
      points = isCorrect ? marks : 0;
    } else if (question.type === 'short') {
      const correctAnswer = String(question.answer).trim().toLowerCase();
      const userAnswer = String(answer.value).trim().toLowerCase();
      isCorrect = correctAnswer === userAnswer;
      points = isCorrect ? marks : 0;
    } else {
      // Essay - not auto-graded
      isCorrect = false;
      points = 0;
    }

    totalScore += points;

    return {
      ...answer.toObject(),
      isCorrect,
      points
    };
  });

  return { gradedAnswers, totalScore };
}

/**
 * Checks if a submission is expired and auto-submits it if necessary
 * @param {Object} submission - The submission object
 * @param {Object} exam - The exam object
 * @returns {Object} - The updated submission (or original if not expired)
 */
async function checkAndAutoSubmit(submission, exam) {
  if (submission.status !== 'in_progress') return submission;

  const now = new Date();
  const timeSpent = Math.floor((now - submission.startedAt) / 1000);
  const durationSeconds = exam.duration * 60;
  const gracePeriodSeconds = (exam.settings?.gracePeriod || 0) * 60;
  const networkLatencyBuffer = 30;

  if (timeSpent > durationSeconds + gracePeriodSeconds + networkLatencyBuffer) {
    // Determine if late - if timeSpent exceeds the official duration, it's late
    // This is for auto-submit when viewing results, so we always mark as late if over duration
    const isLate = timeSpent > durationSeconds;
    let submittedAt = now;
    let actualTimeSpent = timeSpent;

    if (isLate) {
      // If late, set submittedAt to the end of official duration
      submittedAt = new Date(submission.startedAt.getTime() + durationSeconds * 1000);
      actualTimeSpent = durationSeconds;
    }

    // Grade answers
    const { gradedAnswers, totalScore } = await gradeSubmissionAnswers(submission, exam);

    // Update submission
    submission.answers = gradedAnswers;
    submission.score = totalScore;
    submission.maxScore = exam.totalMarks;
    submission.percentage = exam.totalMarks > 0
      ? Math.round((totalScore / exam.totalMarks) * 100)
      : 0;
    submission.submittedAt = submittedAt;
    submission.timeSpent = actualTimeSpent;
    submission.status = isLate ? 'late' : 'graded';
    submission.isLate = isLate;

    await submission.save();

    // Update exam stats
    await Exam.findByIdAndUpdate(exam._id, {
      $inc: { 'stats.totalAttempts': 1 }
    });
    
    return submission;
  }
  
  return submission;
}

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

  // Check late entry grace period (only if >= 0, -1 means no blocking)
  if (exam.startTime && exam.lateEntryGracePeriod !== undefined && exam.lateEntryGracePeriod >= 0) {
    const gracePeriodMs = exam.lateEntryGracePeriod * 60 * 1000; // Convert minutes to milliseconds
    const cutoffTime = new Date(exam.startTime.getTime() + gracePeriodMs);
    
    if (now > cutoffTime) {
      const gracePeriodText = exam.lateEntryGracePeriod === 0 
        ? 'immediately after the start time'
        : `${exam.lateEntryGracePeriod} minute(s) after the start time`;
      throw { 
        status: 403, 
        message: `Late entry not allowed. This exam blocks entry ${gracePeriodText}.` 
      };
    }
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
    // Get exam with questions for checking/returning
    const examWithQuestions = await Exam.findById(examId)
      .populate('questions.questionId')
      .lean();

    // Check and auto-submit if expired
    const updatedSubmission = await checkAndAutoSubmit(inProgressSubmission, examWithQuestions);
    
    // If it was auto-submitted (status changed to graded or late), return it
    // The frontend should handle this status to show results instead of exam interface
    if (updatedSubmission.status === 'graded' || updatedSubmission.status === 'late') {
      return {
        submission: updatedSubmission,
        exam: examWithQuestions,
        questionOrder: updatedSubmission.questionOrder,
        isExpired: true // Flag to tell frontend this was auto-submitted
      };
    }
    
    // Return existing in_progress submission
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
  let timeSpent = Math.floor((now - submission.startedAt) / 1000); 
  const durationSeconds = exam.duration * 60;

  const gracePeriodSeconds = (exam.settings?.gracePeriod || 0) * 60;
  const networkLatencyBuffer = 30; 

  let isLate = false;
  let submittedAt = now;

  if (timeSpent > durationSeconds + gracePeriodSeconds + networkLatencyBuffer) {
    if (!exam.settings?.allowLateSubmission) {
      throw { status: 400, message: 'Time limit exceeded' };
    }
    isLate = true;
    submittedAt = new Date(submission.startedAt.getTime() + durationSeconds * 1000);
    timeSpent = durationSeconds;
  }

  // Grade answers using local grading logic
  const { gradedAnswers, totalScore } = await gradeSubmissionAnswers(submission, exam);

  // Update submission
  submission.answers = gradedAnswers;
  submission.score = totalScore;
  submission.maxScore = exam.totalMarks;
  submission.percentage = exam.totalMarks > 0
    ? Math.round((totalScore / exam.totalMarks) * 100)
    : 0;
  submission.submittedAt = submittedAt;
  submission.timeSpent = timeSpent;
  submission.status = isLate ? 'late' : 'graded';
  submission.isLate = isLate;

  await submission.save();

  // Update exam stats
  await Exam.findByIdAndUpdate(exam._id, {
    $inc: { 'stats.totalAttempts': 1 }
  });

  await submission.save();

  // Create LATE_SUBMISSION notification for teacher
  if (isLate) {
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipient: exam.ownerId,
        sender: user.id || user._id,
        type: 'LATE_SUBMISSION',
        content: 'LATE_SUBMISSION',
        relatedId: submission._id,
        onModel: 'Submission'
      });
    } catch (err) {
      console.error('Error creating late submission notification:', err);
    }
  }

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
    .populate('userId', 'name email profile')
    .sort({ score: -1, submittedAt: 1 }); // Sort by score descending, then by submittedAt ascending

  // Build leaderboard
  const leaderboard = submissions.map((submission, index) => ({
    rank: index + 1,
    userId: submission.userId._id,
    name: submission.userId.name || 'Unknown',
    email: submission.userId.email,
    avatar: submission.userId.profile?.avatar || null,
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
        subject_vi: subject.name || '',
        subject_en: subject.name_en || subject.name || '',
        subject_jp: subject.name_jp || subject.name || '',
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
  getMySubmissions,
  checkAndAutoSubmit
};


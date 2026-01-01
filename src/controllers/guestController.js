const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const submissionService = require('../services/submissionService');

/**
 * Start a guest submission
 * POST /v1/api/guest/submissions/start
 */
async function startGuestSubmission(req, res, next) {
  try {
    const { examId, guestName, password } = req.body;

    // Validate required fields
    if (!examId) {
      return res.status(400).json({ ok: false, message: 'examId is required' });
    }

    if (!guestName || guestName.trim().length === 0) {
      return res.status(400).json({ ok: false, message: 'guestName is required' });
    }

    if (guestName.trim().length > 128) {
      return res.status(400).json({ ok: false, message: 'guestName cannot exceed 128 characters' });
    }

    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid examId format' });
    }

    // Get exam and validate
    const exam = await Exam.findById(examId).populate('questions.questionId');
    if (!exam) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    // Validate exam allows guests (isAllowUser must be 'everyone')
    if (exam.isAllowUser !== 'everyone') {
      return res.status(403).json({ ok: false, message: 'This exam requires login' });
    }

    // Validate exam is published
    if (exam.status !== 'published') {
      return res.status(403).json({ ok: false, message: 'Exam is not available' });
    }

    // Validate exam password if required
    if (exam.examPassword && exam.examPassword.length > 0) {
      if (!password || password !== exam.examPassword) {
        return res.status(401).json({ ok: false, message: 'Invalid exam password' });
      }
    }

    // Validate exam time window
    const now = new Date();
    if (exam.startTime && now < exam.startTime) {
      return res.status(403).json({ ok: false, message: 'Exam has not started yet' });
    }
    if (exam.endTime && now > exam.endTime) {
      return res.status(403).json({ ok: false, message: 'Exam has ended' });
    }

    // Create question order (shuffle if enabled)
    let questionOrder = exam.questions.map(q => q.questionId._id || q.questionId);
    if (exam.settings?.shuffleQuestions) {
      questionOrder = [...questionOrder].sort(() => Math.random() - 0.5);
    }

    // Create guest submission
    const submission = new Submission({
      examId: exam._id,
      guestName: guestName.trim(),
      isGuest: true,
      questionOrder,
      answers: [],
      status: 'in_progress',
      startedAt: now,
      attemptNumber: 1,
      maxScore: exam.totalMarks
    });

    await submission.save();

    // Prepare response with exam data
    const examData = {
      _id: exam._id,
      name: exam.name,
      description: exam.description,
      duration: exam.duration,
      totalMarks: exam.totalMarks,
      startTime: exam.startTime,
      endTime: exam.endTime,
      settings: exam.settings,
      sectionsStartFromQ1: exam.sectionsStartFromQ1,
      hideGroupTitles: exam.hideGroupTitles,
      questions: questionOrder.map(qId => {
        const examQuestion = exam.questions.find(q => 
          (q.questionId._id || q.questionId).toString() === qId.toString()
        );
        const question = examQuestion?.questionId;
        if (!question) return null;
        
        return {
          _id: question._id,
          text: question.text,
          type: question.type,
          choices: question.choices?.map(c => ({
            _id: c._id,
            key: c.key || c._id.toString(), // Include key for radio button values
            text: c.text,
            isCorrect: undefined // Hide correct answer
          })),
          marks: examQuestion.marks
        };
      }).filter(Boolean)
    };

    res.status(201).json({
      ok: true,
      data: {
        submission: {
          _id: submission._id,
          status: submission.status,
          startedAt: submission.startedAt,
          questionOrder: submission.questionOrder
        },
        exam: examData
      }
    });
  } catch (error) {
    console.error('Error starting guest submission:', error);
    next(error);
  }
}

/**
 * Update guest submission answers
 * PATCH /v1/api/guest/submissions/:id/answers
 */
async function updateGuestAnswers(req, res, next) {
  try {
    const { id } = req.params;
    const { answers, guestName } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'Invalid submission ID' });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ ok: false, message: 'answers must be an array' });
    }

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({ ok: false, message: 'Submission not found' });
    }

    // Verify this is a guest submission
    if (!submission.isGuest) {
      return res.status(403).json({ ok: false, message: 'This is not a guest submission' });
    }

    // Verify guest name matches (basic security)
    if (guestName && submission.guestName !== guestName.trim()) {
      return res.status(403).json({ ok: false, message: 'Guest name does not match' });
    }

    // Check if submission is still in progress
    if (submission.status !== 'in_progress') {
      return res.status(400).json({ ok: false, message: 'Submission has already been completed' });
    }

    // Update answers
    for (const answer of answers) {
      const existingAnswerIndex = submission.answers.findIndex(
        a => a.questionId.toString() === answer.questionId
      );
      
      if (existingAnswerIndex >= 0) {
        submission.answers[existingAnswerIndex].value = answer.value;
        submission.answers[existingAnswerIndex].updatedAt = new Date();
      } else {
        submission.answers.push({
          questionId: answer.questionId,
          value: answer.value,
          updatedAt: new Date()
        });
      }
    }

    submission.autoSavedAt = new Date();
    await submission.save();

    res.json({ ok: true, data: submission });
  } catch (error) {
    console.error('Error updating guest answers:', error);
    next(error);
  }
}

/**
 * Submit guest exam
 * POST /v1/api/guest/submissions/:id/submit
 */
async function submitGuestExam(req, res, next) {
  try {
    const { id } = req.params;
    const { guestName } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'Invalid submission ID' });
    }

    const submission = await Submission.findById(id).populate('examId');
    if (!submission) {
      return res.status(404).json({ ok: false, message: 'Submission not found' });
    }

    // Verify this is a guest submission
    if (!submission.isGuest) {
      return res.status(403).json({ ok: false, message: 'This is not a guest submission' });
    }

    // Verify guest name matches
    if (guestName && submission.guestName !== guestName.trim()) {
      return res.status(403).json({ ok: false, message: 'Guest name does not match' });
    }

    // Check if already submitted
    if (submission.status !== 'in_progress') {
      return res.status(400).json({ ok: false, message: 'Submission has already been completed' });
    }

    const exam = submission.examId;

    // Get full question data for grading
    const Question = require('../models/Question');
    const questionIds = exam.questions.map(q => q.questionId);
    const questions = await Question.find({ _id: { $in: questionIds } });

    // Grade the submission
    let totalScore = 0;
    for (const answer of submission.answers) {
      const examQuestion = exam.questions.find(q => 
        q.questionId.toString() === answer.questionId.toString()
      );
      const question = questions.find(q => 
        q._id.toString() === answer.questionId.toString()
      );

      if (!question || !examQuestion) continue;

      let isCorrect = false;
      let points = 0;

      if (question.type === 'mcq') {
        // Correct answer is stored in question.answer (the key of correct choice)
        isCorrect = answer.value === question.answer;
        points = isCorrect ? examQuestion.marks : 0;
      } else if (question.type === 'tf') {
        // For TF questions, answer is stored in question.answer as well
        isCorrect = answer.value === String(question.answer);
        points = isCorrect ? examQuestion.marks : 0;
      }
      // Short answer and essay require manual grading

      answer.isCorrect = isCorrect;
      answer.points = points;
      totalScore += points;
    }


    // Check if late
    const now = new Date();
    const isLate = exam.endTime && now > exam.endTime;

    // Update submission
    submission.score = totalScore;
    submission.percentage = exam.totalMarks > 0 
      ? Math.round((totalScore / exam.totalMarks) * 100) 
      : 0;
    submission.status = isLate ? 'late' : 'submitted';
    submission.submittedAt = now;
    submission.timeSpent = Math.floor((now - submission.startedAt) / 1000);

    await submission.save();

    res.json({
      ok: true,
      data: {
        _id: submission._id,
        score: submission.score,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
        status: submission.status,
        timeSpent: submission.timeSpent,
        submittedAt: submission.submittedAt
      }
    });
  } catch (error) {
    console.error('Error submitting guest exam:', error);
    next(error);
  }
}

/**
 * Get guest submission by ID
 * GET /v1/api/guest/submissions/:id
 */
async function getGuestSubmission(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'Invalid submission ID' });
    }

    const submission = await Submission.findById(id)
      .populate({
        path: 'examId',
        select: 'name description duration totalMarks settings viewMark viewExamAndAnswer sectionsStartFromQ1 hideGroupTitles'
      });

    if (!submission) {
      return res.status(404).json({ ok: false, message: 'Submission not found' });
    }

    // Verify this is a guest submission
    if (!submission.isGuest) {
      return res.status(403).json({ ok: false, message: 'This is not a guest submission' });
    }

    res.json({ ok: true, data: submission });
  } catch (error) {
    console.error('Error getting guest submission:', error);
    next(error);
  }
}

module.exports = {
  startGuestSubmission,
  updateGuestAnswers,
  submitGuestExam,
  getGuestSubmission
};

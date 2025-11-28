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
 * Auto-submit expired in_progress submissions
 * Finds submissions where:
 * - status = 'in_progress'
 * - (now - startedAt) > (exam.duration + gracePeriod + buffer)
 */
async function autoSubmitExpiredExams() {
  try {
    console.log('[Cron] Starting auto-submit job...');
    
    // Find all in_progress submissions
    const inProgressSubmissions = await Submission.find({
      status: 'in_progress'
    }).populate('examId');

    if (!inProgressSubmissions || inProgressSubmissions.length === 0) {
      console.log('[Cron] No in_progress submissions found');
      return { processed: 0, submitted: 0 };
    }

    console.log(`[Cron] Found ${inProgressSubmissions.length} in_progress submissions`);

    const now = new Date();
    let submittedCount = 0;

    for (const submission of inProgressSubmissions) {
      try {
        const exam = submission.examId;
        if (!exam) {
          console.log(`[Cron] Exam not found for submission ${submission._id}`);
          continue;
        }

        // Calculate time spent
        const timeSpent = Math.floor((now - submission.startedAt) / 1000); // seconds
        const durationSeconds = exam.duration * 60;
        const gracePeriodSeconds = (exam.settings?.gracePeriod || 0) * 60;
        const networkLatencyBuffer = 30;

        // Check if expired
        if (timeSpent > durationSeconds + gracePeriodSeconds + networkLatencyBuffer) {
          console.log(`[Cron] Auto-submitting expired submission ${submission._id}`);

          // Determine if late - if timeSpent exceeds the official duration, it's late
          // This is for auto-submit via cron, so we always mark as late if over duration
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

          submittedCount++;
          console.log(`[Cron] Successfully auto-submitted submission ${submission._id}`);
        }
      } catch (error) {
        console.error(`[Cron] Error processing submission ${submission._id}:`, error);
      }
    }

    console.log(`[Cron] Auto-submit job completed. Submitted ${submittedCount}/${inProgressSubmissions.length} submissions`);
    return { processed: inProgressSubmissions.length, submitted: submittedCount };
  } catch (error) {
    console.error('[Cron] Error in auto-submit job:', error);
    return { processed: 0, submitted: 0, error: error.message };
  }
}

/**
 * Note: For Vercel deployment, this function is called via HTTP endpoint
 * See: /v1/api/cron/auto-submit (configured in vercel.json)
 */

module.exports = { 
  autoSubmitExpiredExams,
  gradeSubmissionAnswers 
};

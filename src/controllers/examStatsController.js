const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const ActivityLog = require('../models/ActivityLog');
const ProctorLog = require('../models/ProctorLog');
const User = require('../models/User');

// Helper functions
const isTeacher = (user) => user && user.role === 'teacher';
const isAdmin = (user) => user && user.role === 'admin';
const isTeacherOrAdmin = (user) => isTeacher(user) || isAdmin(user);

/**
 * Get exam statistics
 * GET /v1/api/exams/:examId/statistics
 */
async function getExamStatistics(req, res, next) {
  try {
    const { examId } = req.params;
    const user = req.user;

    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid exam ID format' });
    }

    // Check exam exists and user has permission
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    // Only teacher who owns the exam or admin can view statistics
    const isOwner = String(exam.ownerId) === String(user.id);
    if (!isOwner && !isAdmin(user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Get all submitted submissions for this exam
    const submissions = await Submission.find({
      examId,
      status: { $in: ['submitted', 'graded'] }
    });

    const totalSubmissions = submissions.length;
    
    if (totalSubmissions === 0) {
      return res.json({
        ok: true,
        data: {
          totalSubmissions: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          passRate: 0,
          completionRate: 0
        }
      });
    }

    // Calculate statistics
    const scores = submissions.map(s => s.score);
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const averageScore = totalScore / totalSubmissions;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    
    // Calculate pass rate (assuming 50% is passing)
    const passingScore = exam.totalMarks * 0.5;
    const passedCount = submissions.filter(s => s.score >= passingScore).length;
    const passRate = (passedCount / totalSubmissions) * 100;

    // Get total number of students who started the exam
    const allSubmissions = await Submission.countDocuments({ examId });
    const completionRate = (totalSubmissions / allSubmissions) * 100;

    res.json({
      ok: true,
      data: {
        totalSubmissions,
        averageScore: Math.round(averageScore * 10) / 10,
        highestScore,
        lowestScore,
        passRate: Math.round(passRate * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
        totalMarks: exam.totalMarks
      }
    });
  } catch (error) {
    console.error('Error getting exam statistics:', error);
    next(error);
  }
}

/**
 * Get exam leaderboard
 * GET /v1/api/exams/:examId/leaderboard
 * Each user appears only once with their best submission
 */
async function getExamLeaderboard(req, res, next) {
  try {
    const { examId } = req.params;
    const { limit = 50 } = req.query;

    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid exam ID format' });
    }

    // Check if exam has hideLeaderboard enabled
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    if (exam.hideLeaderboard && !isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Leaderboard is hidden for this exam' });
    }

    // Get all submitted and graded submissions for this exam
    const submissions = await Submission.find({
      examId,
      status: { $in: ['submitted', 'graded'] }
    })
      .populate('userId', 'name email avatar studentCode')
      .sort({ submittedAt: -1 });

    if (submissions.length === 0) {
      return res.json({
        ok: true,
        data: []
      });
    }

    // Group submissions by userId
    const userSubmissionsMap = {};
    submissions.forEach(sub => {
      const userId = String(sub.userId._id);
      if (!userSubmissionsMap[userId]) {
        userSubmissionsMap[userId] = [];
      }
      userSubmissionsMap[userId].push(sub);
    });

    // For each user, select the best submission based on logic:
    // - If scores are equal: choose the one with lower timeSpent (faster)
    // - Otherwise: choose the one with higher score
    const bestSubmissions = [];
    
    Object.values(userSubmissionsMap).forEach(userSubs => {
      let bestSub;
      if (userSubs.length === 1) {
        bestSub = userSubs[0];
      } else {
        // Multiple submissions, apply selection logic
        // Sort by score (descending), then by timeSpent (ascending)
        userSubs.sort((a, b) => {
          if (a.score !== b.score) {
            return b.score - a.score; // Higher score first
          }
          return (a.timeSpent || 0) - (b.timeSpent || 0); // Lower timeSpent first
        });
        bestSub = userSubs[0];
      }
      bestSubmissions.push(bestSub);
    });

    // Sort all best submissions by score (descending), then by timeSpent (ascending)
    bestSubmissions.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score; // Higher score first
      }
      return (a.timeSpent || 0) - (b.timeSpent || 0); // Lower timeSpent first
    });

    // Apply limit and format leaderboard data with ranks
    const limitedSubmissions = bestSubmissions.slice(0, parseInt(limit));
    const leaderboard = limitedSubmissions.map((submission, index) => ({
      rank: index + 1,
      student: {
        _id: submission.userId._id,
        name: submission.userId.name,
        email: submission.userId.email,
        avatar: submission.userId.avatar,
        studentCode: submission.userId.studentCode
      },
      score: submission.score,
      totalMarks: submission.maxScore,
      percentage: submission.percentage,
      timeSpent: submission.timeSpent,
      submittedAt: submission.submittedAt
    }));

    res.json({
      ok: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Error getting exam leaderboard:', error);
    next(error);
  }
}

/**
 * Get all submissions for an exam
 * GET /v1/api/exams/:examId/submissions
 */
async function getExamSubmissions(req, res, next) {
  try {
    const { examId } = req.params;
    const user = req.user;

    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid exam ID format' });
    }

    // Check exam exists and user has permission
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    // Only teacher who owns the exam or admin can view submissions
    const isOwner = String(exam.ownerId) === String(user.id);
    if (!isOwner && !isAdmin(user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Get all submissions for this exam
    const submissions = await Submission.find({ examId })
      .populate('userId', 'name email avatar studentCode')
      .sort({ submittedAt: -1 });

    // Check for expired in_progress submissions and auto-submit them
    const submissionService = require('../services/submissionService');
    const inProgressSubmissions = submissions.filter(s => s.status === 'in_progress');
    
    if (inProgressSubmissions.length > 0) {
      // Process in parallel
      await Promise.all(inProgressSubmissions.map(async (sub) => {
        try {
          await submissionService.checkAndAutoSubmit(sub, exam);
        } catch (err) {
          console.error(`Error auto-submitting submission ${sub._id}:`, err);
        }
      }));
      
      // Re-fetch submissions to get updated statuses
      // Optimization: We could just update the objects in memory, but re-fetching ensures consistency
      const updatedSubmissions = await Submission.find({ examId })
        .populate('userId', 'name email avatar studentCode')
        .sort({ submittedAt: -1 });
        
      // Replace submissions array with updated one
      submissions.length = 0;
      submissions.push(...updatedSubmissions);
    }

    const formattedSubmissions = submissions.map(submission => ({
      _id: submission._id,
      student: {
        _id: submission.userId._id,
        name: submission.userId.name,
        email: submission.userId.email,
        avatar: submission.userId.avatar,
        studentCode: submission.userId.studentCode
      },
      status: submission.status,
      score: submission.score,
      totalMarks: submission.maxScore,
      percentage: submission.percentage,
      timeSpent: submission.timeSpent,
      startedAt: submission.startedAt,
      submittedAt: submission.submittedAt,
      attemptNumber: submission.attemptNumber
    }));

    res.json({
      ok: true,
      data: formattedSubmissions
    });
  } catch (error) {
    console.error('Error getting exam submissions:', error);
    next(error);
  }
}

/**
 * Get student submission detail
 * GET /v1/api/exams/:examId/submissions/:studentId
 */
async function getStudentSubmissionDetail(req, res, next) {
  try {
    const { examId, studentId } = req.params;
    const user = req.user;

    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ ok: false, message: 'Invalid ID format' });
    }

    // Check exam exists and user has permission
    const exam = await Exam.findById(examId).populate('questions.questionId');
    if (!exam) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    // Only teacher who owns the exam, admin, or the student themselves can view
    const isOwner = String(exam.ownerId) === String(user.id);
    const isOwnSubmission = String(studentId) === String(user.id);
    if (!isOwner && !isAdmin(user) && !isOwnSubmission) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Get the submission
    const submission = await Submission.findOne({
      examId,
      userId: studentId,
      status: { $in: ['submitted', 'graded'] }
    })
      .populate('userId', 'name email avatar studentCode')
      .populate('answers.questionId');

    if (!submission) {
      return res.status(404).json({ ok: false, message: 'Submission not found' });
    }

    // Get activity logs
    const activityLogs = await ActivityLog.find({
      submissionId: submission._id
    }).sort({ timestamp: 1 });

    // Get suspicious activities summary
    const suspiciousActivities = activityLogs.filter(log => log.isSuspicious);
    const suspiciousActivitySummary = suspiciousActivities.reduce((acc, log) => {
      if (!acc[log.type]) {
        acc[log.type] = { type: log.type, count: 0 };
      }
      acc[log.type].count++;
      return acc;
    }, {});

    // Format answers with question details
    const formattedAnswers = submission.answers.map(answer => {
      const question = exam.questions.find(q => 
        String(q.questionId._id) === String(answer.questionId)
      );
      
      return {
        question: {
          _id: answer.questionId,
          name: question?.questionId?.name,
          text: question?.questionId?.text,
          type: question?.questionId?.type,
          choices: question?.questionId?.choices,
          correctAnswer: question?.questionId?.correctAnswer,
          explanation: question?.questionId?.explanation
        },
        selectedAnswer: answer.value,
        isCorrect: answer.isCorrect,
        earnedMarks: answer.points,
        marks: question?.marks || 1
      };
    });

    res.json({
      ok: true,
      data: {
        _id: submission._id,
        exam: {
          _id: exam._id,
          name: exam.name,
          description: exam.description,
          totalMarks: exam.totalMarks
        },
        student: {
          _id: submission.userId._id,
          name: submission.userId.name,
          email: submission.userId.email,
          avatar: submission.userId.avatar,
          studentCode: submission.userId.studentCode
        },
        score: submission.score,
        totalMarks: submission.maxScore,
        percentage: submission.percentage,
        timeSpent: submission.timeSpent,
        startedAt: submission.startedAt,
        submittedAt: submission.submittedAt,
        answers: formattedAnswers,
        suspiciousActivities: Object.values(suspiciousActivitySummary)
      }
    });
  } catch (error) {
    console.error('Error getting student submission detail:', error);
    next(error);
  }
}

/**
 * Get student activity log
 * GET /v1/api/exams/:examId/submissions/:studentId/activity
 */
async function getSubmissionActivityLog(req, res, next) {
  try {
    const { examId, studentId } = req.params;
    const user = req.user;

    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ ok: false, message: 'Invalid ID format' });
    }

    // Check exam exists and user has permission
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    // Only teacher who owns the exam, admin, or the student themselves can view
    const isOwner = String(exam.ownerId) === String(user.id);
    const isOwnSubmission = String(studentId) === String(user.id);
    if (!isOwner && !isAdmin(user) && !isOwnSubmission) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Get the submission (can be in_progress, submitted, or graded)
    // Get the most recent submission for this exam and student
    const submission = await Submission.findOne({
      examId,
      userId: studentId
    })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!submission) {
      return res.status(404).json({ ok: false, message: 'Submission not found' });
    }

    // Get activity logs from proctorlogs collection
    // ProctorLog model maps to 'proctorlogs' collection
    const activityLogs = await ProctorLog.find({
      submissionId: submission._id
    })
      .sort({ ts: 1 }) // Sort by ts (timestamp) field
      .lean(); // Use lean() for better performance

    // Format activity logs for response (ProctorLog uses event, meta, ts instead of type, details, timestamp)
    const formattedLogs = activityLogs.map(log => ({
      _id: log._id,
      submissionId: log.submissionId,
      examId: examId, // Add examId from params
      userId: log.userId,
      event: log.event, // ProctorLog uses 'event' field
      type: log.event, // Map event to type for compatibility
      action: log.event, // Use event as action
      severity: log.severity,
      isSuspicious: log.severity === 'high' || log.severity === 'critical', // Determine suspicious based on severity
      meta: {
        ...log.meta,
        visible: log.meta?.visible,
        reason: log.meta?.reason,
        userAgent: log.meta?.userAgent,
        url: log.meta?.url,
        ip: log.meta?.ip,
        coordinates: log.meta?.coordinates,
        ts: log.ts
      },
      timestamp: log.ts, // Map ts to timestamp
      createdAt: log.createdAt,
      updatedAt: log.updatedAt
    }));

    res.json({
      ok: true,
      data: formattedLogs,
      count: formattedLogs.length
    });
  } catch (error) {
    console.error('Error getting activity log:', error);
    next(error);
  }
}

/**
 * Get overall exam results for a student
 * GET /v1/api/exam-results
 */
async function getOverallExamResults(req, res, next) {
  try {
    const user = req.user;
    const { subject, startDate, endDate, status } = req.query;

    // Build query
    const query = { userId: user.id };
    
    if (status) {
      query.status = status;
    }

    // Get submissions
    let submissions = await Submission.find(query)
      .populate('examId', 'name subject startTime endTime')
      .populate('userId', 'name email studentCode')
      .sort({ submittedAt: -1 });

    // Filter by date range if provided
    if (startDate || endDate) {
      submissions = submissions.filter(sub => {
        if (!sub.submittedAt) return false;
        const subDate = new Date(sub.submittedAt);
        if (startDate && subDate < new Date(startDate)) return false;
        if (endDate && subDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Filter by subject if provided
    if (subject) {
      submissions = submissions.filter(sub => sub.examId?.subject === subject);
    }

    // Calculate overall stats
    const totalExams = submissions.length;
    const totalScore = submissions.reduce((sum, sub) => sum + sub.score, 0);
    const totalMaxScore = submissions.reduce((sum, sub) => sum + sub.maxScore, 0);
    const averageScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    const totalTimeSpent = submissions.reduce((sum, sub) => sum + (sub.timeSpent || 0), 0);
    
    // Calculate pass rate (50% threshold)
    const passedCount = submissions.filter(sub => 
      sub.maxScore > 0 && (sub.score / sub.maxScore) >= 0.5
    ).length;
    const passRate = totalExams > 0 ? (passedCount / totalExams) * 100 : 0;

    // Format exam history
    const examHistory = submissions.map(sub => ({
      _id: sub._id,
      examId: sub.examId?._id,
      exam: {
        name: sub.examId?.name,
        subject: sub.examId?.subject
      },
      score: sub.score,
      totalMarks: sub.maxScore,
      percentage: sub.percentage,
      timeSpent: sub.timeSpent,
      status: sub.status,
      startedAt: sub.startedAt,
      submittedAt: sub.submittedAt
    }));

    res.json({
      ok: true,
      data: {
        examHistory,
        overallStats: {
          totalExams,
          averageScore: Math.round(averageScore * 10) / 10,
          totalTimeSpent,
          passRate: Math.round(passRate * 10) / 10
        }
      }
    });
  } catch (error) {
    console.error('Error getting overall exam results:', error);
    next(error);
  }
}

/**
 * Get subject average scores
 * GET /v1/api/exam-results/subject-averages
 */
async function getSubjectAverageScores(req, res, next) {
  try {
    const user = req.user;

    // Get all submitted submissions for the user
    const submissions = await Submission.find({
      userId: user.id,
      status: { $in: ['submitted', 'graded'] }
    }).populate('examId', 'name subjectCode totalMarks');

    // Group by subject
    const subjectMap = {};
    
    submissions.forEach(sub => {
      if (!sub.examId) return;
      
      const subject = sub.examId.subjectCode || 'Unknown';
      if (!subjectMap[subject]) {
        subjectMap[subject] = {
          subject,
          totalScore: 0,
          totalMaxScore: 0,
          examCount: 0,
          highestScore: 0,
          scores: []
        };
      }
      
      subjectMap[subject].totalScore += sub.score;
      subjectMap[subject].totalMaxScore += sub.maxScore;
      subjectMap[subject].examCount++;
      subjectMap[subject].scores.push(sub.score);
      subjectMap[subject].highestScore = Math.max(
        subjectMap[subject].highestScore,
        sub.score
      );
    });

    // Calculate averages
    const subjectAverages = Object.values(subjectMap).map(data => ({
      subject: data.subject,
      examCount: data.examCount,
      averageScore: data.totalMaxScore > 0 
        ? Math.round((data.totalScore / data.totalMaxScore) * data.totalMaxScore / data.examCount * 10) / 10
        : 0,
      totalMarks: data.totalMaxScore / data.examCount,
      highestScore: data.highestScore
    }));

    res.json({
      ok: true,
      data: subjectAverages
    });
  } catch (error) {
    console.error('Error getting subject averages:', error);
    next(error);
  }
}

/**
 * Get score distribution for chart (by score ranges)
 * GET /v1/api/exams/:examId/score-distribution
 * Returns statistics grouped into 10 score ranges
 */
async function getScoreDistribution(req, res, next) {
  try {
    const { examId } = req.params;
    const user = req.user;

    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid exam ID format' });
    }

    // Check exam exists and user has permission
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    // Only teacher who owns the exam or admin can view statistics
    const isOwner = String(exam.ownerId) === String(user.id);
    if (!isOwner && !isAdmin(user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Get all submitted and graded submissions for this exam
    const submissions = await Submission.find({
      examId,
      status: { $in: ['submitted', 'graded'] }
    })
      .populate('userId', 'name email studentCode')
      .sort({ submittedAt: -1 });

    if (submissions.length === 0) {
      // Return empty distribution with 10 ranges
      const totalMarks = exam.totalMarks || 100;
      const rangeSize = Math.round(totalMarks / 10);
      const ranges = [];
      for (let i = 0; i < 10; i++) {
        const min = i * rangeSize;
        const max = i === 9 ? totalMarks : (i + 1) * rangeSize;
        let rangeLabel;
        if (i === 0) {
          rangeLabel = `< ${max}`;
        } else if (i === 9) {
          rangeLabel = `>= ${min}`;
        } else {
          rangeLabel = `${min} - ${max - 1}`;
        }
        ranges.push({
          range: rangeLabel,
          min,
          max: i === 9 ? totalMarks : max,
          count: 0
        });
      }
      return res.json({
        ok: true,
        data: ranges
      });
    }

    // Group submissions by userId
    const userSubmissionsMap = {};
    submissions.forEach(sub => {
      const userId = String(sub.userId._id);
      if (!userSubmissionsMap[userId]) {
        userSubmissionsMap[userId] = [];
      }
      userSubmissionsMap[userId].push(sub);
    });

    // For each user, select the best submission based on logic:
    // - If scores are equal: choose the one with lower timeSpent (faster)
    // - Otherwise: choose the one with higher score
    const userScores = [];
    
    Object.values(userSubmissionsMap).forEach(userSubs => {
      let bestSub;
      if (userSubs.length === 1) {
        bestSub = userSubs[0];
      } else {
        // Multiple submissions, apply selection logic
        // Sort by score (descending), then by timeSpent (ascending)
        userSubs.sort((a, b) => {
          if (a.score !== b.score) {
            return b.score - a.score; // Higher score first
          }
          return (a.timeSpent || 0) - (b.timeSpent || 0); // Lower timeSpent first
        });
        bestSub = userSubs[0];
      }
      userScores.push(bestSub.score);
    });

    // Calculate score ranges (always 10 ranges)
    const totalMarks = exam.totalMarks || 100;
    const rangeSize = Math.round(totalMarks / 10);
    
    // Initialize 10 ranges
    const ranges = [];
    for (let i = 0; i < 10; i++) {
      const min = i * rangeSize;
      const max = i === 9 ? totalMarks : (i + 1) * rangeSize;
      let rangeLabel;
      if (i === 0) {
        rangeLabel = `< ${max}`;
      } else if (i === 9) {
        rangeLabel = `>= ${min}`;
      } else {
        rangeLabel = `${min} - ${max - 1}`;
      }
      ranges.push({
        range: rangeLabel,
        min,
        max: i === 9 ? totalMarks : max,
        count: 0
      });
    }

    // Count scores in each range
    userScores.forEach(score => {
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        if (i === 0) {
          // First range: < max
          if (score < range.max) {
            range.count++;
            break;
          }
        } else if (i === 9) {
          // Last range: >= min
          if (score >= range.min) {
            range.count++;
            break;
          }
        } else {
          // Other ranges: >= min and < max
          if (score >= range.min && score < range.max) {
            range.count++;
            break;
          }
        }
      }
    });

    res.json({
      ok: true,
      data: ranges
    });
  } catch (error) {
    console.error('Error getting score distribution:', error);
    next(error);
  }
}

/**
 * Reset student attempt (allow retake)
 * DELETE /v1/api/exams/:examId/submissions/:studentId/reset
 */
async function resetStudentAttempt(req, res, next) {
  try {
    const { examId, studentId } = req.params;
    const user = req.user;

    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ ok: false, message: 'Invalid ID format' });
    }

    // Check exam exists and user has permission
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    // Only teacher who owns the exam or admin can reset attempts
    const isOwner = String(exam.ownerId) === String(user.id);
    if (!isOwner && !isAdmin(user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Find the latest submitted/graded submission (highest attemptNumber)
    // This will reduce the attempt count by 1, allowing the student to retake once
    const latestSubmission = await Submission.findOne({
      examId,
      userId: studentId,
      status: { $in: ['submitted', 'graded', 'late'] }
    })
      .sort({ attemptNumber: -1, submittedAt: -1 })
      .exec();

    if (!latestSubmission) {
      return res.status(404).json({ 
        ok: false, 
        message: 'No submitted submission found for this student. Cannot reset attempt.' 
      });
    }

    const submissionId = latestSubmission._id.toString();
    const attemptNumber = latestSubmission.attemptNumber;

    // Delete the latest submission
    await Submission.findByIdAndDelete(latestSubmission._id);

    // Also delete related activity logs and proctor logs for this submission
    await ActivityLog.deleteMany({
      submissionId: submissionId
    });
    
    await ProctorLog.deleteMany({
      submissionId: submissionId
    });

    res.json({
      ok: true,
      message: `Student attempt #${attemptNumber} deleted successfully. Student can now retake the exam (attempt count reduced by 1).`,
      data: {
        deletedAttemptNumber: attemptNumber,
        deletedSubmissionId: submissionId
      }
    });
  } catch (error) {
    console.error('Error resetting student attempt:', error);
    next(error);
  }
}

module.exports = {
  getExamStatistics,
  getExamLeaderboard,
  getExamSubmissions,
  getStudentSubmissionDetail,
  getSubmissionActivityLog,
  getOverallExamResults,
  getSubjectAverageScores,
  getScoreDistribution,
  resetStudentAttempt
};


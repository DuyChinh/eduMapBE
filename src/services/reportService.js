const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Class = require('../models/Class');

/**
 * Gets class report statistics
 * @param {Object} params - Parameters
 * @param {string} params.classId - Class ID
 * @param {string} params.examId - Exam ID (optional)
 * @param {Object} params.user - User object
 * @returns {Object} - Report statistics
 */
async function getClassReport({ classId, examId, user }) {
  if (user.role !== 'teacher' && user.role !== 'admin') {
    throw { status: 403, message: 'Forbidden' };
  }

  // Verify class exists
  const classData = await Class.findById(classId);
  if (!classData) {
    throw { status: 404, message: 'Class not found' };
  }

  // Check if user owns the class (unless admin)
  if (user.role !== 'admin' && classData.teacherId?.toString() !== user.id) {
    throw { status: 403, message: 'Forbidden' };
  }

  // Build filter
  const filter = {};
  if (examId) {
    filter.examId = examId;
  }

  // Get all submissions for students in this class
  const classStudentIds = classData.studentIds || [];
  filter.userId = { $in: classStudentIds };
  filter.status = { $in: ['submitted', 'graded', 'late'] };

  const submissions = await Submission.find(filter)
    .populate('userId', 'name email')
    .populate('examId', 'name totalMarks')
    .lean();

  if (submissions.length === 0) {
    return {
      classId,
      examId: examId || null,
      totalStudents: classStudentIds.length,
      totalSubmissions: 0,
      statistics: {
        averageScore: 0,
        minScore: 0,
        maxScore: 0,
        passRate: 0
      },
      scoreDistribution: [],
      questionAnalysis: []
    };
  }

  // Calculate statistics
  const scores = submissions.map(s => s.score || 0);
  const maxScores = submissions.map(s => s.maxScore || 100);
  const percentages = submissions.map(s => s.percentage || 0);

  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const averagePercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;

  // Pass rate (assuming 50% is passing)
  const passingScore = 50;
  const passedCount = percentages.filter(p => p >= passingScore).length;
  const passRate = (passedCount / submissions.length) * 100;

  // Score distribution (0-20, 21-40, 41-60, 61-80, 81-100)
  const distribution = {
    '0-20': 0,
    '21-40': 0,
    '41-60': 0,
    '61-80': 0,
    '81-100': 0
  };

  percentages.forEach(p => {
    if (p <= 20) distribution['0-20']++;
    else if (p <= 40) distribution['21-40']++;
    else if (p <= 60) distribution['41-60']++;
    else if (p <= 80) distribution['61-80']++;
    else distribution['81-100']++;
  });

  const scoreDistribution = Object.entries(distribution).map(([range, count]) => ({
    range,
    count,
    percentage: (count / submissions.length) * 100
  }));

  // Question analysis (if examId is provided)
  let questionAnalysis = [];
  if (examId) {
    const exam = await Exam.findById(examId).populate('questions.questionId').lean();
    if (exam && exam.questions) {
      const questionIds = exam.questions.map(q => q.questionId._id.toString());
      const questions = await Question.find({ _id: { $in: questionIds } }).lean();

      questionAnalysis = exam.questions.map(eq => {
        const question = questions.find(q => q._id.toString() === eq.questionId._id.toString());
        if (!question) return null;

        let correctCount = 0;
        let totalAttempts = 0;

        submissions.forEach(sub => {
          const answer = sub.answers?.find(a => 
            a.questionId?.toString() === question._id.toString()
          );
          if (answer) {
            totalAttempts++;
            if (answer.isCorrect) {
              correctCount++;
            }
          }
        });

        return {
          questionId: question._id,
          questionText: question.text || question.name,
          questionType: question.type,
          correctCount,
          totalAttempts,
          incorrectCount: totalAttempts - correctCount,
          accuracyRate: totalAttempts > 0 ? (correctCount / totalAttempts) * 100 : 0,
          marks: eq.marks || 1
        };
      }).filter(q => q !== null);

      // Sort by incorrect count (most incorrect first)
      questionAnalysis.sort((a, b) => b.incorrectCount - a.incorrectCount);
    }
  }

  return {
    classId,
    examId: examId || null,
    totalStudents: classStudentIds.length,
    totalSubmissions: submissions.length,
    statistics: {
      averageScore: Math.round(averageScore * 100) / 100,
      minScore,
      maxScore,
      averagePercentage: Math.round(averagePercentage * 100) / 100,
      passRate: Math.round(passRate * 100) / 100
    },
    scoreDistribution,
    questionAnalysis: questionAnalysis.slice(0, 10), // Top 10 most incorrect questions
    submissions: submissions.map(s => ({
      userId: s.userId,
      examId: s.examId,
      score: s.score,
      maxScore: s.maxScore,
      percentage: s.percentage,
      submittedAt: s.submittedAt,
      status: s.status
    }))
  };
}

/**
 * Exports class report as CSV
 * @param {Object} params - Parameters
 * @param {string} params.classId - Class ID
 * @param {string} params.examId - Exam ID (optional)
 * @param {Object} params.user - User object
 * @returns {string} - CSV content
 */
async function exportClassReportCSV({ classId, examId, user }) {
  const report = await getClassReport({ classId, examId, user });

  // Build CSV
  let csv = 'Student Name,Email,Score,Max Score,Percentage,Status,Submitted At\n';

  if (report.submissions && report.submissions.length > 0) {
    report.submissions.forEach(sub => {
      const name = sub.userId?.name || 'N/A';
      const email = sub.userId?.email || 'N/A';
      const score = sub.score || 0;
      const maxScore = sub.maxScore || 100;
      const percentage = sub.percentage || 0;
      const status = sub.status || 'N/A';
      const submittedAt = sub.submittedAt 
        ? new Date(sub.submittedAt).toISOString() 
        : 'N/A';

      csv += `"${name}","${email}",${score},${maxScore},${percentage},"${status}","${submittedAt}"\n`;
    });
  }

  return csv;
}

module.exports = {
  getClassReport,
  exportClassReportCSV
};


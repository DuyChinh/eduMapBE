const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Class = require('../models/Class');
const Question = require('../models/Question');
const User = require('../models/User');

/**
 * Get teacher dashboard statistics
 * @param {string} teacherId - Teacher ID
 * @returns {Object} - Dashboard statistics
 */
async function getTeacherDashboardStats(teacherId) {
  // Get counts
  const [
    totalQuestions,
    totalExams,
    totalClasses,
    totalStudents
  ] = await Promise.all([
    Question.countDocuments({ ownerId: teacherId }),
    Exam.countDocuments({ ownerId: teacherId }),
    Class.countDocuments({ teacherId }),
    Class.aggregate([
      { $match: { teacherId: new mongoose.Types.ObjectId(teacherId) } },
      { $unwind: '$studentIds' },
      { $group: { _id: '$studentIds' } },
      { $count: 'total' }
    ])
  ]);

  const uniqueStudents = totalStudents[0]?.total || 0;

  // Get exam statistics
  const exams = await Exam.find({ ownerId: teacherId }).select('_id totalMarks status');
  const examIds = exams.map(e => e._id);

  // Get submission statistics
  const submissions = await Submission.find({
    examId: { $in: examIds },
    status: { $in: ['submitted', 'graded', 'late'] }
  }).select('score maxScore examId submittedAt');

  // Calculate exam stats
  const publishedExams = exams.filter(e => e.status === 'published').length;
  const draftExams = exams.filter(e => e.status === 'draft').length;

  // Calculate submission stats
  const totalSubmissions = submissions.length;
  let averageScore = 0;
  let averagePercentage = 0;
  if (submissions.length > 0) {
    const totalScore = submissions.reduce((sum, s) => sum + (s.score || 0), 0);
    const totalMaxScore = submissions.reduce((sum, s) => sum + (s.maxScore || 100), 0);
    averageScore = totalScore / submissions.length;
    averagePercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
  }

  // Get recent exams (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentExams = await Exam.countDocuments({
    ownerId: teacherId,
    createdAt: { $gte: sevenDaysAgo }
  });

  // Get recent submissions (last 7 days)
  const recentSubmissions = await Submission.countDocuments({
    examId: { $in: examIds },
    status: { $in: ['submitted', 'graded', 'late'] },
    submittedAt: { $gte: sevenDaysAgo }
  });

  // Get exam distribution by status
  const examStatusDistribution = {
    published: publishedExams,
    draft: draftExams
  };

  // Get submissions over time (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const submissionsOverTime = await Submission.aggregate([
    {
      $match: {
        examId: { $in: examIds },
        status: { $in: ['submitted', 'graded', 'late'] },
        submittedAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Get score distribution
  const scoreRanges = [
    { range: '0-20', min: 0, max: 20 },
    { range: '21-40', min: 21, max: 40 },
    { range: '41-60', min: 41, max: 60 },
    { range: '61-80', min: 61, max: 80 },
    { range: '81-100', min: 81, max: 100 }
  ];

  const scoreDistribution = scoreRanges.map(range => {
    const count = submissions.filter(s => {
      const percentage = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
      return percentage >= range.min && percentage <= range.max;
    }).length;
    return { range: range.range, count };
  });

  // Get top performing exams
  const examPerformance = await Submission.aggregate([
    {
      $match: {
        examId: { $in: examIds },
        status: { $in: ['submitted', 'graded', 'late'] }
      }
    },
    {
      $group: {
        _id: '$examId',
        avgScore: { $avg: '$score' },
        avgPercentage: {
          $avg: {
            $cond: [
              { $gt: ['$maxScore', 0] },
              { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] },
              0
            ]
          }
        },
        totalSubmissions: { $sum: 1 }
      }
    },
    { $sort: { avgPercentage: -1 } },
    { $limit: 5 }
  ]);

  // Populate exam names
  const examPerformanceWithNames = await Promise.all(
    examPerformance.map(async (item) => {
      const exam = await Exam.findById(item._id).select('name');
      return {
        examId: item._id,
        examName: exam?.name || 'Unknown',
        avgScore: Math.round(item.avgScore * 100) / 100,
        avgPercentage: Math.round(item.avgPercentage * 100) / 100,
        totalSubmissions: item.totalSubmissions
      };
    })
  );

  return {
    overview: {
      totalQuestions,
      totalExams,
      totalClasses,
      totalStudents: uniqueStudents,
      publishedExams,
      draftExams,
      totalSubmissions,
      averageScore: Math.round(averageScore * 100) / 100,
      averagePercentage: Math.round(averagePercentage * 100) / 100,
      recentExams,
      recentSubmissions
    },
    charts: {
      examStatusDistribution,
      submissionsOverTime: submissionsOverTime.map(item => ({
        date: item._id,
        count: item.count
      })),
      scoreDistribution,
      topExams: examPerformanceWithNames
    }
  };
}

/**
 * Get student dashboard statistics
 * @param {string} studentId - Student ID
 * @returns {Object} - Dashboard statistics
 */
async function getStudentDashboardStats(studentId) {
  // Get classes the student is enrolled in
  const classes = await Class.find({ studentIds: studentId }).select('_id name');
  const classIds = classes.map(c => c._id);
  const totalClasses = classes.length;

  // Get all exams available to student (only from enrolled classes)
  const exams = await Exam.find({
    allowedClassIds: { $in: classIds },
    status: 'published'
  }).select('_id name startTime endTime totalMarks status');

  const examIds = exams.map(e => e._id);
  const totalExams = exams.length;

  // Get submissions
  const submissions = await Submission.find({
    userId: studentId,
    examId: { $in: examIds }
  }).select('examId score maxScore status submittedAt');

  // Calculate statistics
  const completedExams = submissions.filter(s => 
    ['submitted', 'graded', 'late'].includes(s.status)
  ).length;

  // Get upcoming exams (not yet started or in progress)
  const now = new Date();
  const upcomingExams = exams.filter(e => {
    if (e.status !== 'published') return false;
    const hasSubmission = submissions.some(s => 
      String(s.examId) === String(e._id) && 
      ['submitted', 'graded', 'late'].includes(s.status)
    );
    return !hasSubmission && (!e.endTime || new Date(e.endTime) > now);
  }).length;

  // Calculate average score
  const completedSubmissions = submissions.filter(s => 
    ['submitted', 'graded', 'late'].includes(s.status)
  );
  
  let averageScore = 0;
  let averagePercentage = 0;
  if (completedSubmissions.length > 0) {
    const totalScore = completedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
    const totalMaxScore = completedSubmissions.reduce((sum, s) => sum + (s.maxScore || 100), 0);
    averageScore = totalScore / completedSubmissions.length;
    averagePercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
  }

  // Get pass rate (assuming 50% is passing)
  const passedCount = completedSubmissions.filter(s => {
    const percentage = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
    return percentage >= 50;
  }).length;
  const passRate = completedSubmissions.length > 0 
    ? (passedCount / completedSubmissions.length) * 100 
    : 0;

  // Get recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSubmissions = await Submission.countDocuments({
    userId: studentId,
    status: { $in: ['submitted', 'graded', 'late'] },
    submittedAt: { $gte: sevenDaysAgo }
  });

  // Get score distribution
  const scoreRanges = [
    { range: '0-20', min: 0, max: 20 },
    { range: '21-40', min: 21, max: 40 },
    { range: '41-60', min: 41, max: 60 },
    { range: '61-80', min: 61, max: 80 },
    { range: '81-100', min: 81, max: 100 }
  ];

  const scoreDistribution = scoreRanges.map(range => {
    const count = completedSubmissions.filter(s => {
      const percentage = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
      return percentage >= range.min && percentage <= range.max;
    }).length;
    return { range: range.range, count };
  });

  // Get performance over time (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const performanceOverTime = await Submission.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(studentId),
        status: { $in: ['submitted', 'graded', 'late'] },
        submittedAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' }
        },
        avgPercentage: {
          $avg: {
            $cond: [
              { $gt: ['$maxScore', 0] },
              { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] },
              0
            ]
          }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Get recent exam results
  const recentResults = await Submission.find({
    userId: studentId,
    status: { $in: ['submitted', 'graded', 'late'] }
  })
    .populate('examId', 'name totalMarks')
    .sort({ submittedAt: -1 })
    .limit(5)
    .select('examId score maxScore percentage submittedAt');

  // Get upcoming exams details
  const upcomingExamsDetails = exams
    .filter(e => {
      if (e.status !== 'published') return false;
      const hasSubmission = submissions.some(s => 
        String(s.examId) === String(e._id) && 
        ['submitted', 'graded', 'late'].includes(s.status)
      );
      return !hasSubmission && (!e.endTime || new Date(e.endTime) > now);
    })
    .sort((a, b) => {
      const aTime = a.startTime || a.endTime || new Date(0);
      const bTime = b.startTime || b.endTime || new Date(0);
      return aTime - bTime;
    })
    .slice(0, 5)
    .map(e => ({
      examId: e._id,
      examName: e.name,
      startTime: e.startTime,
      endTime: e.endTime,
      totalMarks: e.totalMarks
    }));

  return {
    overview: {
      totalClasses,
      totalExams,
      completedExams,
      upcomingExams,
      averageScore: Math.round(averageScore * 100) / 100,
      averagePercentage: Math.round(averagePercentage * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      recentSubmissions
    },
    charts: {
      scoreDistribution,
      performanceOverTime: performanceOverTime.map(item => ({
        date: item._id,
        avgPercentage: Math.round(item.avgPercentage * 100) / 100,
        count: item.count
      }))
    },
    recentResults: recentResults.map(r => ({
      examId: r.examId?._id,
      examName: r.examId?.name || 'Unknown',
      score: r.score,
      maxScore: r.maxScore || r.examId?.totalMarks || 100,
      percentage: r.percentage || (r.maxScore > 0 ? (r.score / r.maxScore) * 100 : 0),
      submittedAt: r.submittedAt
    })),
    upcomingExams: upcomingExamsDetails
  };
}

module.exports = {
  getTeacherDashboardStats,
  getStudentDashboardStats
};


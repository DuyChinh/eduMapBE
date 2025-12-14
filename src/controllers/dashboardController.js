const dashboardService = require('../services/dashboardService');

/**
 * Get teacher dashboard statistics
 * GET /v1/api/dashboard/teacher
 */
async function getTeacherDashboard(req, res, next) {
  try {
    const userId = req.user.id || req.user._id;
    
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: 'Forbidden - Teacher access only'
      });
    }

    const stats = await dashboardService.getTeacherDashboardStats(userId);
    
    res.json({
      ok: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting teacher dashboard:', error);
    next(error);
  }
}

/**
 * Get student dashboard statistics
 * GET /v1/api/dashboard/student
 */
async function getStudentDashboard(req, res, next) {
  try {
    const userId = req.user.id || req.user._id;
    
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'student' && req.user.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: 'Forbidden - Student access only'
      });
    }

    const stats = await dashboardService.getStudentDashboardStats(userId);
    
    res.json({
      ok: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting student dashboard:', error);
    next(error);
  }
}

module.exports = {
  getTeacherDashboard,
  getStudentDashboard
};


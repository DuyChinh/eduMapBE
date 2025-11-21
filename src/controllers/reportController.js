const mongoose = require('mongoose');
const reportService = require('../services/reportService');

/**
 * Gets class report
 * GET /v1/api/reports/class/:classId
 */
async function getClassReport(req, res, next) {
  try {
    const { classId } = req.params;
    const { examId } = req.query;
    const user = req.user;

    if (!mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ ok: false, message: 'Invalid classId format' });
    }

    if (examId && !mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid examId format' });
    }

    const report = await reportService.getClassReport({
      classId,
      examId,
      user
    });

    res.json({ ok: true, data: report });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ ok: false, message: error.message });
    }
    next(error);
  }
}

/**
 * Exports class report as CSV
 * GET /v1/api/reports/class/:classId/export
 */
async function exportClassReport(req, res, next) {
  try {
    const { classId } = req.params;
    const { examId } = req.query;
    const user = req.user;

    if (!mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ ok: false, message: 'Invalid classId format' });
    }

    if (examId && !mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ ok: false, message: 'Invalid examId format' });
    }

    const csv = await reportService.exportClassReportCSV({
      classId,
      examId,
      user
    });

    const filename = examId 
      ? `class-${classId}-exam-${examId}-report.csv`
      : `class-${classId}-report.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ ok: false, message: error.message });
    }
    next(error);
  }
}

module.exports = {
  getClassReport,
  exportClassReport
};


const mongoose = require('mongoose');
const service = require('../services/examService');

const isTeacher = (u) => u && u.role === 'teacher';
const isAdmin = (u) => u && u.role === 'admin';
const isStudent = (u) => u && u.role === 'student';
const isTeacherOrAdmin = (u) => isTeacher(u) || isAdmin(u);

function assertTeacherOrAdmin(user) {
  return user && (user.role === 'teacher' || user.role === 'admin');
}

// POST /v1/api/exams
async function createExam(req, res, next) {
  try {
    if (!assertTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const { name, description, duration, totalMarks, questions, settings } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, message: 'name is required' });
    }

    if (!duration || typeof duration !== 'number' || duration <= 0) {
      return res.status(400).json({ ok: false, message: 'duration must be a positive number' });
    }

    if (!totalMarks || typeof totalMarks !== 'number' || totalMarks <= 0) {
      return res.status(400).json({ ok: false, message: 'totalMarks must be a positive number' });
    }

    const payload = {
      name,
      description,
      duration,
      totalMarks,
      questions: questions || [],
      settings: settings || {}
    };

    const doc = await service.createExam({ payload, user: req.user });
    res.status(201).json({ ok: true, data: doc });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ ok: false, message: e.message });
    }
    next(e);
  }
}

// GET /v1/api/exams
async function getAllExams(req, res, next) {
  try {
    const { page, limit, sort, status, q, ownerId } = req.query;

    // Teacher chỉ xem exam của mình, admin xem tất cả
    const filterOwnerId = isTeacher(req.user) && !ownerId ? req.user.id : ownerId;

    const data = await service.getAllExams({
      ownerId: filterOwnerId,
      page,
      limit,
      sort,
      status,
      q
    });

    res.json({ ok: true, ...data });
  } catch (e) {
    next(e);
  }
}

// GET /v1/api/exams/:id
async function getExamById(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'invalid id' });
    }

    const doc = await service.getExamById({ id });
    
    if (!doc) {
      return res.status(404).json({ ok: false, message: 'Exam not found' });
    }

    // Check permissions
    const isOwner = String(doc.ownerId) === String(req.user.id);
    if (!(isOwner || isAdmin(req.user))) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    res.json({ ok: true, data: doc });
  } catch (e) {
    next(e);
  }
}

// PATCH /v1/api/exams/:id
async function updateExam(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'invalid id' });
    }

    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const updated = await service.updateExamPartial({
      id,
      payload: req.body,
      ownerIdEnforce
    });

    if (!updated) {
      return res.status(403).json({ ok: false, message: 'Forbidden or not found' });
    }

    res.json({ ok: true, data: updated });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ ok: false, message: e.message });
    }
    next(e);
  }
}

// DELETE /v1/api/exams/:id
async function deleteExam(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'invalid id' });
    }

    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const deleted = await service.deleteExam({ id, ownerIdEnforce });
    
    if (!deleted) {
      return res.status(403).json({ ok: false, message: 'Forbidden or not found' });
    }

    res.json({ ok: true, message: 'Exam deleted', data: deleted });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ ok: false, message: e.message });
    }
    next(e);
  }
}

// POST /v1/api/exams/:id/questions
async function addQuestions(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const examId = req.params.id;
    const { questionIds, subjectId } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'questionIds array is required' });
    }

    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const updatedExam = await service.addQuestionsToExam({
      examId,
      questionIds,
      subjectId, // Add subjectId validation
      ownerIdEnforce
    });

    res.json({ ok: true, data: updatedExam });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ ok: false, message: e.message });
    }
    next(e);
  }
}

// DELETE /v1/api/exams/:id/questions/:questionId
async function removeQuestion(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const examId = req.params.id;
    const questionId = req.params.questionId;

    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(questionId)) {
      return res.status(400).json({ ok: false, message: 'invalid id' });
    }

    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const updatedExam = await service.removeQuestionFromExam({
      examId,
      questionId,
      ownerIdEnforce
    });

    res.json({ ok: true, data: updatedExam });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ ok: false, message: e.message });
    }
    next(e);
  }
}

module.exports = {
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
  addQuestions,
  removeQuestion
};

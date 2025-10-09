const mongoose = require('mongoose');
const service = require('../services/classService');

// nên tạo getOrgIdSoft ở chỗ khác, import nó.
//Viết inline:
const getOrgIdSoft = (req) =>
  req.user?.orgId || req.user?.org?.id || req.body?.orgId || req.query?.orgId || null;

function assertTeacherOrAdmin(user) {
  return user && (user.role === 'teacher' || user.role === 'admin');
}

/**
 * POST /v1/api/classes
 * Body: { name, settings?, metadata?, studentIds? }
 * - Teacher tạo lớp cho chính mình
 * - Admin có thể tạo thay: truyền teacherId trong body (optional)
 */
async function create(req, res, next) {
  try {
    if (!assertTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // const orgId = getOrgIdSoft(req);
    // if (!orgId || !mongoose.isValidObjectId(orgId)) {
    //   return res.status(400).json({ ok: false, message: 'orgId missing/invalid' });
    // }

    let orgId = getOrgIdSoft(req);
    if (orgId && !mongoose.isValidObjectId(orgId)) {
        return res.status(400).json({ ok: false, message: 'orgId invalid' });
    }

    const { name, settings, metadata, studentIds, teacherId: teacherIdRaw } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, message: 'name is required' });
    }

    // Admin có thể tạo thay; teacher tự tạo thì dùng user.id
    const teacherId = (req.user.role === 'admin' && teacherIdRaw) ? teacherIdRaw : req.user.id;

    const doc = await service.create({
      orgId,
      teacherId,
      payload: { name, settings, metadata, studentIds }
    });

    return res.status(201).json({ ok: true, data: doc });
  } catch (e) {
    // Duplicate key (orgId+code unique)
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, message: 'class code already exists' });
    }
    if (e?.status) {
      return res.status(e.status).json({ ok: false, message: e.message });
    }
    next(e);
  }
}

module.exports = { create };

const mongoose = require('mongoose');
const service = require('../services/classService');
const User = require('../models/User');
const Notification = require('../models/Notification');

const getOrgIdSoft = (req) =>
  req.user?.orgId || req.user?.org?.id || req.body?.orgId || req.query?.orgId || null;

const isTeacher = (u) => u && u.role === 'teacher';
const isAdmin = (u) => u && u.role === 'admin';
const isStudent = (u) => u && u.role === 'student';
const isTeacherOrAdmin = (u) => isTeacher(u) || isAdmin(u);

function assertTeacherOrAdmin(user) {
  return user && (user.role === 'teacher' || user.role === 'admin');
}

// POST /v1/api/classes
// Body: { name, academicYear? }
// Teacher tạo cho mình; Admin có thể truyền teacherId để tạo thay
async function create(req, res, next) {
  try {
    if (!assertTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    let orgId = getOrgIdSoft(req);
    if (orgId && !mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ ok: false, message: 'orgId invalid' });
    }

    const { name, academicYear, teacherId: teacherIdRaw } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, message: 'name is required' });
    }

    // Giáo viên tạo cho chính mình; admin có thể tạo cho teacher khác
    const teacherId = (req.user.role === 'admin' && teacherIdRaw) ? teacherIdRaw : req.user.id;

    // Kiểm tra tên class trùng lặp của giáo viên này
    const existingClass = await service.findByNameAndTeacher({
      name: name.trim(),
      teacherId,
      orgId
    });

    if (existingClass) {
      return res.status(409).json({
        ok: false,
        message: 'Class name already exists for this teacher',
        data: {
          existingClass: {
            _id: existingClass._id,
            name: existingClass.name,
            createdAt: existingClass.createdAt
          }
        }
      });
    }

    // Chỉ lưu metadata.academicYear (nếu có). Giữ settings và studentIds mặc định rỗng.
    const payload = {
      name: name.trim(),
      metadata: (academicYear && typeof academicYear === 'string') ? { academicYear } : {}
    };

    const doc = await service.create({
      orgId,
      teacherId,
      payload
    });

    return res.status(201).json({ ok: true, data: doc });
  } catch (e) {
    // Duplicate key (orgId+code unique)
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, message: 'class name already exists' });
    }
    if (e?.status) {
      return res.status(e.status).json({ ok: false, message: e.message });
    }
    next(e);
  }
}

// ============== LIST =================
async function list(req, res, next) {
  try {
    const orgId = getOrgIdSoft(req);
    const { q, page, limit, sort, teacherId, teacherEmail } = req.query;

    // Admin: xem tất cả; Teacher: mặc định xem lớp của mình nếu không truyền teacherId;
    // Student: nên dùng "mine" (dưới) để xem lớp đã tham gia.
    const teacherFilter = isTeacher(req.user) && !teacherId && !teacherEmail ? req.user.id : teacherId;

    const data = await service.list({
      orgId,
      teacherId: teacherFilter,
      teacherEmail,
      q,
      page,
      limit,
      sort,
    });

    res.json({ ok: true, ...data });
  } catch (e) { next(e); }
}

// ============== GET ONE =================
async function getOne(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'invalid id' });
    }
    const doc = await service.getById(id);
    if (!doc) return res.status(404).json({ ok: false, message: 'Class not found' });

    // Quyền xem: teacher owner, admin, hoặc student đã tham gia
    // Quyền xem: teacher owner, admin, hoặc student đã tham gia
    // Quyền xem: teacher owner, admin, hoặc student đã tham gia
    const teacherId = doc.teacherId && (doc.teacherId._id || doc.teacherId.id || doc.teacherId);
    const isOwner = String(teacherId) === String(req.user.id);
    const isJoined = doc.studentIds.some(sid => {
      // Handle both populated (object) and unpopulated (ObjectId/string) cases
      if (sid && (sid._id || sid.id)) {
        return String(sid._id || sid.id) === String(req.user.id);
      }
      return String(sid) === String(req.user.id);
    });

    if (!(isOwner || isAdmin(req.user) || isJoined)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Format response với joinedAt cho mỗi student
    const classData = doc.toObject ? doc.toObject() : doc;

    // Tạo map từ studentJoins để dễ lookup
    const joinMap = new Map();
    if (classData.studentJoins && Array.isArray(classData.studentJoins)) {
      classData.studentJoins.forEach(join => {
        let studentId = null;
        if (join.studentId) {
          if (typeof join.studentId === 'object' && join.studentId._id) {
            studentId = String(join.studentId._id);
          } else if (typeof join.studentId === 'object' && join.studentId.id) {
            studentId = String(join.studentId.id);
          } else if (typeof join.studentId === 'object') {
            studentId = String(join.studentId);
          } else {
            studentId = String(join.studentId);
          }
        }
        if (studentId && studentId !== 'undefined' && studentId !== 'null') {
          joinMap.set(studentId, join.joinedAt);
        }
      });
    }

    // Format students từ studentIds với joinedAt
    const students = [];
    if (classData.studentIds && Array.isArray(classData.studentIds)) {
      classData.studentIds.forEach(student => {
        let studentId = null;
        let studentData = null;

        if (typeof student === 'object' && student._id) {
          // Populated student object
          studentId = String(student._id);
          studentData = student;
        } else if (typeof student === 'object' && student.id) {
          studentId = String(student.id);
          studentData = student;
        } else if (typeof student === 'object') {
          studentId = String(student);
          studentData = null;
        } else {
          // Just ObjectId string
          studentId = String(student);
          studentData = null;
        }

        if (studentData) {
          students.push({
            ...studentData,
            joinedAt: joinMap.get(studentId) || null
          });
        }
      });
    }

    // Thêm students vào response
    classData.students = students;

    res.json({ ok: true, data: classData });
  } catch (e) { next(e); }
}

// ============== MINE =================
// Teacher: lớp mình dạy; Student: lớp mình tham gia
async function mine(req, res, next) {
  try {
    const orgId = getOrgIdSoft(req);
    if (isTeacher(req.user)) {
      const data = await service.list({ orgId, teacherId: req.user.id, page: req.query.page, limit: req.query.limit });
      return res.json({ ok: true, ...data });
    }
    if (isStudent(req.user)) {
      // Student dùng pipeline đơn giản
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const filter = {
        studentIds: new mongoose.Types.ObjectId(req.user.id),
      };
      if (orgId && mongoose.isValidObjectId(orgId)) filter.orgId = new mongoose.Types.ObjectId(orgId);

      const ClassModel = require('../models/Class');
      const [items, total] = await Promise.all([
        ClassModel.find(filter).sort('-createdAt').skip(skip).limit(limit),
        ClassModel.countDocuments(filter),
      ]);

      // Add joinedAt for current student from studentJoins array
      const userIdStr = String(req.user.id);
      const itemsWithJoinedAt = items.map(item => {
        const classData = item.toObject ? item.toObject() : item;
        // Find joinedAt from studentJoins array
        if (classData.studentJoins && Array.isArray(classData.studentJoins)) {
          const joinInfo = classData.studentJoins.find(join => {
            const studentId = join.studentId;
            if (!studentId) return false;
            const joinStudentId = typeof studentId === 'object'
              ? String(studentId._id || studentId.id || studentId)
              : String(studentId);
            return joinStudentId === userIdStr;
          });
          if (joinInfo && joinInfo.joinedAt) {
            classData.joinedAt = joinInfo.joinedAt;
          }
        }
        return classData;
      });

      return res.json({ ok: true, items: itemsWithJoinedAt, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
    }
    // Admin: xem tất cả
    const data = await service.list({ orgId, page: req.query.page, limit: req.query.limit });
    res.json({ ok: true, ...data });
  } catch (e) { next(e); }
}

// ============== UPDATE (PATCH) =================
async function patch(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'invalid id' });
    }

    // Admin có thể sửa, Teacher chỉ sửa lớp của mình
    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;
    const orgId = getOrgIdSoft(req);

    const updated = await service.updatePartial({
      id,
      ownerIdEnforce,
      payload: req.body,
      orgId
    });
    if (!updated) return res.status(403).json({ ok: false, message: 'Forbidden or not found' });

    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
}

// ============== DELETE =================
async function remove(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'invalid id' });
    }

    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;
    const orgId = getOrgIdSoft(req);

    const deleted = await service.hardDelete({ id, ownerIdEnforce, orgId });
    if (!deleted) return res.status(403).json({ ok: false, message: 'Forbidden or not found' });

    res.json({ ok: true, message: 'Class deleted', data: deleted });
  } catch (e) { next(e); }
}

// ============== REGENERATE CODE =================
async function regenerateCode(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'invalid id' });
    }
    const orgId = getOrgIdSoft(req);
    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const cls = await service.regenerateCode({ id, ownerIdEnforce, orgId });
    res.json({ ok: true, data: cls });
  } catch (e) {
    if (e?.status) return res.status(e.status).json({ ok: false, message: e.message });
    next(e);
  }
}

// ============== JOIN BY CODE (STUDENT) =================
async function join(req, res, next) {
  try {
    if (!isStudent(req.user)) {
      return res.status(403).json({ ok: false, message: 'Only student can join by code' });
    }
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ ok: false, message: 'code is required' });
    }
    const orgId = getOrgIdSoft(req); // nếu có multi-tenant

    const cls = await service.joinByCode({ code, userId: req.user.id, orgId });
    res.json({ ok: true, data: cls });
  } catch (e) {
    if (e?.status) return res.status(e.status).json({ ok: false, message: e.message });
    next(e);
  }
}

// POST /v1/api/classes/:id/students/bulk
async function addStudents(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    const id = req.params.id;
    const { studentIds, studentEmails } = req.body;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'invalid class id' });
    }
    if ((!Array.isArray(studentIds) || studentIds.length === 0) &&
      (!Array.isArray(studentEmails) || studentEmails.length === 0)) {
      return res.status(400).json({ ok: false, message: 'studentIds or studentEmails must be provided' });
    }

    const orgId = getOrgIdSoft(req);
    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const ids = Array.isArray(studentIds) ? studentIds.map(String) : [];
    const emails = Array.isArray(studentEmails) ? studentEmails.map(e => (e || '').trim().toLowerCase()).filter(Boolean) : [];

    const { updatedClass, report } = await service.addStudentsToClass({
      id,
      studentIds: ids,
      studentEmails: emails,
      ownerIdEnforce,
      orgId
    });

    // Notify added students
    if (report && report.added && report.added.length > 0) {
      try {
        const notifications = report.added.map(studentId => ({
          recipient: studentId,
          sender: req.user.id || req.user.userId,
          classId: id,
          type: 'CLASS_ADDITION',
          content: 'NOTIFICATION_CLASS_ADDITION',
          relatedId: id,
          onModel: 'Class'
        }));
        await Notification.insertMany(notifications);
      } catch (err) {
        console.error('Error creating class addition notifications:', err);
      }
    }

    return res.json({ ok: true, data: updatedClass, report });
  } catch (e) {
    if (e?.status) return res.status(e.status).json({ ok: false, message: e.message });
    next(e);
  }
}

// DELETE /v1/api/classes/:id/students
async function removeStudents(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    const id = req.params.id;
    const { studentIds, studentEmails } = req.body;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'invalid class id' });
    }
    if ((!Array.isArray(studentIds) || studentIds.length === 0) &&
      (!Array.isArray(studentEmails) || studentEmails.length === 0)) {
      return res.status(400).json({ ok: false, message: 'studentIds or studentEmails must be provided' });
    }

    const orgId = getOrgIdSoft(req);
    const ownerIdEnforce = isAdmin(req.user) ? undefined : req.user.id;

    const ids = Array.isArray(studentIds) ? studentIds.map(String) : [];
    const emails = Array.isArray(studentEmails) ? studentEmails.map(e => (e || '').trim().toLowerCase()).filter(Boolean) : [];

    const { updatedClass, report } = await service.removeStudentsFromClass({
      id,
      studentIds: ids,
      studentEmails: emails,
      ownerIdEnforce,
      orgId
    });

    // Notify removed students
    if (report && report.removed && report.removed.length > 0) {
      try {
        const notifications = report.removed.map(studentId => ({
          recipient: studentId,
          sender: req.user.id || req.user.userId,
          classId: id,
          type: 'CLASS_REMOVAL',
          content: 'NOTIFICATION_CLASS_REMOVAL',
          relatedId: id,
          onModel: 'Class'
        }));
        await Notification.insertMany(notifications);
      } catch (err) {
        console.error('Error creating class removal notifications:', err);
      }
    }

    return res.json({ ok: true, data: updatedClass, report });
  } catch (e) {
    if (e?.status) return res.status(e.status).json({ ok: false, message: e.message });
    next(e);
  }
}

// ============== SEARCH CLASSES =================
async function search(req, res, next) {
  try {
    const orgId = getOrgIdSoft(req);
    const { q, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        ok: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const data = await service.search({
      orgId,
      query: q.trim(),
      page: Number(page),
      limit: Number(limit),
      sort
    });

    res.json({ ok: true, ...data });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  create,
  list,
  getOne,
  addStudents,
  removeStudents,
  mine,
  patch,
  remove,
  regenerateCode,
  join,
  search,
};

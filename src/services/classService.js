const ClassModel = require('../models/Class');
const mongoose = require('mongoose');
const User = require('../models/User');


/** Sinh code: A-Z + 2-9 */
function randomCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

/** Tạo code duy nhất trong phạm vi 1 org */
async function generateUniqueCode(orgId, tries = 10, len = 6) {
  for (let i = 0; i < tries; i++) {
    const code = randomCode(len);
    // Khi có orgId: check theo orgId+code; khi không có: check theo code
    const exists = orgId
      ? await ClassModel.exists({ orgId, code })
      : await ClassModel.exists({ code });
    if (!exists) return code;
  }
  const err = new Error('Cannot generate unique class code');
  err.status = 409;
  throw err;
}

async function create({ orgId, teacherId, payload }) {
  const code = await generateUniqueCode(orgId);

  // Chỉ chèn metadata nếu có (ví dụ academicYear)
  const metadata = (payload && payload.metadata) ? payload.metadata : {};

  const doc = await ClassModel.create({
    ...(orgId ? { orgId } : {}),
    teacherId,
    name: payload.name,
    code, // auto-generated
    studentIds: payload.studentIds || [],
    settings: payload.settings || {},
    metadata
  });
  return doc;
}


// LIST + FILTER
function buildFilter({ orgId, teacherId, q }) {
  const f = {};
  if (orgId && mongoose.isValidObjectId(orgId)) f.orgId = new mongoose.Types.ObjectId(orgId);
  if (teacherId && mongoose.isValidObjectId(teacherId)) f.teacherId = new mongoose.Types.ObjectId(teacherId);
  if (q && q.trim()) f.name = { $regex: q.trim(), $options: 'i' };
  return f;
}

async function list({ orgId, teacherId, teacherEmail, q, page = 1, limit = 10, sort = '-createdAt' }) {
  // If teacherEmail provided, try to find the teacher user and use its id.
  if (teacherEmail && typeof teacherEmail === 'string') {
    const email = teacherEmail.trim().toLowerCase();
    if (email) {
      const teacherUser = await User.findOne({ email }).select('_id role');
      if (!teacherUser) {
        // No such teacher — return empty pagination result
        return {
          items: [],
          total: 0,
          page: Number(page) || 1,
          limit: Number(limit) || 10,
          pages: 1,
        };
      }
      // optionally ensure role is teacher (if you want strictness)
      // if (teacherUser.role !== 'teacher') { ...handle as not found... }
      teacherId = String(teacherUser._id);
    }
  }

  const filter = buildFilter({ orgId, teacherId, q });
  const nPage = Number(page) || 1;
  const nLimit = Number(limit) || 20;
  const skip = (nPage - 1) * nLimit;

  const [items, total] = await Promise.all([
    ClassModel.find(filter).sort(sort).skip(skip).limit(nLimit),
    ClassModel.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: nPage,
    limit: nLimit,
    pages: Math.max(1, Math.ceil(total / nLimit)),
  };
}


async function getById(id) {
  return ClassModel.findById(id);
}

async function updatePartial({ id, ownerIdEnforce, payload, orgId }) {
  // chỉ cho owner (teacher) hoặc admin (controller sẽ thêm quyền) — ở service vẫn khoá owner
  const filter = { _id: id };
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    filter.teacherId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }
  if (orgId && mongoose.isValidObjectId(orgId)) {
    filter.orgId = new mongoose.Types.ObjectId(orgId);
  }

  const allowed = ['name', 'settings', 'metadata'];
  const $set = {};
  for (const k of allowed) if (k in payload) $set[k] = payload[k];

  return ClassModel.findOneAndUpdate(filter, { $set }, { new: true });
}

async function hardDelete({ id, ownerIdEnforce, orgId }) {
  const filter = { _id: id };
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    filter.teacherId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }
  if (orgId && mongoose.isValidObjectId(orgId)) {
    filter.orgId = new mongoose.Types.ObjectId(orgId);
  }
  return ClassModel.findOneAndDelete(filter);
}

// JOIN by code (student)
async function findByCode({ code, orgId }) {
  const filter = { code: String(code).toUpperCase() };
  if (orgId && mongoose.isValidObjectId(orgId)) filter.orgId = new mongoose.Types.ObjectId(orgId);
  return ClassModel.findOne(filter);
}

async function joinByCode({ code, userId, orgId }) {
  const cls = await findByCode({ code, orgId });
  if (!cls) {
    const err = new Error('Class not found by code');
    err.status = 404;
    throw err;
  }
  // thêm student nếu chưa có
  const uid = new mongoose.Types.ObjectId(userId);
  const has = cls.studentIds.some(sid => String(sid) === String(uid));
  if (!has) {
    cls.studentIds.push(uid);
    await cls.save();
  }
  return cls;
}

async function joinClassByTeacher({ teacherEmail, classId, userId, orgId }) {
  // Tìm teacher theo email
  const User = require('../models/User');
  const teacher = await User.findOne({ 
    email: teacherEmail.toLowerCase().trim(),
    role: 'teacher',
    ...(orgId ? { orgId: new mongoose.Types.ObjectId(orgId) } : {})
  });
  
  if (!teacher) {
    const err = new Error('Teacher not found with this email');
    err.status = 404;
    throw err;
  }
  
  // Tìm class cụ thể
  const ClassModel = require('../models/Class');
  const filter = { 
    _id: new mongoose.Types.ObjectId(classId),
    teacherId: teacher._id 
  };
  if (orgId && mongoose.isValidObjectId(orgId)) {
    filter.orgId = new mongoose.Types.ObjectId(orgId);
  }
  
  const cls = await ClassModel.findOne(filter).populate('teacherId', 'name email');
  if (!cls) {
    const err = new Error('Class not found or does not belong to this teacher');
    err.status = 404;
    throw err;
  }
  
  // Thêm student vào class
  const uid = new mongoose.Types.ObjectId(userId);
  const has = cls.studentIds.some(sid => String(sid) === String(uid));
  if (!has) {
    cls.studentIds.push(uid);
    await cls.save();
  }
  
  return cls;
}

// REGENERATE CODE (owner/admin)
async function regenerateCode({ id, ownerIdEnforce, orgId }) {
  const cls = await ClassModel.findById(id);
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }
  if (ownerIdEnforce && String(cls.teacherId) !== String(ownerIdEnforce)) {
    const err = new Error('Only owner can regenerate code');
    err.status = 403;
    throw err;
  }
  const newCode = await generateUniqueCode(orgId || cls.orgId);
  cls.code = newCode;
  await cls.save();
  return cls;
}

/**
 * Add multiple students to a class.
 * Accepts either studentIds: [] (strings) or studentEmails: [] (strings of email)
 * Returns object: { updatedClass, report: { added, already, invalidIds, invalidEmails, notFoundIds, notFoundEmails, notStudents } }
 */
async function addStudentsToClass({ id, studentIds = [], studentEmails = [], ownerIdEnforce, orgId }) {
  // Normalize provided inputs
  const idsInput = Array.isArray(studentIds) ? Array.from(new Set(studentIds.map(s => String(s)))) : [];
  const emailsInput = Array.isArray(studentEmails) ? Array.from(new Set(studentEmails.map(e => String(e).toLowerCase().trim()))) : [];

  if (idsInput.length === 0 && emailsInput.length === 0) {
    const err = new Error('studentIds or studentEmails must be provided');
    err.status = 400;
    throw err;
  }

  // Validate ids
  const invalidIds = idsInput.filter(s => !mongoose.isValidObjectId(s));
  const validIdObjs = idsInput.filter(s => mongoose.isValidObjectId(s)).map(s => new mongoose.Types.ObjectId(s));

  // Resolve emails -> users
  const resolvedFromEmails = [];
  const notFoundEmails = [];
  const invalidEmails = []; // (optional: e.g. empty / malformed) we already trimmed and lowercased; treat empty as invalid
  for (const em of emailsInput) {
    if (!em) { invalidEmails.push(em); continue; }
    // We'll batch-query below; keep list
  }

  // Batch query users for both id list and email list
  const queryUsers = [];
  if (validIdObjs.length > 0) queryUsers.push({ _id: { $in: validIdObjs } });
  if (emailsInput.length > 0) queryUsers.push({ email: { $in: emailsInput } });

  // Build final user list query
  const userQuery = queryUsers.length > 0 ? { $or: queryUsers } : null;
  let users = [];
  if (userQuery) {
    users = await User.find(userQuery).select('_id email role orgId').lean();
  }

  // Map users
  const foundById = new Set(users.map(u => String(u._id)));
  const foundByEmailMap = new Map(users.map(u => [String(u.email).toLowerCase(), u]));

  // Determine notFoundIds (those valid ids not in DB)
  const notFoundIds = validIdObjs.map(s => String(s)).filter(s => !foundById.has(s));

  // For emails, determine which were found
  const foundEmailIds = [];
  for (const em of emailsInput) {
    const u = foundByEmailMap.get(String(em));
    if (!u) {
      notFoundEmails.push(em);
    } else {
      foundEmailIds.push(String(u._id));
      resolvedFromEmails.push(u);
    }
  }

  // Merge all candidate student ids (from validIdObjs and resolvedFromEmails)
  const candidateIds = Array.from(new Set([
    ...validIdObjs.map(x => String(x)),
    ...foundEmailIds
  ])).map(s => new mongoose.Types.ObjectId(s));

  // If no candidate student ids to process, return report early
  if (candidateIds.length === 0) {
    return {
      updatedClass: null,
      report: {
        added: [],
        already: [],
        invalidIds,
        notFoundIds,
        invalidEmails,
        notFoundEmails,
        notStudents: []
      }
    };
  }

  // Verify roles (must be students) and org (optional)
  const usersForIds = await User.find({ _id: { $in: candidateIds } }).select('_id role orgId email').lean();
  const notStudents = usersForIds.filter(u => u.role !== 'student').map(u => String(u._id));
  // If using org check: ensure user's orgId === class orgId (if orgId provided)
  if (orgId && mongoose.isValidObjectId(orgId)) {
    const cls = await ClassModel.findById(id).select('orgId studentIds').lean();
    if (!cls) {
      const err = new Error('Class not found or forbidden');
      err.status = 403;
      throw err;
    }
    const clsOrgId = cls.orgId ? String(cls.orgId) : null;
    // Filter usersForIds by org match
    const wrongOrg = usersForIds.filter(u => String(u.orgId || '') !== String(clsOrgId)).map(u => String(u._id));
    if (wrongOrg.length > 0) {
      notStudents.push(...wrongOrg);
    }
    // existing student ids from class for computing "already"
    var existingStudentIds = (cls.studentIds || []).map(s => String(s));
  } else {
    // fetch class to know existing studentIds
    const cls = await ClassModel.findById(id).select('studentIds').lean();
    if (!cls) {
      const err = new Error('Class not found or forbidden');
      err.status = 403;
      throw err;
    }
    var existingStudentIds = (cls.studentIds || []).map(s => String(s));
  }

  // Now compute toAdd vs already
  const validStudentIds = usersForIds.filter(u => u.role === 'student' && !notStudents.includes(String(u._id))).map(u => String(u._id));
  const already = existingStudentIds.filter(e => validStudentIds.includes(e));
  const toAdd = validStudentIds.filter(idStr => !existingStudentIds.includes(idStr)).map(s => new mongoose.Types.ObjectId(s));

  // Perform DB update with $addToSet $each
  let updated = null;
  if (toAdd.length > 0) {
    const filter = { _id: id };
    if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) filter.teacherId = new mongoose.Types.ObjectId(ownerIdEnforce);
    if (orgId && mongoose.isValidObjectId(orgId)) filter.orgId = new mongoose.Types.ObjectId(orgId);

    updated = await ClassModel.findOneAndUpdate(
      filter,
      { $addToSet: { studentIds: { $each: toAdd } } },
      { new: true }
    );
    if (!updated) {
      const err = new Error('Class not found or forbidden');
      err.status = 403;
      throw err;
    }
  } else {
    // no change, read current class doc
    updated = await ClassModel.findById(id);
  }

  return {
    updatedClass: updated,
    report: {
      added: toAdd.map(x => String(x)),
      already,
      invalidIds,
      notFoundIds,
      invalidEmails,
      notFoundEmails,
      notStudents
    }
  };
}

// SEARCH CLASSES
async function search({ orgId, query, teacherEmail, page = 1, limit = 20, sort = '-createdAt', userRole }) {
  const filter = {};
  
  // Organization filter
  if (orgId && mongoose.isValidObjectId(orgId)) {
    filter.orgId = new mongoose.Types.ObjectId(orgId);
  }
  
  // Search by teacher email
  if (teacherEmail) {
    const User = require('../models/User');
    const teacher = await User.findOne({ 
      email: teacherEmail,
      role: 'teacher',
      ...(orgId ? { orgId: toOID(orgId) } : {})
    });
    
    if (teacher) {
      filter.teacherId = teacher._id;
    } else {
      // Teacher not found, return empty result
      return {
        items: [],
        total: 0,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        pages: 0
      };
    }
  }
  
  // Search by class name (if query provided)
  if (query) {
    filter.name = { $regex: query, $options: 'i' };
  }
  
  const nPage = Number(page) || 1;
  const nLimit = Number(limit) || 20;
  const skip = (nPage - 1) * nLimit;

  const [items, total] = await Promise.all([
    ClassModel.find(filter)
      .populate('teacherId', 'name email')
      .sort('-createdAt') // Sort by newest first
      .skip(skip)
      .limit(nLimit),
    ClassModel.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: nPage,
    limit: nLimit,
    pages: Math.max(1, Math.ceil(total / nLimit))
  };
}

module.exports = {
  create,
  list,
  getById,
  updatePartial,
  hardDelete,
  joinByCode,
  joinClassByTeacher,
  regenerateCode,
  addStudentsToClass,
  search,
};
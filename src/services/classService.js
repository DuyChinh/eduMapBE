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
  const doc = await ClassModel.create({
    ...(orgId ? { orgId } : {}),
    teacherId,
    name: payload.name,
    code, // auto-generated
    studentIds: payload.studentIds || [],
    settings: payload.settings || {},
    metadata: payload.metadata || {}
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

async function list({ orgId, teacherId, q, page = 1, limit = 20, sort = '-createdAt' }) {
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
 * Returns object: { updatedClass, report: { added: [...], already: [...], invalid: [...], notStudents: [...] } }
 */
async function addStudentsToClass({ id, studentIds = [], ownerIdEnforce, orgId }) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    const err = new Error('studentIds must be a non-empty array');
    err.status = 400;
    throw err;
  }

  // Normalize & validate ids
  const uniqueIds = Array.from(new Set(studentIds.map(s => String(s))));
  const invalid = uniqueIds.filter(s => !mongoose.isValidObjectId(s));
  const validIds = uniqueIds.filter(s => mongoose.isValidObjectId(s)).map(s => new mongoose.Types.ObjectId(s));

  // If all invalid -> error
  if (validIds.length === 0) {
    const err = new Error('No valid studentIds provided');
    err.status = 400;
    throw err;
  }

  // Fetch users to ensure they exist + are students
  const users = await User.find({ _id: { $in: validIds } }).select('_id role');
  const foundIds = users.map(u => String(u._id));
  const notFound = validIds.map(v => String(v)).filter(id => !foundIds.includes(id));
  const notStudents = users.filter(u => u.role !== 'student').map(u => String(u._id));
  const studentValidIds = users.filter(u => u.role === 'student').map(u => new mongoose.Types.ObjectId(String(u._id)));

  if (studentValidIds.length === 0) {
    // nothing to add
    return {
      updatedClass: null,
      report: { added: [], already: [], invalid, notFound, notStudents }
    };
  }

  // Build filter for class (owner enforcement + org)
  const filter = { _id: id };
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    filter.teacherId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }
  if (orgId && mongoose.isValidObjectId(orgId)) {
    filter.orgId = new mongoose.Types.ObjectId(orgId);
  }

  // Get current class to compute 'already' vs 'toAdd'
  const cls = await ClassModel.findOne(filter);
  if (!cls) {
    const err = new Error('Class not found or forbidden');
    err.status = 403;
    throw err;
  }

  const existing = cls.studentIds.map(s => String(s));
  const toAdd = studentValidIds.filter(sid => !existing.includes(String(sid)));

  // Update using $addToSet with $each
  let updated = cls;
  if (toAdd.length > 0) {
    updated = await ClassModel.findOneAndUpdate(
      { _id: id, ...(filter.teacherId ? { teacherId: filter.teacherId } : {}) },
      { $addToSet: { studentIds: { $each: toAdd } } },
      { new: true }
    );
  }

  return {
    updatedClass: updated,
    report: {
      added: toAdd.map(x => String(x)),
      already: existing.filter(e => studentValidIds.map(s=>String(s)).includes(e)),
      invalid,
      notFound,
      notStudents
    }
  };
}

module.exports = {
  create,
  list,
  getById,
  updatePartial,
  hardDelete,
  joinByCode,
  regenerateCode,
  addStudentsToClass,
};
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Subject  = require('../models/Subject');

const toOID = (v) =>
  (v && mongoose.isValidObjectId(v)) ? new mongoose.Types.ObjectId(v) : undefined;

const escapeRegExp = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// q: search rộng (text / choices.text / tags)
// name: filter theo "tên question" (text contains)
function buildFilter({ orgId, q, name, tags, type, level, isPublic, ownerId, publicOrOwnerUserId, subjectId, subjectCode }) {
  const filter = {};

  const org = toOID(orgId);
  if (org) filter.orgId = org;
  if (subjectId && mongoose.isValidObjectId(subjectId)) {
    filter.subjectId = new mongoose.Types.ObjectId(subjectId);
  } else if (subjectCode) {
    filter.subjectCode = String(subjectCode).toUpperCase();
  }

  if (subjectId && mongoose.isValidObjectId(subjectId)) {
    filter.subjectId = new mongoose.Types.ObjectId(subjectId);
  }
  if (subjectCode) {
    filter.subjectCode = String(subjectCode).toUpperCase();
  }

  // --- full-text (fallback regex) ---
  if (q && typeof q === 'string' && q.trim()) {
    // Nếu có text index, bạn có thể chuyển sang:
    // filter.$text = { $search: q.trim() };
    const safe = escapeRegExp(q.trim());
    const re = new RegExp(safe, 'i');
    filter.$or = [{ text: re }, { 'choices.text': re }, { tags: re }];
  }

  if (name && typeof name === 'string' && name.trim()) {
    const safe = escapeRegExp(name.trim());
    filter.text = { $regex: safe, $options: 'i' };
  }

  if (Array.isArray(tags) && tags.length) filter.tags = { $all: tags };
  if (type) filter.type = type;

  if (level != null) {
    const lv = Number(level);
    if (!Number.isNaN(lv)) filter.level = lv;
  }

  if (typeof isPublic === 'boolean') filter.isPublic = isPublic;

  const owner = toOID(ownerId);
  if (owner) filter.ownerId = owner;

  if (!('isPublic' in (typeof isPublic === 'boolean' ? { isPublic } : {}))
      && !owner
      && publicOrOwnerUserId
  ) {
    const uid = toOID(publicOrOwnerUserId);
    if (uid) {
      const orScope = { $or: [{ isPublic: true }, { ownerId: uid }] };
      if (filter.$or) {
        const existingOr = filter.$or;
        delete filter.$or;
        filter.$and = [{ $or: existingOr }, orScope];
      } else if (filter.$and) {
        filter.$and.push(orScope);
      } else {
        filter.$and = [orScope];
      }
    }
  }

  return filter;
}

async function list(params) {
  const {
    orgId,
    page = 1,
    limit = 20,
    sort = '-createdAt',
    q,
    name,
    tags,
    type,
    level,
    isPublic,
    ownerId,
    publicOrOwnerUserId,
    subjectId,
    subjectCode,
  } = params;

  const filter = buildFilter({ orgId, q, name, tags, type, level, isPublic, ownerId, publicOrOwnerUserId, subjectId, subjectCode });

  const nPage = Number(page) || 1;
  const nLimit = Number(limit) || 20;
  const skip = (nPage - 1) * nLimit;

  const [items, total] = await Promise.all([
    Question.find(filter).sort(sort).skip(skip).limit(nLimit),
    Question.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: nPage,
    limit: nLimit,
    pages: Math.max(1, Math.ceil(total / nLimit)),
  };
}

async function getById({ orgId, id }) {
  if (orgId && mongoose.isValidObjectId(orgId)) {
    return Question.findOne({ _id: id, orgId: new mongoose.Types.ObjectId(orgId) });
  }
  return Question.findById(id);
}

async function create({ payload, user }) {
  const ownerId = user?.id || user?._id;

  let subjectId = payload.subjectId;
  if (!subjectId && payload.subjectCode) {
    const s = await Subject.findOne({
    ...(user?.orgId ? { orgId: user.orgId } : {}),
      code: String(payload.subjectCode).toUpperCase()
    }).select('_id code');
    if (!s) {
      const err = new Error('Subject not found for subjectCode');
      err.status = 400;
      throw err;
    }
    subjectId = s._id;
    payload.subjectCode = s.code;
  }

  const processedPayload = { ...payload };
  
  if (payload.type === 'mcq' && Array.isArray(payload.choices)) {
    const isNewFormat = payload.choices.every(choice => typeof choice === 'string');
    
    if (isNewFormat) {
      // Convert new format to old format
      processedPayload.choices = payload.choices.map((text, index) => ({
        key: String.fromCharCode(65 + index), // A, B, C, D...
        text: text
      }));
      
      // Convert answer from index to key
      const answerIndex = Number(payload.answer);
      if (!isNaN(answerIndex) && answerIndex >= 0 && answerIndex < payload.choices.length) {
        processedPayload.answer = String.fromCharCode(65 + answerIndex);
      }
    }
  }

  const doc = await Question.create({
    ...processedPayload,
    subjectId,
    ...(user?.orgId ? { orgId: user.orgId } : {}),
    ownerId,
  });
  return doc;
}


async function update({ orgId, id, payload, ownerIdEnforce }) {
  const filter = { _id: id };
  if (orgId && mongoose.isValidObjectId(orgId)) filter.orgId = new mongoose.Types.ObjectId(orgId);
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    filter.ownerId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }
  return Question.findOneAndUpdate(filter, payload, { new: true, runValidators: true });
}


async function hardDelete({ orgId, id, ownerIdEnforce }) {
  const filter = { _id: id };
  if (orgId && mongoose.isValidObjectId(orgId)) filter.orgId = new mongoose.Types.ObjectId(orgId);
  if (ownerIdEnforce && mongoose.isValidObjectId(ownerIdEnforce)) {
    filter.ownerId = new mongoose.Types.ObjectId(ownerIdEnforce);
  }
  return Question.findOneAndDelete(filter);
}


async function updatePartial({ orgId, id, payload }) {
  if (orgId && mongoose.isValidObjectId(orgId)) {
    return Question.findOneAndUpdate(
      { _id: id, orgId: new mongoose.Types.ObjectId(orgId) },
      { $set: payload },
      { new: true }
    );
  }
  return Question.findByIdAndUpdate(id, { $set: payload }, { new: true });
}

module.exports = { list, getById, create, update, updatePartial, hardDelete };

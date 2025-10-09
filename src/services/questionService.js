// services/questionService.js
const mongoose = require('mongoose');
const Question = require('../models/Question');

const toOID = (v) =>
  (v && mongoose.isValidObjectId(v)) ? new mongoose.Types.ObjectId(v) : undefined;

const escapeRegExp = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// q: search rộng (text / choices.text / tags)
// name: filter theo "tên question" (text contains)
function buildFilter({ orgId, q, name, tags, type, level, isPublic, ownerId }) {
  const filter = {};

  const org = toOID(orgId);
  if (org) filter.orgId = org;

  // --- full-text (fallback regex) ---
  if (q && typeof q === 'string' && q.trim()) {
    // Nếu có text index, bạn có thể chuyển sang:
    // filter.$text = { $search: q.trim() };
    const safe = escapeRegExp(q.trim());
    const re = new RegExp(safe, 'i');
    filter.$or = [{ text: re }, { 'choices.text': re }, { tags: re }];
  }

  // --- filter theo "tên question" (text contains) ---
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
  } = params;

  const filter = buildFilter({ orgId, q, name, tags, type, level, isPublic, ownerId });

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
  const doc = await Question.create({
    ...payload,
    ...(user?.orgId ? { orgId: user.orgId } : {}),
    ownerId: user?.id,
  });
  return doc;
}

async function update({ orgId, id, payload }) {
  if (orgId && mongoose.isValidObjectId(orgId)) {
    return Question.findOneAndUpdate(
      { _id: id, orgId: new mongoose.Types.ObjectId(orgId) },
      payload,
      { new: true }
    );
  }
  return Question.findByIdAndUpdate(id, payload, { new: true });
}

async function hardDelete({ orgId, id }) {
  if (orgId && mongoose.isValidObjectId(orgId)) {
    return Question.findOneAndDelete({ _id: id, orgId: new mongoose.Types.ObjectId(orgId) });
  }
  return Question.findByIdAndDelete(id);
}

module.exports = { list, getById, create, update, hardDelete };

// services/questionService.js
const mongoose = require('mongoose');
const Question = require('../models/Question');

// helper: cast chuỗi sang ObjectId an toàn
const toOID = (v) =>
  (v && mongoose.isValidObjectId(v)) ? new mongoose.Types.ObjectId(v) : undefined;

// CHỈ CÒN: orgId (optional), tags, type, level, isPublic
function buildFilter({ orgId, tags, type, level, isPublic }) {
  const filter = {};

  const org = toOID(orgId);
  if (org) filter.orgId = org;

  // tags: bắt buộc chứa tất cả tag truyền vào (giữ nguyên $all như trước)
  if (Array.isArray(tags) && tags.length) {
    filter.tags = { $all: tags };
  }

  if (type) filter.type = type;

  if (level != null) {
    const lv = Number(level);
    if (!Number.isNaN(lv)) filter.level = lv;
  }

  if (typeof isPublic === 'boolean') {
    filter.isPublic = isPublic;
  }

  return filter;
}

async function list(params) {
  const {
    orgId,
    page = 1,
    limit = 20,
    sort = '-createdAt',
    tags,
    type,
    level,
    isPublic,
  } = params;

  const filter = buildFilter({ orgId, tags, type, level, isPublic });
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

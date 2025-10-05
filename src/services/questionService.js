const mongoose = require('mongoose');
const Question = require('../models/Question');

function buildFilter({ orgId, q, tags, type, level, isPublic, ownerId }) {
  const filter = { orgId: new mongoose.Types.ObjectId(orgId) };

  if (q) filter.$text = { $search: q };
  if (Array.isArray(tags) && tags.length) filter.tags = { $all: tags };
  if (type) filter.type = type;
  if (level) filter.level = Number(level);
  if (typeof isPublic === 'boolean') filter.isPublic = isPublic;
  if (ownerId) filter.ownerId = new mongoose.Types.ObjectId(ownerId);

  return filter;
}

async function list(params) {
  const {
    orgId,
    page = 1,
    limit = 20,
    sort = '-createdAt',
    q,
    tags,
    type,
    level,
    isPublic,
    ownerId,
  } = params;

  const filter = buildFilter({ orgId, q, tags, type, level, isPublic, ownerId });

  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    Question.find(filter).sort(sort).skip(skip).limit(Number(limit)),
    Question.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  };
}

async function getById({ orgId, id }) {
  return Question.findOne({ _id: id, orgId });
}

async function create({ payload, user }) {
  const doc = await Question.create({
    ...payload,
    orgId: user.orgId,
    ownerId: user.id,
  });
  return doc;
}

async function update({ orgId, id, payload }) {
  return Question.findOneAndUpdate({ _id: id, orgId }, payload, { new: true });
}

async function hardDelete({ orgId, id }) {
  return Question.findOneAndDelete({ _id: id, orgId });
}

module.exports = { list, getById, create, update, hardDelete };

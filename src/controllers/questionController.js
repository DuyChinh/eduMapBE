const mongoose = require('mongoose');
const service = require('../services/questionService');

const ALLOWED_TYPES = ['mcq', 'tf', 'short', 'essay'];

const parseBool = (v) => {
  if (v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes'].includes(v.toLowerCase());
  return undefined;
};

function validateByType(body) {
  const errors = [];
  const type = body.type || 'mcq';

  if (!body.text || typeof body.text !== 'string') errors.push('text is required');
  if (!ALLOWED_TYPES.includes(type)) errors.push('invalid type');

  if (type === 'mcq') {
    if (!Array.isArray(body.choices) || body.choices.length < 2) {
      errors.push('choices must have at least 2 items for mcq');
    }
    const keys = new Set((body.choices || []).map((c) => c?.key));
    if (body.answer == null) errors.push('answer is required');
    const ansArr = Array.isArray(body.answer) ? body.answer : [body.answer];
    if (ansArr.some((k) => !keys.has(k))) errors.push('answer must be one of choices.key');
  }

  if (type === 'tf') {
    // answer là boolean hoặc 'true'/'false'
    const a = body.answer;
    const isBool =
      typeof a === 'boolean' ||
      (typeof a === 'string' && ['true', 'false'].includes(a.toLowerCase()));
    if (!isBool) errors.push('answer must be boolean for tf');
  }

  if (type === 'short') {
    // answer là string hoặc array string
    if (
      body.answer == null ||
      !(
        typeof body.answer === 'string' ||
        (Array.isArray(body.answer) && body.answer.every((x) => typeof x === 'string'))
      )
    ) {
      errors.push('answer must be string or string[] for short');
    }
  }

  if (type === 'essay') {
    if (body.answer != null && typeof body.answer !== 'string') {
      errors.push('answer (if provided) must be string rubric for essay');
    }
  }

  if (body.level && (Number(body.level) < 1 || Number(body.level) > 5)) {
    errors.push('level must be between 1 and 5');
  }

  return errors;
}

function canEdit(user, doc) {
  if (!user || !doc) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'teacher' && String(doc.ownerId) === String(user.id)) return true;
  return false;
}

async function list(req, res, next) {
  try {
    const orgId = req.user?.orgId || req.user?.org?.id;
    if (!orgId) return res.status(400).json({ ok: false, message: 'orgId missing on user' });

    const { page, limit, sort, q, tags, type, level, isPublic, ownerId } = req.query;

    const tagsArr =
      typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : tags;

    const enforcedIsPublic =
      req.user?.role === 'student' ? true : parseBool(isPublic);

    const data = await service.list({
      orgId,
      page,
      limit,
      sort,
      q,
      tags: tagsArr,
      type,
      level,
      isPublic: enforcedIsPublic,
      ownerId,
    });

    res.json({ ok: true, ...data });
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const orgId = req.user?.orgId || req.user?.org?.id;
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok: false, message: 'invalid id' });

    const doc = await service.getById({ orgId, id });
    if (!doc) return res.status(404).json({ ok: false, message: 'Question not found' });

    if (req.user?.role === 'student' && !doc.isPublic) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    res.json({ ok: true, data: doc });
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const errors = validateByType(req.body);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const doc = await service.create({ payload: req.body, user: req.user });
    res.status(201).json({ ok: true, data: doc });
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const orgId = req.user?.orgId || req.user?.org?.id;
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok: false, message: 'invalid id' });

    const existing = await service.getById({ orgId, id });
    if (!existing) return res.status(404).json({ ok: false, message: 'Question not found' });
    if (!canEdit(req.user, existing)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const merged = { ...existing.toObject(), ...req.body };
    const errors = validateByType(merged);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const updated = await service.update({ orgId, id, payload: req.body });
    res.json({ ok: true, data: updated });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    const orgId = req.user?.orgId || req.user?.org?.id;
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok: false, message: 'invalid id' });

    const existing = await service.getById({ orgId, id });
    if (!existing) return res.status(404).json({ ok: false, message: 'Question not found' });
    if (!canEdit(req.user, existing)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const deleted = await service.hardDelete({ orgId, id });
    res.json({ ok: true, data: deleted });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, getOne, create, update, remove };

const mongoose = require('mongoose');
const service = require('../services/questionService');

const ALLOWED_TYPES = ['mcq', 'tf', 'short', 'essay'];

const getOrgIdSoft = (req) =>
  req.user?.orgId || req.user?.org?.id || req.query.orgId || null;


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
    
    // Handle different answer formats
    let ansArr = [];
    if (body.answer && typeof body.answer === 'object' && body.answer.keys) {
      // Format: {"keys": ["A", "B"]}
      ansArr = body.answer.keys;
    } else if (Array.isArray(body.answer)) {
      // Format: ["A", "B"]
      ansArr = body.answer;
    } else {
      // Format: "A" or ["A"]
      ansArr = [body.answer];
    }
    
    console.log('Debug MCQ validation:', { answer: body.answer, ansArr, keys: Array.from(keys) });
    
    if (ansArr.some((k) => !keys.has(k))) errors.push('answer must be one of choices.key');
  }

  if (type === 'tf') {
    // answer là boolean hoặc 'true'/'false' hoặc object với value
    const a = body.answer;
    let isBool = false;
    
    if (typeof a === 'boolean') {
      isBool = true;
    } else if (typeof a === 'string' && ['true', 'false'].includes(a.toLowerCase())) {
      isBool = true;
    } else if (a && typeof a === 'object' && typeof a.value === 'boolean') {
      // Format: {"value": true}
      isBool = true;
    }
    
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

function isOwner(user, doc) {
  const uid = String(user?.id || user?._id || user?.userId || '');
  const oid = String(doc?.ownerId || '');
  return uid && oid && uid === oid;
}


async function patch(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ ok: false, message: 'invalid id' });

    const existing = await service.getById({ id });
    if (!existing) return res.status(404).json({ ok: false, message: 'Question not found' });

    // chỉ chủ sở hữu được sửa
    if (!isOwner(req.user, existing))
      return res.status(403).json({ ok: false, message: 'Only owner can modify this question' });

    // chỉ cho phép set các field whitelisted
    const allowed = ['text', 'type', 'choices', 'answer', 'tags', 'level', 'isPublic', 'metadata'];
    const payload = {};
    for (const k of allowed) if (k in req.body) payload[k] = req.body[k];

    // validate theo type sau khi merge
    const merged = { ...existing.toObject(), ...payload };
    const errors = validateByType(merged);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const updated = await service.updatePartial({ id, payload, ownerIdEnforce: req.user.id });
    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
}



async function list(req, res, next) {
  try {
    const orgId = getOrgIdSoft(req);

    const { page, limit, sort, q, name, tags, type, level, isPublic, ownerId, subjectCode, subjectId } = req.query;

    const tagsArr = typeof tags === 'string'
      ? tags.split(',').map(t => t.trim()).filter(Boolean)
      : tags;

    const enforcedIsPublic =
      req.user?.role === 'student'
        ? true
        : (typeof isPublic === 'string'
            ? (['true','1','yes'].includes(isPublic.toLowerCase()) ? true
              : ['false','0','no'].includes(isPublic.toLowerCase()) ? false
              : undefined)
            : isPublic);

    let publicOrOwnerUserId;
    if (req.user?.role === 'teacher') {
      const ownerProvided = !!ownerId;
      const isPublicProvided = (typeof enforcedIsPublic === 'boolean');
      if (!ownerProvided && !isPublicProvided) {
        publicOrOwnerUserId = req.user.id; // xem public của mọi người + private của mình
      }
    }

    const data = await service.list({
      orgId,
      page,
      limit,
      sort,
      q,                 // search rộng
      name,              // filter theo text
      tags: tagsArr,
      type,
      level,
      isPublic: enforcedIsPublic,
      ownerId,
      publicOrOwnerUserId,
      subjectCode,
      subjectId,
    });

    res.json({ ok: true, ...data });
  } catch (e) { next(e); }
}

async function getOne(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ ok: false, message: 'invalid id' });

    // gọi service không truyền orgId
    const doc = await service.getById({ id });
    if (!doc) return res.status(404).json({ ok: false, message: 'Question not found' });

    if (req.user?.role === 'student' && !doc.isPublic)
      return res.status(403).json({ ok: false, message: 'Forbidden' });

    if (req.user?.role === 'teacher' && !doc.isPublic) {
      const isOwnerView = String(doc.ownerId) === String(req.user.id);
      if (!isOwnerView) return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // nếu cả 2 bên đều có orgId thì kiểm tra cho chắc
    const orgId = getOrgIdSoft(req);
    if (orgId && doc.orgId && String(doc.orgId) !== String(orgId) && req.user?.role !== 'admin')
      return res.status(403).json({ ok: false, message: 'Forbidden' });

    res.json({ ok: true, data: doc });
  } catch (e) { next(e); }
}


async function create(req, res, next) {
  try {
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const { subjectId, subjectCode } = req.body;
    if (!subjectId && !subjectCode) {
      return res.status(400).json({ ok: false, message: 'subjectId or subjectCode is required' });
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
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ ok: false, message: 'invalid id' });

    const existing = await service.getById({ id });
    if (!existing) return res.status(404).json({ ok: false, message: 'Question not found' });

    // CHỈ owner được cập nhật (PUT toàn phần)
    if (!isOwner(req.user, existing))
      return res.status(403).json({ ok: false, message: 'Only owner can modify this question' });

    const merged = { ...existing.toObject(), ...req.body };
    const errors = validateByType(merged);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const updated = await service.update({ id, payload: req.body, ownerIdEnforce: req.user.id });
    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ ok: false, message: 'invalid id' });

    const existing = await service.getById({ id });
    if (!existing) return res.status(404).json({ ok: false, message: 'Question not found' });

    // CHỈ owner được xoá
    if (!isOwner(req.user, existing))
      return res.status(403).json({ ok: false, message: 'Only owner can delete this question' });

    const deleted = await service.hardDelete({ id, ownerIdEnforce: req.user.id });
    res.json({ ok: true, message: 'Question deleted', data: deleted });
  } catch (e) { next(e); }
}



module.exports = { list, getOne, create, update, patch, remove };

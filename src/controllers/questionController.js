const mongoose = require('mongoose');
const service = require('../services/questionService');
const Question = require('../models/Question');

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
    
    // Check if choices is array of strings (new format) or array of objects (old format)
    const isNewFormat = body.choices.every(choice => typeof choice === 'string');
    const isOldFormat = body.choices.every(choice => choice && typeof choice === 'object' && choice.key && choice.text);
    
    if (!isNewFormat && !isOldFormat) {
      errors.push('choices must be array of strings or array of objects with key and text');
    }
    
    if (body.answer == null) errors.push('answer is required');
    
    if (isNewFormat) {
      // New format: answer is index (number)
      const answerIndex = Number(body.answer);
      if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= body.choices.length) {
        errors.push('answer must be valid index for choices array');
      }
    } else if (isOldFormat) {
      // Old format: answer is key (string)
      const keys = new Set((body.choices || []).map((c) => c?.key));
      const ansArr = Array.isArray(body.answer) ? body.answer : [body.answer];
      if (ansArr.some((k) => !keys.has(k))) errors.push('answer must be one of choices.key');
    }
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
    const allowed = ['text', 'type', 'choices', 'answer', 'tags', 'level', 'isPublic', 'metadata', 'subjectId', 'subject'];
    const payload = {};
    for (const k of allowed) if (k in req.body) payload[k] = req.body[k];

    // Xử lý subject field
    if (payload.subject && !payload.subjectId) {
      payload.subjectId = payload.subject;
      delete payload.subject;
    }

    // validate theo type sau khi merge
    const merged = { ...existing.toObject(), ...payload };
    const errors = validateByType(merged);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const updated = await service.updatePartial({ id, payload, ownerIdEnforce: req.user.id });
    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
}



async function getAllQuestions(req, res, next) {
  try {
    // Chỉ teacher và admin được truy cập
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const orgId = getOrgIdSoft(req);
    
    // Lấy các tham số từ query
    const { 
      page = 1, 
      limit = 20, 
      subjectId, 
      type, 
      name, 
      level, 
      isPublic 
    } = req.query;

    // Parse boolean values
    const parseBool = (value) => {
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return ['true', '1', 'yes'].includes(value.toLowerCase());
      }
      return undefined;
    };

    // Build filter cho teacher
    const filter = {};
    
    // Filter theo organization
    if (orgId && mongoose.isValidObjectId(orgId)) {
      filter.orgId = new mongoose.Types.ObjectId(orgId);
    }

    // Filter theo ownerId (teacher hiện tại)
    filter.ownerId = new mongoose.Types.ObjectId(req.user.id);

    // Filter theo subjectId
    if (subjectId && mongoose.isValidObjectId(subjectId)) {
      filter.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    // Filter theo type
    if (type && ['mcq', 'tf', 'short', 'essay'].includes(type)) {
      filter.type = type;
    }

    // Filter theo level
    if (level) {
      const levelNum = Number(level);
      if (!isNaN(levelNum) && levelNum >= 1 && levelNum <= 5) {
        filter.level = levelNum;
      }
    }

    // Filter theo isPublic
    const isPublicBool = parseBool(isPublic);
    if (typeof isPublicBool === 'boolean') {
      filter.isPublic = isPublicBool;
    }

    // Filter theo name (search trong text)
    if (name && typeof name === 'string' && name.trim()) {
      filter.text = { $regex: name.trim(), $options: 'i' };
    }

    // Pagination
    const nPage = Number(page) || 1;
    const nLimit = Number(limit) || 20;
    const skip = (nPage - 1) * nLimit;

    // Sort theo ngày tạo gần nhất lên đầu
    const sort = { createdAt: -1 };

    // Query database
    const [items, total] = await Promise.all([
      Question.find(filter)
        .populate('subjectId', 'name name_en name_jp')
        .populate('ownerId', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(nLimit)
        .lean(),
      Question.countDocuments(filter)
    ]);
    res.json({
      ok: true,
      items,
      total,
      page: nPage,
      limit: nLimit,
      pages: Math.max(1, Math.ceil(total / nLimit))
    });
  } catch (e) {
    next(e);
  }
}

async function getQuestionById(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ ok: false, message: 'invalid id' });

    const question = await Question.findById(id)
      .populate('ownerId', 'name email') 
      .populate('subjectId', 'name name_en name_jp'); 
    
    res.json({ ok: true, data: question });
  } catch (e) { next(e); }
}


async function create(req, res, next) {
  try {
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const { subjectId, name } = req.body;
    if (!subjectId) {
      return res.status(400).json({ ok: false, message: 'subjectId or subjectCode is required' });
    }

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, message: 'name is required' });
    }

    const orgId = getOrgIdSoft(req);

    // Kiểm tra tên question trùng lặp của giáo viên này
    const existingQuestion = await service.findByNameAndOwner({
      name: name.trim(),
      ownerId: req.user.id,
      orgId
    });

    if (existingQuestion) {
      return res.status(409).json({ 
        ok: false, 
        message: 'Question name already exists for this teacher',
        data: {
          existingQuestion: {
            _id: existingQuestion._id,
            name: existingQuestion.name,
            text: existingQuestion.text,
            createdAt: existingQuestion.createdAt
          }
        }
      });
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

    // Xử lý subject field giống như trong create
    const payload = { ...req.body };
    if (payload.subject && !payload.subjectId) {
      payload.subjectId = payload.subject;
      delete payload.subject;
    }

    const merged = { ...existing.toObject(), ...payload };
    const errors = validateByType(merged);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const updated = await service.update({ id, payload, ownerIdEnforce: req.user.id });
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



module.exports = { 
  getAllQuestions, 
  getQuestionById, 
  create, 
  update, 
  patch, 
  remove,
  validateByType // Export for use in import controller
};

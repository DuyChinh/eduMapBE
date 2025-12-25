const mongoose = require('mongoose');
const service = require('../services/questionService');
const Question = require('../models/Question');
const cloudinary = require('../config/cloudinary');

const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    let publicId = parts[1];

    publicId = publicId.replace(/^v\d+\//, '');
    publicId = publicId.substring(0, publicId.lastIndexOf('.'));
    return publicId;
  } catch (e) {
    return null;
  }
};

const getAllImageUrls = (doc) => {
  const urls = new Set();
  if (doc.images && Array.isArray(doc.images)) {
    doc.images.forEach(url => { if (typeof url === 'string') urls.add(url); });
  }
  if (doc.image && typeof doc.image === 'string') urls.add(doc.image);
  if (doc.choices && Array.isArray(doc.choices)) {
    doc.choices.forEach(c => {
      if (c && typeof c === 'object' && c.image && typeof c.image === 'string') {
        urls.add(c.image);
      }
    });
  }
  return urls;
};

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
    // Allow text OR image (or both)
    const isOldFormat = body.choices.every(choice => choice && typeof choice === 'object' && choice.key && (choice.text || choice.image));

    if (!isNewFormat && !isOldFormat) {
      errors.push('choices must be array of strings or array of objects with key and (text or image)');
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
    const allowed = ['text', 'type', 'choices', 'answer', 'tags', 'level', 'isPublic', 'metadata', 'subjectId', 'subject', 'images'];
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

    // Compare and delete removed images
    const oldUrls = getAllImageUrls(existing.toObject());
    const newUrls = getAllImageUrls(merged);
    const urlsToDelete = [...oldUrls].filter(url => !newUrls.has(url));

    if (urlsToDelete.length > 0) {
      urlsToDelete.forEach(url => {
        const publicId = getPublicIdFromUrl(url);
        if (publicId) {
          cloudinary.uploader.destroy(publicId).catch(err => console.error('Cloudinary destroy error:', err));
        }
      });
    }

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

    // Filter theo name (search trong cả name và text)
    if (name && typeof name === 'string' && name.trim()) {
      const searchRegex = { $regex: name.trim(), $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { text: searchRegex }
      ];
    }

    // Pagination
    const nPage = Number(page) || 1;
    const nLimit = Number(limit) || 20;
    const skip = (nPage - 1) * nLimit;

    const sort = { updatedAt: -1 };

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

    // Compare and delete removed images
    const oldUrls = getAllImageUrls(existing.toObject());
    const newUrls = getAllImageUrls(merged);
    const urlsToDelete = [...oldUrls].filter(url => !newUrls.has(url));

    if (urlsToDelete.length > 0) {
      urlsToDelete.forEach(url => {
        const publicId = getPublicIdFromUrl(url);
        if (publicId) {
          cloudinary.uploader.destroy(publicId).catch(err => console.error('Cloudinary destroy error:', err));
        }
      });
    }

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

    // Delete images from Cloudinary
    try {
      if (existing.images && existing.images.length > 0) {
        for (const imgUrl of existing.images) {
          const publicId = getPublicIdFromUrl(imgUrl);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId).catch(err => console.error('Cloudinary destroy error:', err));
          }
        }
      }

      if (existing.choices && existing.choices.length > 0) {
        for (const choice of existing.choices) {
          if (choice.image && typeof choice.image === 'string') {
            const publicId = getPublicIdFromUrl(choice.image);
            if (publicId) {
              await cloudinary.uploader.destroy(publicId).catch(err => console.error('Cloudinary destroy error:', err));
            }
          }
        }
      }
    } catch (cleanupErr) {
      console.error('Error cleaning up images:', cleanupErr);
    }

    const deleted = await service.hardDelete({ id, ownerIdEnforce: req.user.id });
    res.json({ ok: true, message: 'Question deleted', data: deleted });
  } catch (e) { next(e); }
}




async function batchRename(req, res, next) {
  try {
    const { questionIds, baseName } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'questionIds must be a non-empty array' });
    }
    if (!baseName || typeof baseName !== 'string') {
      return res.status(400).json({ ok: false, message: 'baseName is required and must be a string' });
    }

    // Verify ownership/role
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const orgId = getOrgIdSoft(req);
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Fetch valid questions
    const validIds = questionIds.filter(id => mongoose.isValidObjectId(id));
    const questions = await Question.find({ _id: { $in: validIds } });

    // Sort questions by updatedAt DESC
    questions.sort((a, b) => {
      // Compare updatedAt
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();

      if (dateB !== dateA) return dateB - dateA;

      // If same date, use user selection order
      const indexA = questionIds.indexOf(String(a._id));
      const indexB = questionIds.indexOf(String(b._id));
      return indexA - indexB;
    });

    // Serial Rename in Reverse Order
    for (let i = questions.length - 1; i >= 0; i--) {
      const existing = questions[i];
      const id = existing.id;

      if (!isOwner(req.user, existing)) {
        results.failed++;
        results.errors.push({ id, name: existing.name, error: 'Not authorized to rename' });
        continue;
      }

      // If single item TOTAL, use baseName as is. If multiple, use baseName-index.
      const isSingleMode = questions.length === 1;
      const newName = isSingleMode ? baseName : `${baseName}-${i + 1}`;

      try {
        const queryBase = {
          ownerId: new mongoose.Types.ObjectId(req.user.id),
          ...(orgId ? { orgId: new mongoose.Types.ObjectId(orgId) } : {}),
        };

        // Check duplicate for newName
        const duplicate = await Question.findOne({
          ...queryBase,
          name: newName,
          _id: { $ne: existing._id }
        });

        if (duplicate) {
          results.failed++;
          results.errors.push({ id, name: existing.name, error: `The name "${newName}" is already taken` });
          continue;
        }

        if (isSingleMode) {
          const escapedName = newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const variantConflict = await Question.findOne({
            ...queryBase,
            name: { $regex: new RegExp(`^${escapedName}-\\d+$`) },
            _id: { $ne: existing._id }
          });

          if (variantConflict) {
            results.failed++;
            results.errors.push({ id, name: existing.name, error: `Cannot use name "${newName}" because a related numbered series already exists (e.g. "${variantConflict.name}")` });
            continue;
          }
        }

        // Perform Update
        existing.name = newName;
        await existing.save();
        results.success++;

      } catch (err) {
        results.failed++;
        results.errors.push({ id, error: err.message });
      }
    }

    // Report missing IDs
    const foundIds = questions.map(q => String(q._id));
    const missingIds = questionIds.filter(id => !foundIds.includes(id) && mongoose.isValidObjectId(id));
    missingIds.forEach(id => {
      results.failed++;
      results.errors.push({ id, error: 'Question not found' });
    });

    res.json({
      ok: true,
      message: `Renamed ${results.success} questions. ${results.failed} failed.`,
      results
    });

  } catch (e) {
    next(e);
  }
}

module.exports = {
  getAllQuestions,
  getQuestionById,
  create,
  update,
  patch,
  remove,
  batchRename,
  validateByType, // Export for use in import controller
  batchCreate,
  uploadPdfForParsing
};

/**
 * Batch create questions (for creating from PDF)
 * POST /v1/api/questions/batch-create
 */
async function batchCreate(req, res, next) {
  try {
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ ok: false, message: 'questions array is required and must be non-empty' });
    }

    const orgId = getOrgIdSoft(req);
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      data: []
    };

    // Process each question
    for (let i = 0; i < questions.length; i++) {
      const questionData = questions[i];
      const index = i + 1;

      try {
        // Basic validation
        if (!questionData.name || !questionData.text || !questionData.subjectId) {
          results.failed++;
          results.errors.push({ index, error: 'Missing required fields (name, text, subjectId)' });
          continue;
        }

        // Check for duplicate name
        const existingQuestion = await service.findByNameAndOwner({
          name: questionData.name.trim(),
          ownerId: req.user.id,
          orgId
        });

        if (existingQuestion) {
          // Auto-rename if duplicate: name-timestamp
          questionData.name = `${questionData.name.trim()} (${Date.now()}-${Math.floor(Math.random() * 1000)})`;
        }

        // Validate structure
        const errors = validateByType(questionData);
        if (errors.length > 0) {
          results.failed++;
          results.errors.push({ index, name: questionData.name, error: errors.join('; ') });
          continue;
        }

        // Create question
        const doc = await service.create({ payload: questionData, user: req.user });
        results.success++;
        results.data.push(doc);

      } catch (error) {
        results.failed++;
        results.errors.push({ index, name: questionData.name, error: error.message || 'Unknown error' });
      }
    }

    res.json({
      ok: true,
      message: `Created ${results.success} questions. ${results.failed} failed.`,
      results
    });

  } catch (e) {
    next(e);
  }
}

/**
 * Upload PDF and parse questions using AI
 * POST /v1/api/questions/upload-pdf
 */
const pdfParserService = require('../services/pdfParserService');

async function uploadPdfForParsing(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No file uploaded' });
    }

    console.log(`Processing PDF via PDFParserService: ${req.file.originalname}`);

    // Use pdfParserService to parse the PDF
    // It returns structured data including pages and questions
    const result = await pdfParserService.parsePDF(req.file.buffer, req.file.originalname);

    // Transform result to match what frontend expects
    // Frontend expects: { ok: true, data: { filename, totalQuestions, pages: [...] } }

    // Calculate total questions
    let totalQuestions = 0;
    if (result.pages) {
      result.pages.forEach(p => {
        if (p.questions) totalQuestions += p.questions.length;
      });
    }

    res.json({
      ok: true,
      data: {
        filename: req.file.originalname,
        totalQuestions: totalQuestions,
        pages: result.pages
      }
    });

  } catch (error) {
    console.error('Error in uploadPdfForParsing:', error);
    next(error);
  }
}

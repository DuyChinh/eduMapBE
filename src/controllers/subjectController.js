const mongoose = require('mongoose');
const Subject = require('../models/Subject');

const getOrgIdSoft = (req) => req.user?.orgId || req.user?.org?.id || req.body?.orgId || req.query?.orgId || null;

const isTeacher = (u) => u && u.role === 'teacher';
const isAdmin = (u) => u && u.role === 'admin';
const isTeacherOrAdmin = (u) => isTeacher(u) || isAdmin(u);

async function createSubject(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Only teacher or admin can create subjects' });
    }
    
    const orgId = getOrgIdSoft(req);
    const { name, name_en, name_jp, code, grade } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({ ok: false, message: 'name and code are required' });
    }

    const doc = await Subject.create({
      ...(orgId ? { orgId } : {}),
      name: name.trim(),
      name_en: name_en?.trim(),
      name_jp: name_jp?.trim(),
      code: String(code).toUpperCase(),
      grade: grade?.trim()
    });
    
    res.status(201).json({ ok: true, data: doc });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, message: 'Subject code already exists' });
    }
    next(e);
  }
}

async function getAllSubjects(req, res, next) {
  try {
    const orgId = getOrgIdSoft(req);
    const { q, grade, code, page = 1, limit = 50, sort = 'grade name code', lang = 'vi' } = req.query;
    
    const filter = {};
    
    if (orgId && mongoose.isValidObjectId(orgId)) {
      filter.orgId = orgId;
    }
    
    if (q && q.trim().length >= 1) {
      const searchRegex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { name_en: searchRegex },
        { name_jp: searchRegex },
        { code: searchRegex }
      ];
    }
    
    if (grade) {
      filter.grade = grade;
    }
    
    if (code) {
      filter.code = new RegExp(code.trim(), 'i');
    }
    
    const nPage = Number(page) || 1;
    const nLimit = Math.min(Number(limit) || 50, 100);
    const skip = (nPage - 1) * nLimit;
    
    const [items, total] = await Promise.all([
      Subject.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(nLimit),
      Subject.countDocuments(filter)
    ]);
    
    // Return all translation fields so frontend can handle language switching
    const itemsWithAllFields = items.map(item => item.toObject());
    
    res.json({ 
      ok: true, 
      items: itemsWithAllFields,
      total,
      page: nPage,
      limit: nLimit,
      pages: Math.max(1, Math.ceil(total / nLimit))
    });
  } catch (e) { 
    next(e); 
  }
}

async function getSubjectById(req, res, next) {
  try {
    const { id } = req.params;
    const { lang = 'vi' } = req.query;
    
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'Invalid subject ID' });
    }
    
    const orgId = getOrgIdSoft(req);
    const filter = { _id: id };
    
    if (orgId && mongoose.isValidObjectId(orgId)) {
      filter.orgId = orgId;
    }
    
    const subject = await Subject.findOne(filter);
    
    if (!subject) {
      return res.status(404).json({ ok: false, message: 'Subject not found' });
    }
    
    // Return all translation fields so frontend can handle language switching
    const subjectObj = subject.toObject();
    
    res.json({ 
      ok: true, 
      data: subjectObj
    });
  } catch (e) { 
    next(e); 
  }
}

async function updateSubject(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Only teacher or admin can update subjects' });
    }
    
    const { id } = req.params;
    
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'Invalid subject ID' });
    }
    
    const orgId = getOrgIdSoft(req);
    const filter = { _id: id };
    
    if (orgId && mongoose.isValidObjectId(orgId)) {
      filter.orgId = orgId;
    }
    
    const { name, name_en, name_jp, code, grade } = req.body;
    const updateData = {};
    
    if (name) updateData.name = name.trim();
    if (name_en !== undefined) updateData.name_en = name_en?.trim();
    if (name_jp !== undefined) updateData.name_jp = name_jp?.trim();
    if (code) updateData.code = String(code).toUpperCase();
    if (grade !== undefined) updateData.grade = grade?.trim();
    
    const subject = await Subject.findOneAndUpdate(filter, updateData, { new: true });
    
    if (!subject) {
      return res.status(404).json({ ok: false, message: 'Subject not found' });
    }
    
    res.json({ ok: true, message: 'Subject updated successfully', data: subject });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, message: 'Subject code already exists' });
    }
    next(e);
  }
}

async function deleteSubject(req, res, next) {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Only teacher or admin can delete subjects' });
    }
    
    const { id } = req.params;
    
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, message: 'Invalid subject ID' });
    }
    
    const orgId = getOrgIdSoft(req);
    const filter = { _id: id };
    
    if (orgId && mongoose.isValidObjectId(orgId)) {
      filter.orgId = orgId;
    }
    
    const subject = await Subject.findOneAndDelete(filter);
    
    if (!subject) {
      return res.status(404).json({ ok: false, message: 'Subject not found' });
    }
    
    res.json({ ok: true, message: 'Subject deleted successfully' });
  } catch (e) { 
    next(e); 
  }
}

module.exports = {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject
};

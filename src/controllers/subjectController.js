const mongoose = require('mongoose');
const Subject = require('../models/Subject');

const getOrgIdSoft = (req) => req.user?.orgId || req.user?.org?.id || req.body?.orgId || req.query?.orgId || null;

async function create(req, res, next) {
  try {
    if (!['teacher','admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    const orgId = getOrgIdSoft(req);
    const { name, code, grade } = req.body;
    if (!name || !code) return res.status(400).json({ ok: false, message: 'name & code required' });

    const doc = await Subject.create({
      ...(orgId ? { orgId } : {}),
      name: name.trim(),
      code: String(code).toUpperCase(),
      grade
    });
    res.status(201).json({ ok: true, data: doc });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ ok:false, message: 'Subject code already exists' });
    next(e);
  }
}

async function list(req, res, next) {
  try {
    const orgId = getOrgIdSoft(req);
    const filter = {};
    if (orgId && mongoose.isValidObjectId(orgId)) filter.orgId = orgId;
    const items = await Subject.find(filter).sort('grade name code');
    res.json({ ok: true, items });
  } catch (e) { next(e); }
}

module.exports = { create, list };

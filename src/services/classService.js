const ClassModel = require('../models/Class');

/** Sinh code: A-Z + 2-9 */
function randomCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

/** Tạo code duy nhất trong phạm vi 1 org */
async function generateUniqueCode(orgId, tries = 10, len = 6) {
  for (let i = 0; i < tries; i++) {
    const code = randomCode(len);
    // Khi có orgId: check theo orgId+code; khi không có: check theo code
    const exists = orgId
      ? await ClassModel.exists({ orgId, code })
      : await ClassModel.exists({ code });
    if (!exists) return code;
  }
  const err = new Error('Cannot generate unique class code');
  err.status = 409;
  throw err;
}

async function create({ orgId, teacherId, payload }) {
  const code = await generateUniqueCode(orgId);
  const doc = await ClassModel.create({
    ...(orgId ? { orgId } : {}),
    teacherId,
    name: payload.name,
    code, // auto-generated
    studentIds: payload.studentIds || [],
    settings: payload.settings || {},
    metadata: payload.metadata || {}
  });
  return doc;
}



module.exports = { create };

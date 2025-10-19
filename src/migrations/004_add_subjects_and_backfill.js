const { ObjectId } = require('mongodb');

const DEFAULT_SUBJECTS = [
  { code: 'MATH', name: 'Toán học', name_en: 'Mathematics', name_jp: '数学' },
  { code: 'LIT',  name: 'Ngữ văn', name_en: 'Literature', name_jp: '文学' },
  { code: 'PHYS', name: 'Vật lý', name_en: 'Physics', name_jp: '物理学' },
  { code: 'CHEM', name: 'Hóa học', name_en: 'Chemistry', name_jp: '化学' },
  { code: 'BIO',  name: 'Sinh học', name_en: 'Biology', name_jp: '生物学' },
  { code: 'ENG',  name: 'Tiếng Anh', name_en: 'English', name_jp: '英語' },
  { code: 'HIST', name: 'Lịch sử', name_en: 'History', name_jp: '歴史' },
  { code: 'GEO',  name: 'Địa lý', name_en: 'Geography', name_jp: '地理' },
  { code: 'OTHER',name: 'Khác/Chưa phân loại', name_en: 'Other/Unclassified', name_jp: 'その他/未分類' },
];

function normalizeCode(s) {
  return (s || '').toString().trim().toUpperCase();
}

function inferSubjectCodeFromQuestion(q) {
  const text = (q.text || '').toLowerCase();
  const tags = Array.isArray(q.tags) ? q.tags.map(t => String(t).toLowerCase()) : [];

  if (tags.includes('math') || /toán|math/.test(text)) return 'MATH';
  if (tags.includes('van')  || /ngữ văn|chí phèo|văn/.test(text)) return 'LIT';
  if (tags.includes('phys') || /vật lý|physics/.test(text)) return 'PHYS';
  if (tags.includes('chem') || /hóa|chemistry/.test(text)) return 'CHEM';
  if (tags.includes('bio')  || /sinh học|biology/.test(text)) return 'BIO';
  if (tags.includes('eng')  || /tiếng anh|english/.test(text)) return 'ENG';
  if (tags.includes('hist') || /lịch sử|history/.test(text)) return 'HIST';
  if (tags.includes('geo')  || /địa lý|geography/.test(text)) return 'GEO';
  return 'OTHER';
}

async function up(db, client) {
  console.log('[002] Creating subjects collection & indexes if missing...');

  // 1) Create subjects (idempotent)
  const colls = await db.listCollections({ name: 'subjects' }).toArray();
  if (colls.length === 0) {
    await db.createCollection('subjects');
  }

  // Indexes for subjects:
  // Unique by (orgId, code). Since there might be records without orgId, use partial to avoid conflicts.
  await db.collection('subjects').createIndex(
    { orgId: 1, code: 1 },
    { unique: true, partialFilterExpression: { code: { $exists: true } } }
  );
  await db.collection('subjects').createIndex({ orgId: 1, name: 1 });

  // 2) Seed default subjects (no orgId specified -> shared;
  //    can seed separately per org in later steps or modify the section below.)
  console.log('[002] Seeding default subjects...');
  for (const s of DEFAULT_SUBJECTS) {
    await db.collection('subjects').updateOne(
      { code: s.code, orgId: { $exists: false } }, // seed global
      {
        $setOnInsert: {
          code: s.code,
          name: s.name,
          name_en: s.name_en,
          name_jp: s.name_jp,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  // 3) Backfill questions.subjectId / subjectCode
  console.log('[002] Backfilling questions.subjectId / subjectCode...');

  // Create quick map: (orgId? + code) -> _id
  const subjectsGlobal = await db.collection('subjects').find({ orgId: { $exists: false } }).toArray();
  const byCodeGlobal = new Map(subjectsGlobal.map(s => [normalizeCode(s.code), s._id]));

  const cursor = db.collection('questions').find({}, { projection: { _id: 1, orgId: 1, subjectId: 1, subjectCode: 1, text: 1, tags: 1 } });
  let processed = 0, updated = 0;

  while (await cursor.hasNext()) {
    const q = await cursor.next();
    processed++;

    // Skip if already has subjectId & subjectCode
    if (q.subjectId && q.subjectCode) continue;

    let code = normalizeCode(q.subjectCode);
    if (!code) code = inferSubjectCodeFromQuestion(q);

    // Map code -> subjectId
    // has subjects by orgId, prioritize search by orgId, fallback to global
    let subjId = byCodeGlobal.get(code);
    if (!subjId) {
      // If no subject with this code exists globally, create new quickly:
      const ins = await db.collection('subjects').findOneAndUpdate(
        { code, orgId: { $exists: false } },
        {
          $setOnInsert: {
            code,
            name: code, // temporarily use code as name, can be manually edited later
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
      subjId = ins.value?._id;
      byCodeGlobal.set(code, subjId);
    }

    // update question
    await db.collection('questions').updateOne(
      { _id: q._id },
      {
        $set: {
          subjectId: subjId,
          subjectCode: code,
          updatedAt: new Date()
        }
      }
    );
    updated++;
  }

  console.log('[002] Backfill done:', { processed, updated });
}

async function down(db, client) {
  console.log('[002][down] Removing subject references from questions and dropping subjects (global only)...');

  // Remove subjectId/subjectCode from questions (cannot restore original)
  await db.collection('questions').updateMany(
    {},
    { $unset: { subjectId: "", subjectCode: "" } }
  );

  // Delete global subjects (orgId not exists). 
  await db.collection('subjects').deleteMany({ orgId: { $exists: false } });

  // (Don't drop subjects collection to avoid data loss if there are subjects by other orgId)
  // If complete removal needed:
  // await db.collection('subjects').drop();
}

module.exports = { up, down };

const { ObjectId } = require('mongodb');

const DEFAULT_SUBJECTS = [
  { code: 'MATH', name: 'Toán học' },
  { code: 'LIT',  name: 'Ngữ văn' },
  { code: 'PHYS', name: 'Vật lý' },
  { code: 'CHEM', name: 'Hóa học' },
  { code: 'BIO',  name: 'Sinh học' },
  { code: 'ENG',  name: 'Tiếng Anh' },
  { code: 'HIST', name: 'Lịch sử' },
  { code: 'GEO',  name: 'Địa lý' },
  { code: 'CIVIC', name: 'Giáo dục công dân' },
  { code: 'TECH', name: 'Công nghệ' },
  { code: 'ART', name: 'Mỹ thuật' },
  { code: 'MUSIC', name: 'Âm nhạc' },
  { code: 'PE', name: 'Thể dục' },
  { code: 'INFO', name: 'Tin học' },
  { code: 'FRENCH', name: 'Tiếng Pháp' },
  { code: 'CHINESE', name: 'Tiếng Trung' },
  { code: 'JAPANESE', name: 'Tiếng Nhật' },
  { code: 'KOREAN', name: 'Tiếng Hàn' },
  { code: 'OTHER',name: 'Khác/Chưa phân loại' },
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
  if (tags.includes('civic') || /giáo dục công dân|gdcd/.test(text)) return 'CIVIC';
  if (tags.includes('tech') || /công nghệ|technology/.test(text)) return 'TECH';
  if (tags.includes('art') || /mỹ thuật|art/.test(text)) return 'ART';
  if (tags.includes('music') || /âm nhạc|music/.test(text)) return 'MUSIC';
  if (tags.includes('pe') || /thể dục|physical/.test(text)) return 'PE';
  if (tags.includes('info') || /tin học|informatics/.test(text)) return 'INFO';
  if (tags.includes('french') || /tiếng pháp|français/.test(text)) return 'FRENCH';
  if (tags.includes('chinese') || /tiếng trung|中文/.test(text)) return 'CHINESE';
  if (tags.includes('japanese') || /tiếng nhật|日本語/.test(text)) return 'JAPANESE';
  if (tags.includes('korean') || /tiếng hàn|한국어/.test(text)) return 'KOREAN';
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
  // Unique theo (orgId, code). Vì có thể có records không có orgId, dùng partial để tránh xung đột.
  await db.collection('subjects').createIndex(
    { orgId: 1, code: 1 },
    { unique: true, partialFilterExpression: { code: { $exists: true } } }
  );
  await db.collection('subjects').createIndex({ orgId: 1, name: 1 });

  // 2) Seed default subjects (không chỉ định orgId -> dùng chung;
  //    có thể seed riêng per org ở các bước sau hoặc sửa đoạn dưới.)
  console.log('[002] Seeding default subjects...');
  for (const s of DEFAULT_SUBJECTS) {
    await db.collection('subjects').updateOne(
      { code: s.code, orgId: { $exists: false } }, // seed global
      {
        $setOnInsert: {
          code: s.code,
          name: s.name,
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

  // Tạo map nhanh: (orgId? + code) -> _id
  const subjectsGlobal = await db.collection('subjects').find({ orgId: { $exists: false } }).toArray();
  const byCodeGlobal = new Map(subjectsGlobal.map(s => [normalizeCode(s.code), s._id]));

  const cursor = db.collection('questions').find({}, { projection: { _id: 1, orgId: 1, subjectId: 1, subjectCode: 1, text: 1, tags: 1 } });
  let processed = 0, updated = 0;

  while (await cursor.hasNext()) {
    const q = await cursor.next();
    processed++;

    // Bỏ qua nếu đã có subjectId & subjectCode
    if (q.subjectId && q.subjectCode) continue;

    let code = normalizeCode(q.subjectCode);
    if (!code) code = inferSubjectCodeFromQuestion(q);

    // Map code -> subjectId
    // có subjects theo orgId, ưu tiên tìm theo orgId, fallback sang global
    let subjId = byCodeGlobal.get(code);
    if (!subjId) {
      // Nếu chưa có subject tương ứng code này ở global, tạo mới nhanh:
      const ins = await db.collection('subjects').findOneAndUpdate(
        { code, orgId: { $exists: false } },
        {
          $setOnInsert: {
            code,
            name: code, // tạm lấy code làm name, có thể sửa tay sau
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
  console.log('[004][down] Removing subject references from questions and dropping subjects (global only)...');

  // Gỡ subjectId/subjectCode khỏi questions (không phục hồi được gốc)
  await db.collection('questions').updateMany(
    {},
    { $unset: { subjectId: "", subjectCode: "" } }
  );

  // Xoá subjects global (orgId not exists). 
  await db.collection('subjects').deleteMany({ orgId: { $exists: false } });

  // (Không drop collection subjects để tránh mất dữ liệu nếu có subject theo orgId khác)
  // Nếu cần triệt để:
  // await db.collection('subjects').drop();
}

module.exports = { up, down };

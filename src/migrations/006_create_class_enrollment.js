const { ObjectId } = require('mongodb');

async function up(db, client) {
  console.log('[006] Creating ClassEnrollment collection and migrating data...');

  // 1) Create ClassEnrollment collection
  const colls = await db.listCollections({ name: 'classEnrollments' }).toArray();
  if (colls.length === 0) {
    await db.createCollection('classEnrollments');
  }

  // 2) Create indexes for ClassEnrollment
  console.log('[006] Creating indexes for ClassEnrollment...');
  
  // Index for finding enrollments by classId
  await db.collection('classEnrollments').createIndex({ classId: 1 });
  
  // Index for finding enrollments by userId
  await db.collection('classEnrollments').createIndex({ userId: 1 });
  
  // Compound index for unique enrollment (user can only be enrolled once per class)
  await db.collection('classEnrollments').createIndex(
    { classId: 1, userId: 1 }, 
    { unique: true }
  );
  
  // Index for finding active enrollments
  await db.collection('classEnrollments').createIndex({ status: 1 });
  
  // Index for finding enrollments by role
  await db.collection('classEnrollments').createIndex({ role: 1 });
  
  // Compound index for performance queries
  await db.collection('classEnrollments').createIndex({ 
    classId: 1, 
    status: 1, 
    role: 1 
  });

  // 3) Migrate existing data from Classes
  console.log('[006] Migrating existing class-student relationships...');
  
  const classes = await db.collection('classes').find({}).toArray();
  let migratedCount = 0;
  
  for (const classDoc of classes) {
    const classId = classDoc._id;
    const teacherId = classDoc.teacherId;
    const studentIds = classDoc.studentIds || [];
    
    // Create enrollment for teacher
    if (teacherId) {
      await db.collection('classEnrollments').updateOne(
        { classId: classId, userId: teacherId },
        {
          $setOnInsert: {
            classId: classId,
            userId: teacherId,
            role: 'teacher',
            status: 'active',
            enrolledAt: classDoc.createdAt || new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      migratedCount++;
    }
    
    // Create enrollments for students
    for (const studentId of studentIds) {
      await db.collection('classEnrollments').updateOne(
        { classId: classId, userId: studentId },
        {
          $setOnInsert: {
            classId: classId,
            userId: studentId,
            role: 'student',
            status: 'active',
            enrolledAt: classDoc.createdAt || new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      migratedCount++;
    }
  }
  
  console.log(`[006] Migrated ${migratedCount} enrollments from ${classes.length} classes`);

  // 4) Add metadata fields to existing ClassEnrollment documents (if any)
  console.log('[006] Adding metadata fields to existing enrollments...');
  
  await db.collection('classEnrollments').updateMany(
    { 
      $or: [
        { grade: { $exists: false } },
        { attendance: { $exists: false } },
        { notes: { $exists: false } }
      ]
    },
    {
      $set: {
        grade: null,
        attendance: [],
        notes: '',
        lastActivityAt: new Date(),
        updatedAt: new Date()
      }
    }
  );

  console.log('[006] ClassEnrollment migration completed successfully!');
}

async function down(db, client) {
  console.log('[006][down] Rolling back ClassEnrollment migration...');

  // 1) Restore studentIds in classes from ClassEnrollment
  console.log('[006][down] Restoring studentIds in classes...');
  
  const enrollments = await db.collection('classEnrollments').find({ role: 'student' }).toArray();
  
  // Group enrollments by classId
  const classStudentMap = {};
  for (const enrollment of enrollments) {
    if (!classStudentMap[enrollment.classId]) {
      classStudentMap[enrollment.classId] = [];
    }
    classStudentMap[enrollment.classId].push(enrollment.userId);
  }
  
  // Update classes with studentIds
  for (const [classId, studentIds] of Object.entries(classStudentMap)) {
    await db.collection('classes').updateOne(
      { _id: new ObjectId(classId) },
      { 
        $set: { 
          studentIds: studentIds,
          updatedAt: new Date()
        } 
      }
    );
  }
  
  // 2) Drop ClassEnrollment collection
  console.log('[006][down] Dropping ClassEnrollment collection...');
  await db.collection('classEnrollments').drop();
  
  console.log('[006][down] Rollback completed!');
}

module.exports = { up, down };

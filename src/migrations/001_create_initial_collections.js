const { ObjectId } = require('mongodb');

module.exports = {
  async up(db, client) {
    console.log('Creating initial collections...');
    
    // Tạo collections với indexes
    await db.createCollection('organizations');
    await db.createCollection('users');
    await db.createCollection('classes');
    await db.createCollection('questions');
    await db.createCollection('exams');
    await db.createCollection('assignments');
    await db.createCollection('submissions');
    await db.createCollection('proctorlogs');
    
    // Tạo indexes cho organizations
    await db.collection('organizations').createIndex({ domain: 1 }, { unique: true, sparse: true });
    await db.collection('organizations').createIndex({ ownerId: 1 });
    
    // Tạo indexes cho users
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ orgId: 1, role: 1 });
    await db.collection('users').createIndex({ orgId: 1, email: 1 });
    
    // Tạo indexes cho classes
    await db.collection('classes').createIndex({ orgId: 1, code: 1 }, { unique: true });
    await db.collection('classes').createIndex({ orgId: 1, teacherId: 1 });
    await db.collection('classes').createIndex({ orgId: 1, 'studentIds': 1 });
    
    // Tạo indexes cho questions
    await db.collection('questions').createIndex({ orgId: 1, ownerId: 1, tags: 1 });
    await db.collection('questions').createIndex({ orgId: 1, text: 'text' });
    await db.collection('questions').createIndex({ orgId: 1, tags: 1 });
    await db.collection('questions').createIndex({ orgId: 1, type: 1, level: 1 });
    
    // Tạo indexes cho exams
    await db.collection('exams').createIndex({ orgId: 1, ownerId: 1 });
    await db.collection('exams').createIndex({ orgId: 1, status: 1 });
    await db.collection('exams').createIndex({ 'settings.openAt': 1, 'settings.closeAt': 1 });
    
    // Tạo indexes cho assignments
    await db.collection('assignments').createIndex({ orgId: 1, classId: 1 });
    await db.collection('assignments').createIndex({ orgId: 1, examId: 1 });
    await db.collection('assignments').createIndex({ orgId: 1, status: 1 });
    await db.collection('assignments').createIndex({ 'window.openAt': 1, 'window.closeAt': 1 });
    
    // Tạo indexes cho submissions
    await db.collection('submissions').createIndex({ orgId: 1, examId: 1, userId: 1 });
    await db.collection('submissions').createIndex({ orgId: 1, assignmentId: 1 });
    await db.collection('submissions').createIndex({ orgId: 1, userId: 1, status: 1 });
    await db.collection('submissions').createIndex({ orgId: 1, submittedAt: 1 });
    
    // Tạo indexes cho proctorlogs
    await db.collection('proctorlogs').createIndex({ orgId: 1, submissionId: 1, ts: 1 });
    await db.collection('proctorlogs').createIndex({ orgId: 1, userId: 1, event: 1 });
    await db.collection('proctorlogs').createIndex({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // TTL 90 days
    
    console.log('Initial collections and indexes created successfully!');
  },

  async down(db, client) {
    console.log('Dropping collections...');
    
    await db.collection('organizations').drop();
    await db.collection('users').drop();
    await db.collection('classes').drop();
    await db.collection('questions').drop();
    await db.collection('exams').drop();
    await db.collection('assignments').drop();
    await db.collection('submissions').drop();
    await db.collection('proctorlogs').drop();
    
    console.log('Collections dropped successfully!');
  }
};

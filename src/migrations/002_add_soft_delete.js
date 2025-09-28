module.exports = {
    async up(db, client) {
      console.log('Adding soft delete fields...');
      
      // Thêm trường deletedAt cho tất cả collections
      const collections = ['organizations', 'users', 'classes', 'questions', 'exams', 'assignments', 'submissions'];
      
      for (const collectionName of collections) {
        await db.collection(collectionName).updateMany(
          { deletedAt: { $exists: false } },
          { $set: { deletedAt: null } }
        );
      }
      
      // Tạo indexes cho soft delete
      await db.collection('organizations').createIndex({ deletedAt: 1 });
      await db.collection('users').createIndex({ deletedAt: 1 });
      await db.collection('classes').createIndex({ deletedAt: 1 });
      await db.collection('questions').createIndex({ deletedAt: 1 });
      await db.collection('exams').createIndex({ deletedAt: 1 });
      await db.collection('assignments').createIndex({ deletedAt: 1 });
      await db.collection('submissions').createIndex({ deletedAt: 1 });
      
      console.log('Soft delete fields added successfully!');
    },
  
    async down(db, client) {
      console.log('Removing soft delete fields...');
      
      const collections = ['organizations', 'users', 'classes', 'questions', 'exams', 'assignments', 'submissions'];
      
      for (const collectionName of collections) {
        await db.collection(collectionName).updateMany(
          {},
          { $unset: { deletedAt: 1 } }
        );
      }
      
      console.log('Soft delete fields removed successfully!');
    }
  };



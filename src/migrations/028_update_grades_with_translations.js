const up = async (db, client) => {
  console.log('Updating grades with name_en, name_jp and adding Other grade...');
  
  try {
    const gradesCollection = db.collection('grades');
    
    // Update existing grades with translations
    const gradeUpdates = [
      { level: 1, name_en: 'Grade 1', name_jp: '1年生' },
      { level: 2, name_en: 'Grade 2', name_jp: '2年生' },
      { level: 3, name_en: 'Grade 3', name_jp: '3年生' },
      { level: 4, name_en: 'Grade 4', name_jp: '4年生' },
      { level: 5, name_en: 'Grade 5', name_jp: '5年生' },
      { level: 6, name_en: 'Grade 6', name_jp: '6年生' },
      { level: 7, name_en: 'Grade 7', name_jp: '7年生' },
      { level: 8, name_en: 'Grade 8', name_jp: '8年生' },
      { level: 9, name_en: 'Grade 9', name_jp: '9年生' },
      { level: 10, name_en: 'Grade 10', name_jp: '10年生' },
      { level: 11, name_en: 'Grade 11', name_jp: '11年生' },
      { level: 12, name_en: 'Grade 12', name_jp: '12年生' }
    ];
    
    for (const grade of gradeUpdates) {
      await gradesCollection.updateOne(
        { level: grade.level },
        { $set: { name_en: grade.name_en, name_jp: grade.name_jp } }
      );
    }
    console.log('✅ Updated existing grades with name_en and name_jp');
    
    // Check if "Other" grade already exists
    const otherExists = await gradesCollection.findOne({ level: 0 });
    if (!otherExists) {
      await gradesCollection.insertOne({
        name: 'Khác',
        name_en: 'Other',
        name_jp: 'その他',
        level: 0
      });
      console.log('✅ Added Other grade');
    } else {
      // Update if exists but missing translations
      await gradesCollection.updateOne(
        { level: 0 },
        { $set: { name: 'Khác', name_en: 'Other', name_jp: 'その他' } }
      );
      console.log('✅ Other grade already exists, updated translations');
    }
    
    console.log('✅ Successfully completed grades translation migration');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

const down = async (db, client) => {
  console.log('Rolling back grades translations...');
  
  try {
    const gradesCollection = db.collection('grades');
    
    // Remove translation fields from all grades
    await gradesCollection.updateMany(
      {},
      { $unset: { name_en: '', name_jp: '' } }
    );
    console.log('✅ Removed name_en and name_jp fields');
    
    // Remove Other grade
    await gradesCollection.deleteOne({ level: 0 });
    console.log('✅ Removed Other grade');
    
    console.log('✅ Successfully rolled back migration');
  } catch (error) {
    console.error('❌ Error during rollback:', error);
    throw error;
  }
};

module.exports = { up, down };

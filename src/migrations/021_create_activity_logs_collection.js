/**
 * Migration: Create ActivityLogs collection
 * Purpose: Track student activities during exam for security and monitoring
 * 
 * This migration creates a new collection to store activity logs for exam submissions.
 * Activities include: answer changes, tab switches, copy/paste attempts, etc.
 */

module.exports = {
  async up(db) {
    console.log('Creating ActivityLogs collection with indexes...');
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'activitylogs' }).toArray();
    
    if (collections.length === 0) {
      // Create the collection
      await db.createCollection('activitylogs', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['submissionId', 'examId', 'userId', 'type', 'action', 'timestamp'],
          properties: {
            submissionId: {
              bsonType: 'objectId',
              description: 'Reference to Submission - required'
            },
            examId: {
              bsonType: 'objectId',
              description: 'Reference to Exam - required'
            },
            userId: {
              bsonType: 'objectId',
              description: 'Reference to User - required'
            },
            type: {
              enum: [
                'start', 'answer', 'change', 'submit', 
                'tab_switch', 'window_blur', 'copy_attempt', 
                'paste_attempt', 'right_click', 'fullscreen_exit', 
                'screenshot', 'auto_save'
              ],
              description: 'Type of activity - required'
            },
            action: {
              bsonType: 'string',
              description: 'Description of the action - required'
            },
            details: {
              bsonType: 'object',
              description: 'Additional details about the activity'
            },
            timestamp: {
              bsonType: 'date',
              description: 'When the activity occurred - required'
            },
            isSuspicious: {
              bsonType: 'bool',
              description: 'Whether this activity is suspicious'
            },
            severity: {
              enum: ['low', 'medium', 'high'],
              description: 'Severity level of the activity'
            },
            createdAt: {
              bsonType: 'date'
            },
            updatedAt: {
              bsonType: 'date'
            }
          }
        }
      }
      });
      console.log('ActivityLogs collection created');
    } else {
      console.log('ActivityLogs collection already exists, skipping creation');
    }
    
    // Create indexes for performance (skip if already exist)
    const indexes = [
      { keys: { submissionId: 1 }, options: { name: 'idx_submission_id' } },
      { keys: { examId: 1 }, options: { name: 'idx_exam_id' } },
      { keys: { userId: 1 }, options: { name: 'idx_user_id' } },
      { keys: { type: 1 }, options: { name: 'idx_type' } },
      { keys: { timestamp: 1 }, options: { name: 'idx_timestamp' } },
      { keys: { isSuspicious: 1 }, options: { name: 'idx_is_suspicious' } },
      { keys: { submissionId: 1, timestamp: 1 }, options: { name: 'idx_submission_timestamp' } },
      { keys: { examId: 1, userId: 1 }, options: { name: 'idx_exam_user' } },
      { keys: { userId: 1, isSuspicious: 1 }, options: { name: 'idx_user_suspicious' } },
      { keys: { type: 1, timestamp: -1 }, options: { name: 'idx_type_timestamp_desc' } }
    ];
    
    for (const index of indexes) {
      try {
        await db.collection('activitylogs').createIndex(index.keys, index.options);
        console.log(`Created index: ${index.options.name}`);
      } catch (error) {
        if (error.code === 85 || error.message.includes('already exists')) {
          console.log(`Index ${index.options.name} already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('ActivityLogs collection setup completed successfully');
  },

  async down(db) {
    console.log('Dropping ActivityLogs collection...');
    await db.collection('activitylogs').drop();
    console.log('ActivityLogs collection dropped successfully');
  }
};


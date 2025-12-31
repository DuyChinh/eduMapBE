const Organization = require('./Organization');
const User = require('./User');
const Class = require('./Class');
const Question = require('./Question');
const Exam = require('./Exam');
const Subject = require('./Subject');
const Grade = require('./Grade');

const Assignment = require('./Assignment');
const Submission = require('./Submission');
const ProctorLog = require('./ProctorLog');
const Mindmap = require('./Mindmap');
const ResetToken = require('./ResetToken');
const ActivityLog = require('./ActivityLog');
const ChatHistory = require('./ChatHistory');
const ChatSession = require('./ChatSession');
const mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE_MG_URL);

module.exports = {
  Organization,
  User,
  Class,
  Question,
  Exam,
  Subject,
  Grade,
  Assignment,
  Submission,
  ProctorLog,
  Mindmap,
  ResetToken,
  ActivityLog,
  ChatHistory,
  ChatSession
};
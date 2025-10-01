const Organization = require('./Organization');
const User = require('./User');
const Class = require('./Class');
const Question = require('./Question');
const Exam = require('./Exam');
const Assignment = require('./Assignment');
const Submission = require('./Submission');
const ProctorLog = require('./ProctorLog');
const Mindmap = require('./Mindmap');
const mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE_MG_URL);

module.exports = {
  Organization,
  User,
  Class,
  Question,
  Exam,
  Assignment,
  Submission,
  ProctorLog,
  Mindmap
};
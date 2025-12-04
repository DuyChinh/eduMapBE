const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const userRoutes = require('./users');
const questionRoutes = require('./questions');
const classRoutes = require('./classes');
const subjectRoutes = require('./subjects');
const examRoutes = require('./exams');
const submissionRoutes = require('./submissions');
const proctorRoutes = require('./proctor');
const reportRoutes = require('./reports');
const examResultsRoutes = require('./examResults');
const aiRoutes = require('./ai');

const configureRoutes = (app) => {
    const v1 = express.Router();
    app.use('/v1/api', v1);
    v1.use('/auth', authRoutes);
    v1.use('/users', userRoutes);
    v1.use('/questions', questionRoutes);
    v1.use('/subjects', subjectRoutes);
    v1.use('/classes', classRoutes);
    v1.use('/exams', examRoutes);
    v1.use('/submissions', submissionRoutes);
    v1.use('/proctor', proctorRoutes);
    v1.use('/reports', reportRoutes);
    v1.use('/exam-results', examResultsRoutes);
    v1.use('/ai', aiRoutes);
    
    // Admin API routes
    const adminRoutes = require('./admin');
    v1.use('/admin', adminRoutes);

    v1.use((req, res) => {
        res.status(404).json({
            message: 'API endpoint not found'
        });
    });
};

module.exports = configureRoutes;
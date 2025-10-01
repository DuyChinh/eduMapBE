const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const userRoutes = require('./users');

const configureRoutes = (app) => {
    const v1 = express.Router();
    app.use('/v1/api', v1);

    //   v1.use('/', (req, res) => {
    //     res.send('Welcome to the API EduMap');
    //   });
    v1.use('/users', userRoutes);

    v1.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
    });
};

module.exports = configureRoutes;
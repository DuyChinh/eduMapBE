const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/', function(req, res) {
    res.send('Welcome to the Home Page');
});

router.get('/health', async function(req, res) {    
    try {
        const conn = await mongoose.connect(process.env.DATABASE_MG_URL);
        console.log('Database connected:', conn.connection.host);
        
        
        res.send('connect success!');
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
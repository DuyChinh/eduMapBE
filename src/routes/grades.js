const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

// Get all grades
router.get('/', async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const gradesCollection = db.collection('grades');
    
    // Get all grades sorted by level
    const grades = await gradesCollection.find({}).sort({ level: 1 }).toArray();
    
    res.json({ ok: true, data: grades });
  } catch (error) {
    console.error('Error fetching grades:', error);
    next(error);
  }
});

module.exports = router;

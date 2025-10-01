const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Define user-related routes here
router.get('/profile', userController.getProfile);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateProfile);
router.delete('/:id', userController.deleteAccount);

module.exports = router;
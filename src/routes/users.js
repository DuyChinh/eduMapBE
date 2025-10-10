const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/auth');

// Apply auth middleware to all user routes
router.use(authMiddleware);

// Define user-related routes here
router.get('/profile', userController.getProfile);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateProfile);
router.patch('/:id/role', userController.updateUserRole);
router.delete('/:id', userController.deleteAccount);

module.exports = router;
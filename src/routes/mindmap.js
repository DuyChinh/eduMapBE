const express = require('express');
const router = express.Router();
const mindmapController = require('../controllers/mindmapController');
const auth = require('../middlewares/auth');

// Create a new mindmap
router.post('/', auth, mindmapController.create);

// Get all mindmaps for the current user
router.get('/', auth, mindmapController.getAll);

// Get trash (Must be before /:id)
router.get('/trash', auth, mindmapController.getTrash);

// Get a single mindmap by ID
router.get('/:id', auth, mindmapController.getOne);

// Update a mindmap
router.put('/:id', auth, mindmapController.update);

// Delete a mindmap
router.delete('/:id', auth, mindmapController.delete);

// Restore a mindmap
router.put('/:id/restore', auth, mindmapController.restore);

// Permanently delete a mindmap
router.delete('/:id/permanent', auth, mindmapController.permanentDelete);

module.exports = router;

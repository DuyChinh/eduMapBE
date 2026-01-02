const express = require('express');
const router = express.Router();
const mindmapController = require('../controllers/mindmapController');
const auth = require('../middlewares/auth');

// Create a new mindmap
router.post('/', auth, mindmapController.create);
// Generate mindmap with AI
router.post('/generate-ai', auth, mindmapController.generateWithAI);
// Generate mindmap from exam review
router.post('/generate-review', auth, mindmapController.generateFromExamReview);

// Get all mindmaps for the current user
router.get('/', auth, mindmapController.getAll);

// Get trash (Must be before /:id)
router.get('/trash', auth, mindmapController.getTrash);

// Get shared mindmaps (Must be before /:id)
router.get('/shared', auth, mindmapController.getShared);

// Get mindmap by public share link (no auth required)
router.get('/public/:shareLink', mindmapController.getByShareLink);
// Update mindmap by public share link (no auth required, but checks public_permission)
router.put('/public/:shareLink', mindmapController.updateByShareLink);

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

// Share routes
router.get('/:id/share', auth, mindmapController.getShareInfo);
router.post('/:id/share', auth, mindmapController.shareMindmap);
router.delete('/:id/share/:shareUserId', auth, mindmapController.unshareMindmap);
router.post('/:id/toggle-public', auth, mindmapController.togglePublic);

module.exports = router;


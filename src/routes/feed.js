const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');
const auth = require('../middlewares/auth');

// Get/Create posts for a class
router.get('/:classId', auth, feedController.getPosts);
router.post('/:classId', auth, feedController.createPost);

// Interact with posts
router.get('/posts/:postId', auth, feedController.getPost); // New route
router.delete('/posts/:postId', auth, feedController.deletePost);
router.put('/posts/:postId', auth, feedController.updatePost);
router.patch('/posts/:postId/lock', auth, feedController.toggleLock);
router.post('/posts/:postId/reaction', auth, feedController.toggleReaction);

// Comments
router.post('/posts/:postId/comments', auth, feedController.addComment);
router.delete('/posts/:postId/comments/:commentId', auth, feedController.deleteComment);
router.put('/posts/:postId/comments/:commentId', auth, feedController.updateComment);
router.post('/posts/:postId/comments/:commentId/reaction', auth, feedController.toggleCommentReaction);

// Class members for @mention
router.get('/:classId/members', auth, feedController.getClassMembers);

module.exports = router;

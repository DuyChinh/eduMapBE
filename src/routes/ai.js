const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const auth = require('../middlewares/auth');

const upload = require('../middlewares/upload');

// Chat endpoint
// Protected by auth middleware to ensure only logged-in users can use it
router.post('/chat', auth, upload.array('files', 5), aiController.chat);
router.get('/history/:sessionId', auth, aiController.getHistory);
router.get('/sessions', auth, aiController.getSessions);
router.post('/sessions', auth, aiController.createSession);
router.delete('/sessions/:sessionId', auth, aiController.deleteSession);
router.patch('/sessions/:sessionId', auth, aiController.renameSession);
router.put('/message/:messageId', auth, aiController.editMessage);

module.exports = router;

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const auth = require('../middlewares/auth');

const upload = require('../middlewares/upload');

router.post('/chat', auth, upload.array('files', 5), aiController.chat);
router.get('/history/:sessionId', auth, aiController.getHistory);
router.get('/message/:messageId/status', auth, aiController.checkMessageStatus);
router.get('/sessions', auth, aiController.getSessions);
router.get('/sessions/search', auth, aiController.searchSessions);
router.post('/sessions', auth, aiController.createSession);
router.delete('/sessions/:sessionId', auth, aiController.deleteSession);
router.patch('/sessions/:sessionId', auth, aiController.renameSession);
router.patch('/sessions/:sessionId/toggle-pin', auth, aiController.togglePinSession);
router.put('/message/:messageId', auth, aiController.editMessage);

module.exports = router;

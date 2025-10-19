const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const auth = require('../middlewares/auth');



router.get('/', auth, questionController.getAllQuestions);
router.get('/:id', auth, questionController.getQuestionById);
router.post('/', auth, questionController.create);
router.put('/:id', auth, questionController.update);
router.patch('/:id', auth, questionController.patch);
router.delete('/:id', auth, questionController.remove);

module.exports = router;

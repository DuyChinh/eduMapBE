const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const auth = require('../middlewares/auth');

router.post('/', auth, subjectController.createSubject);
router.get('/', auth, subjectController.getAllSubjects);
router.get('/:id', auth, subjectController.getSubjectById);
router.put('/:id', auth, subjectController.updateSubject);
router.delete('/:id', auth, subjectController.deleteSubject);

module.exports = router;

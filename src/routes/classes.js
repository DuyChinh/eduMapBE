const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const auth = require('../middlewares/auth');

router.post('/', auth, classController.create);

router.get('/', auth, classController.list);
router.get('/search', auth, classController.search);
router.get('/mine', auth, classController.mine);
router.get('/:id', auth, classController.getOne);
router.patch('/:id', auth, classController.patch);
router.delete('/:id', auth, classController.remove);

// tiện ích
router.post('/:id/regenerate-code', auth, classController.regenerateCode);

// giáo viên hoặc admin thêm nhiều học sinh vào lớp
router.post('/:id/students/bulk', auth, classController.addStudents);


// student join bằng code
router.post('/join', auth, classController.join);

module.exports = router;

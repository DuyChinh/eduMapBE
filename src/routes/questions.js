const express = require('express');
const multer = require('multer');
const router = express.Router();
const questionController = require('../controllers/questionController');
const questionImportExportController = require('../controllers/questionImportExportController');
const auth = require('../middlewares/auth');

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.originalname.split('.').pop().toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Import/Export routes (must be before /:id route)
router.get('/export', auth, questionImportExportController.exportQuestions);
router.get('/template', auth, questionImportExportController.downloadTemplate);
router.post('/import', auth, upload.single('file'), questionImportExportController.importQuestions);

router.get('/', auth, questionController.getAllQuestions);
router.post('/batch-rename', auth, questionController.batchRename);
router.get('/:id', auth, questionController.getQuestionById);
router.post('/', auth, questionController.create);
router.put('/:id', auth, questionController.update);
router.patch('/:id', auth, questionController.patch);
router.delete('/:id', auth, questionController.remove);

module.exports = router;

const pdfParserService = require('../services/pdfParserService');
const Question = require('../models/Question');
const Exam = require('../models/Exam');
const Subject = require('../models/Subject');

/**
 * Generates a unique share code for exams
 * @returns {Promise<string>} - Unique 8-character alphanumeric code
 */
async function generateUniqueShareCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let shareCode;
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 20) {
    // Generate 8-character code
    shareCode = '';
    for (let i = 0; i < 8; i++) {
      shareCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if code already exists
    const existing = await Exam.findOne({ shareCode });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) {
    // Fallback: use timestamp-based code
    shareCode = Date.now().toString(36).toUpperCase().slice(-8);
  }
  
  return shareCode;
}

/**
 * Upload và parse PDF exam
 * POST /v1/api/exams/upload-pdf
 */
exports.uploadAndParse = async (req, res, next) => {
  try {
    // Check user role
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({
        ok: false,
        message: 'Only teachers and admins can upload PDF exams'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: 'No PDF file uploaded'
      });
    }

    // Validate file type
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        ok: false,
        message: 'Only PDF files are allowed'
      });
    }

    console.log(`Processing PDF: ${req.file.originalname}, size: ${req.file.size} bytes`);

    const parsedData = await pdfParserService.parsePDF(req.file.buffer, req.file.originalname);

    // Count total questions found
    const totalQuestions = parsedData.pages.reduce(
      (sum, page) => sum + page.questions.length,
      0
    );

    console.log(`Successfully parsed PDF: ${totalQuestions} questions found across ${parsedData.pages.length} pages`);

    return res.status(200).json({
      ok: true,
      message: `Successfully parsed ${totalQuestions} questions from PDF`,
      data: {
        filename: req.file.originalname,
        totalPages: parsedData.pages.length,
        totalQuestions,
        pages: parsedData.pages
      }
    });
  } catch (error) {
    console.error('Error in uploadAndParse:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Failed to parse PDF',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Create exam from parsed PDF data
 * POST /v1/api/exams/create-from-pdf
 */
exports.createExamFromPDF = async (req, res, next) => {
  try {
    console.log('=== Create Exam From PDF ===');
    console.log('User:', {
      _id: req.user?._id,
      id: req.user?.id,
      role: req.user?.role,
      orgId: req.user?.orgId
    });

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        ok: false,
        message: 'User authentication failed. Please login again.'
      });
    }

    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({
        ok: false,
        message: 'Only teachers and admins can create exams'
      });
    }

    const {
      examName,
      examDescription,
      subjectId,
      gradeId,
      duration,
      totalMarks,
      questions: parsedQuestions,
      examPurpose,
      isAllowUser,
      maxAttempts,
      viewMark,
      viewExamAndAnswer,
      status
    } = req.body;

    // Validation
    if (!examName || !subjectId || !duration || !totalMarks) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required fields: examName, subjectId, duration, totalMarks'
      });
    }

    if (!parsedQuestions || !Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'No questions provided'
      });
    }

    // Verify subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        ok: false,
        message: 'Subject not found'
      });
    }

    console.log(`Creating exam from PDF: ${examName}, ${parsedQuestions.length} questions`);

    // Step 1: Create Questions in database
    const createdQuestions = [];
    const marksPerQuestion = totalMarks / parsedQuestions.length;

    for (const pq of parsedQuestions) {
      if (!pq.questionText) {
        console.warn(`Skipping question without text: ${JSON.stringify(pq)}`);
        continue;
      }

      const isMultipleChoice = pq.answers && pq.answers.length > 0;
      const questionType = isMultipleChoice ? 'mcq' : 'essay';
      const correctAnswer = isMultipleChoice 
        ? (pq.correctAnswer || pq.answers[0].key)
        : '';

      const questionData = {
        name: `Câu ${pq.questionNumber || createdQuestions.length + 1}`,
        text: pq.questionText,
        type: questionType,
        choices: isMultipleChoice ? pq.answers.map(ans => ({
          key: ans.key,
          text: ans.text
        })) : [],
        answer: correctAnswer,
        explanation: pq.explanation || '',
        subjectId: subjectId,
        level: pq.level || 1,
        tags: pq.tags || [],
        ownerId: req.user._id,
        orgId: req.user.orgId || null,
        isPublic: false
      };

      console.log(`Creating question ${createdQuestions.length + 1}:`, {
        name: questionData.name,
        type: questionData.type,
        ownerId: questionData.ownerId,
        ownerIdType: typeof questionData.ownerId
      });

      const question = new Question(questionData);
      const savedQuestion = await question.save();
      createdQuestions.push({
        questionId: savedQuestion._id,
        order: createdQuestions.length + 1,
        marks: marksPerQuestion,
        isRequired: true
      });
    }

    console.log(`Created ${createdQuestions.length} questions in database`);

    // Step 2: Generate shareCode if status is published
    const examStatus = status || 'published';
    let shareCode = null;
    if (examStatus === 'published') {
      shareCode = await generateUniqueShareCode();
    }

    // Step 3: Create Exam
    const exam = new Exam({
      name: examName,
      description: examDescription || `Đề thi từ PDF - ${examName}`,
      duration: duration,
      totalMarks: totalMarks,
      subjectId: subjectId,
      gradeId: gradeId || null,
      questions: createdQuestions,
      ownerId: req.user._id || req.user.id,
      orgId: req.user.orgId || null,
      examPurpose: examPurpose || 'exam',
      isAllowUser: isAllowUser || 'everyone', // Must be 'everyone', 'class', or 'student'
      maxAttempts: maxAttempts || 1,
      viewMark: viewMark !== undefined ? viewMark : 1,
      viewExamAndAnswer: viewExamAndAnswer !== undefined ? viewExamAndAnswer : 1,
      status: examStatus,
      shareCode: shareCode
    });

    const savedExam = await exam.save();

    console.log(`Successfully created exam: ${savedExam._id}`);

    return res.status(201).json({
      ok: true,
      message: 'Exam created successfully from PDF',
      data: {
        examId: savedExam._id,
        questionsCreated: createdQuestions.length,
        exam: savedExam
      }
    });
  } catch (error) {
    console.error('Error in createExamFromPDF:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Failed to create exam from PDF',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


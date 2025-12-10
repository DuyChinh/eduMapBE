const pdfParserService = require('../services/pdfParserService');
const Question = require('../models/Question');
const Exam = require('../models/Exam');
const Subject = require('../models/Subject');

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

    // Parse PDF
    const parsedData = await pdfParserService.parsePDF(req.file.buffer);

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
    // Check user role
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
      questions: parsedQuestions
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
      // Validate question has required fields
      if (!pq.questionText || !pq.answers || pq.answers.length === 0) {
        console.warn(`Skipping invalid question: ${JSON.stringify(pq)}`);
        continue;
      }

      // Find correct answer (default to first one if not specified)
      const correctAnswer = pq.correctAnswer || pq.answers[0].key;

      // Create question document
      const question = new Question({
        name: `Câu ${pq.questionNumber || createdQuestions.length + 1}`,
        text: pq.questionText,
        type: 'mcq',
        choices: pq.answers.map(ans => ({
          key: ans.key,
          text: ans.text
        })),
        answer: correctAnswer,
        explanation: pq.explanation || '',
        subjectId: subjectId,
        level: pq.level || 1,
        tags: pq.tags || [],
        createdBy: req.user._id,
        orgId: req.user.orgId || null,
        isPublic: false
      });

      const savedQuestion = await question.save();
      createdQuestions.push({
        questionId: savedQuestion._id,
        order: createdQuestions.length + 1,
        marks: marksPerQuestion,
        isRequired: true
      });
    }

    console.log(`Created ${createdQuestions.length} questions in database`);

    // Step 2: Create Exam
    const exam = new Exam({
      name: examName,
      description: examDescription || `Đề thi từ PDF - ${examName}`,
      duration: duration,
      totalMarks: totalMarks,
      subjectId: subjectId,
      gradeId: gradeId || null,
      questions: createdQuestions,
      createdBy: req.user._id,
      orgId: req.user.orgId || null,
      examPurpose: 'exam',
      isAllowUser: 'all',
      viewMark: 0,
      viewExamAndAnswer: 0,
      status: 'draft' // Start as draft
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


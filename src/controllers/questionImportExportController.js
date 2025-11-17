const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Subject = require('../models/Subject');
const service = require('../services/questionService');

const getOrgIdSoft = (req) =>
  req.user?.orgId || req.user?.org?.id || req.query.orgId || null;

/**
 * Download template Excel/CSV file for importing questions
 */
async function downloadTemplate(req, res, next) {
  try {
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const format = req.query.format || 'xlsx'; // xlsx or csv

    // Create template data
    const templateData = [
      {
        'Name': 'Sample Question 1',
        'Type': 'mcq',
        'Text': 'What is 2 + 2?',
        'Choice A': '3',
        'Choice B': '4',
        'Choice C': '5',
        'Choice D': '',
        'Choice E': '',
        'Answer': 'B',
        'Explanation': '2 + 2 = 4',
        'Subject Code': 'MATH',
        'Level': '1',
        'Tags': 'math,addition',
        'Is Public': 'false'
      },
      {
        'Name': 'Sample Question 2',
        'Type': 'tf',
        'Text': 'The Earth is round.',
        'Choice A': '',
        'Choice B': '',
        'Choice C': '',
        'Choice D': '',
        'Choice E': '',
        'Answer': 'true',
        'Explanation': 'The Earth is approximately spherical.',
        'Subject Code': 'GEO',
        'Level': '1',
        'Tags': 'geography',
        'Is Public': 'false'
      },
      {
        'Name': 'Sample Question 3',
        'Type': 'short',
        'Text': 'What is the capital of France?',
        'Choice A': '',
        'Choice B': '',
        'Choice C': '',
        'Choice D': '',
        'Choice E': '',
        'Answer': 'Paris',
        'Explanation': 'Paris is the capital city of France.',
        'Subject Code': 'GEO',
        'Level': '2',
        'Tags': 'geography,france',
        'Is Public': 'false'
      }
    ];

    if (format === 'csv') {
      // Generate CSV
      const headers = Object.keys(templateData[0]);
      const csvRows = [
        headers.join(','),
        ...templateData.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ];
      
      const csv = csvRows.join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="questions_template.csv"');
      res.send('\ufeff' + csv); // BOM for Excel UTF-8 support
    } else {
      // Generate Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Questions Template');
      
      // Set column widths
      const colWidths = [
        { wch: 20 }, // Name
        { wch: 10 }, // Type
        { wch: 40 }, // Text
        { wch: 15 }, // Choice A
        { wch: 15 }, // Choice B
        { wch: 15 }, // Choice C
        { wch: 15 }, // Choice D
        { wch: 15 }, // Choice E
        { wch: 10 }, // Answer
        { wch: 30 }, // Explanation
        { wch: 15 }, // Subject Code
        { wch: 10 }, // Level
        { wch: 20 }, // Tags
        { wch: 12 }  // Is Public
      ];
      ws['!cols'] = colWidths;
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="questions_template.xlsx"');
      res.send(buffer);
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Export questions to Excel/CSV
 */
async function exportQuestions(req, res, next) {
  try {
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const orgId = getOrgIdSoft(req);
    const format = req.query.format || 'xlsx'; // xlsx or csv
    const { subjectId, type, level } = req.query;

    // Build filter
    const filter = {};
    if (orgId && mongoose.isValidObjectId(orgId)) {
      filter.orgId = new mongoose.Types.ObjectId(orgId);
    }
    filter.ownerId = new mongoose.Types.ObjectId(req.user.id);

    if (subjectId && mongoose.isValidObjectId(subjectId)) {
      filter.subjectId = new mongoose.Types.ObjectId(subjectId);
    }
    if (type && ['mcq', 'tf', 'short', 'essay'].includes(type)) {
      filter.type = type;
    }
    if (level) {
      const levelNum = Number(level);
      if (!isNaN(levelNum) && levelNum >= 1 && levelNum <= 5) {
        filter.level = levelNum;
      }
    }

    // Fetch questions
    const questions = await Question.find(filter)
      .populate('subjectId', 'name name_en name_jp code')
      .sort({ createdAt: -1 })
      .lean();

    // Transform to export format
    const exportData = questions.map(q => {
      const row = {
        'Name': q.name || '',
        'Type': q.type || 'mcq',
        'Text': q.text || '',
        'Choice A': '',
        'Choice B': '',
        'Choice C': '',
        'Choice D': '',
        'Choice E': '',
        'Answer': '',
        'Explanation': q.explanation || '',
        'Subject Code': q.subjectId?.code || q.subjectCode || '',
        'Level': q.level || 1,
        'Tags': (q.tags || []).join(','),
        'Is Public': q.isPublic ? 'true' : 'false'
      };

      // Handle choices and answer based on type
      if (q.type === 'mcq' && Array.isArray(q.choices)) {
        const answerKeys = ['A', 'B', 'C', 'D', 'E'];
        q.choices.forEach((choice, index) => {
          const key = answerKeys[index];
          if (key) {
            row[`Choice ${key}`] = typeof choice === 'object' ? choice.text : choice;
          }
        });

        // Handle answer
        if (typeof q.answer === 'string') {
          row['Answer'] = q.answer;
        } else if (typeof q.answer === 'number') {
          row['Answer'] = answerKeys[q.answer] || '';
        } else if (Array.isArray(q.answer)) {
          row['Answer'] = q.answer.map(a => typeof a === 'number' ? answerKeys[a] : a).join(',');
        }
      } else if (q.type === 'tf') {
        row['Answer'] = q.answer === true || q.answer === 'true' ? 'true' : 'false';
      } else if (q.type === 'short' || q.type === 'essay') {
        if (Array.isArray(q.answer)) {
          row['Answer'] = q.answer.join('|');
        } else {
          row['Answer'] = String(q.answer || '');
        }
      }

      return row;
    });

    if (format === 'csv') {
      // Generate CSV
      if (exportData.length === 0) {
        exportData.push({
          'Name': '',
          'Type': '',
          'Text': '',
          'Choice A': '',
          'Choice B': '',
          'Choice C': '',
          'Choice D': '',
          'Choice E': '',
          'Answer': '',
          'Explanation': '',
          'Subject Code': '',
          'Level': '',
          'Tags': '',
          'Is Public': ''
        });
      }

      const headers = Object.keys(exportData[0]);
      const csvRows = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ];
      
      const csv = csvRows.join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="questions_export_${Date.now()}.csv"`);
      res.send('\ufeff' + csv); // BOM for Excel UTF-8 support
    } else {
      // Generate Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      
      // Set column widths
      const colWidths = [
        { wch: 20 }, // Name
        { wch: 10 }, // Type
        { wch: 40 }, // Text
        { wch: 15 }, // Choice A
        { wch: 15 }, // Choice B
        { wch: 15 }, // Choice C
        { wch: 15 }, // Choice D
        { wch: 15 }, // Choice E
        { wch: 10 }, // Answer
        { wch: 30 }, // Explanation
        { wch: 15 }, // Subject Code
        { wch: 10 }, // Level
        { wch: 20 }, // Tags
        { wch: 12 }  // Is Public
      ];
      ws['!cols'] = colWidths;
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="questions_export_${Date.now()}.xlsx"`);
      res.send(buffer);
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Import questions from Excel/CSV file
 */
async function importQuestions(req, res, next) {
  try {
    if (!['teacher', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No file uploaded' });
    }

    const orgId = getOrgIdSoft(req);
    const results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: []
    };

    let rows = [];
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();

    try {
      if (fileExtension === 'csv') {
        // Parse CSV - XLSX can handle CSV
        const workbook = XLSX.read(req.file.buffer, { 
          type: 'buffer',
          codepage: 65001 // UTF-8
        });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      } else if (['xlsx', 'xls'].includes(fileExtension)) {
        // Parse Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      } else {
        return res.status(400).json({ ok: false, message: 'Unsupported file format. Please use CSV or Excel (.xlsx, .xls)' });
      }
    } catch (parseError) {
      return res.status(400).json({ ok: false, message: 'Failed to parse file: ' + parseError.message });
    }

    results.total = rows.length;

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header, and array is 0-indexed

      try {
        // Extract data from row (handle different column name variations)
        const name = (row['Name'] || row['name'] || '').toString().trim();
        const type = (row['Type'] || row['type'] || 'mcq').toString().toLowerCase().trim();
        const text = (row['Text'] || row['text'] || '').toString().trim();
        const subjectCode = (row['Subject Code'] || row['subjectCode'] || row['Subject'] || '').toString().trim().toUpperCase();
        const level = parseInt(row['Level'] || row['level'] || '1');
        const tags = (row['Tags'] || row['tags'] || '').toString().trim();
        const explanation = (row['Explanation'] || row['explanation'] || '').toString().trim();
        const isPublic = (row['Is Public'] || row['isPublic'] || 'false').toString().toLowerCase() === 'true';

        // Validation
        if (!name) {
          results.errors.push({ row: rowNum, error: 'Name is required' });
          results.failed++;
          continue;
        }

        if (!text) {
          results.errors.push({ row: rowNum, error: 'Text is required' });
          results.failed++;
          continue;
        }

        if (!subjectCode) {
          results.errors.push({ row: rowNum, error: 'Subject Code is required' });
          results.failed++;
          continue;
        }

        if (!['mcq', 'tf', 'short', 'essay'].includes(type)) {
          results.errors.push({ row: rowNum, error: `Invalid type: ${type}. Must be mcq, tf, short, or essay` });
          results.failed++;
          continue;
        }

        // Find subject by code
        const subjectFilter = { code: subjectCode };
        if (orgId && mongoose.isValidObjectId(orgId)) {
          subjectFilter.orgId = new mongoose.Types.ObjectId(orgId);
        } else {
          subjectFilter.orgId = { $exists: false };
        }
        const subject = await Subject.findOne(subjectFilter);

        if (!subject) {
          results.errors.push({ row: rowNum, error: `Subject with code "${subjectCode}" not found` });
          results.failed++;
          continue;
        }

        // Build question payload
        const questionPayload = {
          name,
          text,
          type,
          subjectId: subject._id,
          subjectCode: subject.code,
          level: Math.max(1, Math.min(5, level || 1)),
          explanation: explanation || undefined,
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          isPublic,
          ownerId: req.user.id
        };

        if (orgId && mongoose.isValidObjectId(orgId)) {
          questionPayload.orgId = new mongoose.Types.ObjectId(orgId);
        }

        // Handle choices and answer based on type
        if (type === 'mcq') {
          const choices = [];
          const answerKeys = ['A', 'B', 'C', 'D', 'E'];
          
          answerKeys.forEach(key => {
            const choiceValue = (row[`Choice ${key}`] || row[`choice ${key.toLowerCase()}`] || '').toString().trim();
            if (choiceValue) {
              choices.push({
                key,
                text: choiceValue
              });
            }
          });

          if (choices.length < 2) {
            results.errors.push({ row: rowNum, error: 'MCQ questions must have at least 2 choices' });
            results.failed++;
            continue;
          }

          questionPayload.choices = choices;

          // Handle answer
          const answer = (row['Answer'] || row['answer'] || '').toString().trim().toUpperCase();
          if (!answer) {
            results.errors.push({ row: rowNum, error: 'Answer is required for MCQ' });
            results.failed++;
            continue;
          }

          // Check if answer is a valid choice key
          const validKeys = choices.map(c => c.key);
          if (!validKeys.includes(answer)) {
            results.errors.push({ row: rowNum, error: `Answer "${answer}" is not a valid choice key. Valid keys: ${validKeys.join(', ')}` });
            results.failed++;
            continue;
          }

          questionPayload.answer = answer;
        } else if (type === 'tf') {
          const answer = (row['Answer'] || row['answer'] || '').toString().toLowerCase().trim();
          if (answer !== 'true' && answer !== 'false') {
            results.errors.push({ row: rowNum, error: 'Answer for True/False must be "true" or "false"' });
            results.failed++;
            continue;
          }
          questionPayload.answer = answer === 'true';
        } else if (type === 'short' || type === 'essay') {
          const answer = (row['Answer'] || row['answer'] || '').toString().trim();
          if (!answer) {
            results.errors.push({ row: rowNum, error: 'Answer is required for short/essay questions' });
            results.failed++;
            continue;
          }
          // Support multiple answers separated by |
          if (answer.includes('|')) {
            questionPayload.answer = answer.split('|').map(a => a.trim()).filter(Boolean);
          } else {
            questionPayload.answer = answer;
          }
        }

        // Check for duplicate name
        const existingQuestion = await service.findByNameAndOwner({
          name: name.trim(),
          ownerId: req.user.id,
          orgId
        });

        if (existingQuestion) {
          results.errors.push({ row: rowNum, error: `Question with name "${name}" already exists` });
          results.failed++;
          continue;
        }

        // Validate question
        const { validateByType } = require('./questionController');
        const errors = validateByType(questionPayload);
        if (errors.length > 0) {
          results.errors.push({ row: rowNum, error: errors.join('; ') });
          results.failed++;
          continue;
        }

        // Create question
        await service.create({ payload: questionPayload, user: req.user });
        results.success++;
      } catch (error) {
        results.errors.push({ row: rowNum, error: error.message || 'Unknown error' });
        results.failed++;
      }
    }

    res.json({
      ok: true,
      message: `Import completed: ${results.success} succeeded, ${results.failed} failed out of ${results.total} total`,
      results
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  downloadTemplate,
  exportQuestions,
  importQuestions
};


const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
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

    const orgId = getOrgIdSoft(req);
    const format = req.query.format || 'xlsx'; // xlsx or csv

    // Fetch available subjects for reference
    const subjectFilter = {};
    if (orgId && mongoose.isValidObjectId(orgId)) {
      subjectFilter.orgId = new mongoose.Types.ObjectId(orgId);
    } else {
      subjectFilter.orgId = { $exists: false };
    }
    const subjects = await Subject.find(subjectFilter).sort({ name_en: 1, name: 1 }).lean();

    // Get subjects for sample data, prefer English names
    let mathSubject = 'Mathematics';
    let geoSubject = 'Geography';
    
    if (subjects.length > 0) {
      // Try to find Math and Geography subjects
      const mathSubjectObj = subjects.find(s => 
        (s.code || '').toUpperCase().includes('MATH') || 
        (s.name_en || '').toLowerCase().includes('math') ||
        (s.name || '').toLowerCase().includes('toán')
      );
      const geoSubjectObj = subjects.find(s => 
        (s.code || '').toUpperCase().includes('GEO') || 
        (s.name_en || '').toLowerCase().includes('geo') ||
        (s.name || '').toLowerCase().includes('địa')
      );
      
      if (mathSubjectObj) {
        mathSubject = mathSubjectObj.name_en || mathSubjectObj.name || 'Mathematics';
      }
      if (geoSubjectObj) {
        geoSubject = geoSubjectObj.name_en || geoSubjectObj.name || 'Geography';
      }
      
      // Fallback: use first available subject if specific ones not found
      if (!mathSubjectObj && subjects.length > 0) {
        mathSubject = subjects[0].name_en || subjects[0].name || 'Mathematics';
      }
      if (!geoSubjectObj && subjects.length > 1) {
        geoSubject = subjects[1].name_en || subjects[1].name || 'Geography';
      } else if (!geoSubjectObj && subjects.length > 0) {
        geoSubject = subjects[0].name_en || subjects[0].name || 'Geography';
      }
    }

    // Create template data with Subject Name in English
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
        'Subject Name': mathSubject,
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
        'Subject Name': geoSubject,
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
        'Subject Name': geoSubject,
        'Level': '2',
        'Tags': 'geography,france',
        'Is Public': 'false'
      },
      {
        'Name': 'Sample Question 4 - MathJax',
        'Type': 'mcq',
        'Text': 'What is the value of $\\frac{3}{4} + \\frac{1}{2}$?',
        'Choice A': '$\\frac{1}{4}$',
        'Choice B': '$\\frac{5}{4}$',
        'Choice C': '$\\frac{4}{6}$',
        'Choice D': '$1$',
        'Choice E': '',
        'Answer': 'B',
        'Explanation': '$\\frac{3}{4} + \\frac{1}{2} = \\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}$',
        'Subject Name': mathSubject,
        'Level': '2',
        'Tags': 'math,fractions,mathjax',
        'Is Public': 'false'
      },
      {
        'Name': 'Sample Question 5 - Essay',
        'Type': 'essay',
        'Text': 'Explain the causes and effects of climate change. Discuss at least three main factors.',
        'Choice A': '',
        'Choice B': '',
        'Choice C': '',
        'Choice D': '',
        'Choice E': '',
        'Answer': 'Students should mention: 1) Greenhouse gas emissions from fossil fuels, 2) Deforestation reducing CO2 absorption, 3) Industrial activities. Effects include rising temperatures, sea level rise, and extreme weather events.',
        'Explanation': 'A comprehensive answer should cover multiple causes (human activities, industrial emissions) and effects (environmental, social, economic impacts).',
        'Subject Name': geoSubject,
        'Level': '3',
        'Tags': 'geography,essay,climate',
        'Is Public': 'false'
      }
    ];

    if (format === 'csv') {
      // Generate CSV with instruction header
      const headers = Object.keys(templateData[0]);
      const typeInstruction = '# Type: mcq (Multiple Choice), tf (True/False), short (Short Answer), essay (Essay)';
      const subjectInstruction = subjects.length > 0 
        ? `# Available Subjects: ${subjects.map(s => s.name).join(', ')}`
        : '# Subject Name: Use the exact name of your subject';
      const mathJaxInstruction = '# MathJax Support: Use $...$ for inline math (e.g., $\\frac{3}{4}$), $$...$$ for block math. Example: What is $\\frac{3}{4} + \\frac{1}{2}$?';
      
      const csvRows = [
        typeInstruction,
        subjectInstruction,
        mathJaxInstruction,
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
      // Generate Excel with ExcelJS for data validation support
      const workbook = new ExcelJS.Workbook();
      
      // ========== Questions Sheet ==========
      const questionsSheet = workbook.addWorksheet('Questions');
      
      // Define columns
      questionsSheet.columns = [
        { header: 'Name', key: 'name', width: 20 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Text', key: 'text', width: 40 },
        { header: 'Choice A', key: 'choiceA', width: 15 },
        { header: 'Choice B', key: 'choiceB', width: 15 },
        { header: 'Choice C', key: 'choiceC', width: 15 },
        { header: 'Choice D', key: 'choiceD', width: 15 },
        { header: 'Choice E', key: 'choiceE', width: 15 },
        { header: 'Answer', key: 'answer', width: 12 },
        { header: 'Explanation', key: 'explanation', width: 30 },
        { header: 'Subject Name', key: 'subjectName', width: 25 },
        { header: 'Level', key: 'level', width: 10 },
        { header: 'Tags', key: 'tags', width: 20 },
        { header: 'Is Public', key: 'isPublic', width: 12 }
      ];
      
      // Add sample data
      templateData.forEach(data => {
        questionsSheet.addRow({
          name: data['Name'],
          type: data['Type'],
          text: data['Text'],
          choiceA: data['Choice A'],
          choiceB: data['Choice B'],
          choiceC: data['Choice C'],
          choiceD: data['Choice D'],
          choiceE: data['Choice E'],
          answer: data['Answer'],
          explanation: data['Explanation'],
          subjectName: data['Subject Name'],
          level: data['Level'],
          tags: data['Tags'],
          isPublic: data['Is Public']
        });
      });
      
      // Style header row
      const headerRow = questionsSheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Add data validation for Type column (Column B)
      const typeOptions = ['mcq', 'tf', 'short', 'essay'];
      for (let i = 2; i <= 1000; i++) { // Apply to 1000 rows
        questionsSheet.getCell(`B${i}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"' + typeOptions.join(',') + '"'],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Invalid Type',
          error: 'Please select from the dropdown: mcq, tf, short, essay'
        };
      }
      
      // Add data validation for Subject Name column (Column K)
      if (subjects.length > 0) {
        // Collect all possible subject names (prioritize English, then other languages)
        const subjectNames = [];
        subjects.forEach(s => {
          // Add English name first (preferred)
          if (s.name_en) subjectNames.push(s.name_en);
          // Add default name if different from English
          if (s.name && s.name !== s.name_en) subjectNames.push(s.name);
          // Add Japanese name if different from others
          if (s.name_jp && s.name_jp !== s.name_en && s.name_jp !== s.name) subjectNames.push(s.name_jp);
        });
        
        // If list is too long (>255 chars), use reference to hidden sheet
        const subjectNamesStr = subjectNames.join(',');
        if (subjectNamesStr.length < 255) {
          // Direct list validation
          for (let i = 2; i <= 1000; i++) {
            questionsSheet.getCell(`K${i}`).dataValidation = {
              type: 'list',
              allowBlank: false,
              formulae: ['"' + subjectNamesStr + '"'],
              showErrorMessage: true,
              errorStyle: 'warning',
              errorTitle: 'Subject Not Found',
              error: 'Please select a subject from the dropdown or check Available Subjects sheet'
            };
          }
        } else {
          // Use reference to another sheet for long lists
          // Create a hidden sheet for subject names
          const subjectListSheet = workbook.addWorksheet('_SubjectList', { 
            state: 'hidden' 
          });
          subjectNames.forEach((name, index) => {
            subjectListSheet.getCell(`A${index + 1}`).value = name;
          });
          
          // Reference the hidden sheet
          for (let i = 2; i <= 1000; i++) {
            questionsSheet.getCell(`K${i}`).dataValidation = {
              type: 'list',
              allowBlank: false,
              formulae: [`_SubjectList!$A$1:$A$${subjectNames.length}`],
              showErrorMessage: true,
              errorStyle: 'warning',
              errorTitle: 'Subject Not Found',
              error: 'Please select a subject from the dropdown'
            };
          }
        }
      }
      
      // Add data validation for Level column (Column L)
      for (let i = 2; i <= 1000; i++) {
        questionsSheet.getCell(`L${i}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"1,2,3,4,5"'],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Invalid Level',
          error: 'Please select level from 1 to 5'
        };
      }
      
      // Add data validation for Is Public column (Column N)
      for (let i = 2; i <= 1000; i++) {
        questionsSheet.getCell(`N${i}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"true,false"'],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Invalid Value',
          error: 'Please select true or false'
        };
      }
      
      // ========== Instructions Sheet ==========
      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.columns = [
        { header: 'Field', key: 'field', width: 20 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Example', key: 'example', width: 30 }
      ];
      
      const instructions = [
        { field: 'Name', description: 'Question name/title (required)', example: 'Sample Question 1' },
        { field: 'Type', description: 'Question type: mcq, tf, short, essay (dropdown available)', example: 'mcq' },
        { field: 'Text', description: 'Question text/description (required). Supports MathJax: use $...$ for inline math, $$...$$ for block math', example: 'What is $\\frac{3}{4} + \\frac{1}{2}$?' },
        { field: 'Choice A-E', description: 'For MCQ: answer choices (at least 2). Also supports MathJax', example: '$\\frac{5}{4}$' },
        { field: 'Answer', description: 'For MCQ: letter (A-E), TF: true/false, Other: text', example: 'B' },
        { field: 'Explanation', description: 'Explanation of the correct answer. Supports MathJax', example: '$\\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}$' },
        { field: 'Subject Name', description: 'Subject name in any language (dropdown available)', example: 'Mathematics or Math or 数学' },
        { field: 'Level', description: 'Difficulty level 1-5 (dropdown available)', example: '1' },
        { field: 'Tags', description: 'Comma-separated tags', example: 'math,fractions,mathjax' },
        { field: 'Is Public', description: 'true or false (dropdown available)', example: 'false' }
      ];
      
      instructions.forEach(inst => instructionsSheet.addRow(inst));
      
      // Style instructions header
      const instHeaderRow = instructionsSheet.getRow(1);
      instHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      instHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' }
      };
      
      // ========== Available Subjects Sheet ==========
      if (subjects.length > 0) {
        const subjectsSheet = workbook.addWorksheet('Available Subjects');
        subjectsSheet.columns = [
          { header: 'Subject Name (Default)', key: 'nameDefault', width: 25 },
          { header: 'Subject Name (English)', key: 'nameEn', width: 25 },
          { header: 'Subject Name (Japanese)', key: 'nameJp', width: 25 },
          { header: 'Subject Code', key: 'code', width: 15 },
          { header: 'Grade', key: 'grade', width: 15 }
        ];
        
        // Sort subjects by English name for better readability
        const sortedSubjects = subjects.sort((a, b) => {
          const nameA = (a.name_en || a.name || '').toLowerCase();
          const nameB = (b.name_en || b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
        sortedSubjects.forEach(s => {
          subjectsSheet.addRow({
            nameDefault: s.name || '',
            nameEn: s.name_en || '',
            nameJp: s.name_jp || '',
            code: s.code,
            grade: s.grade || ''
          });
        });
        
        // Style subjects header
        const subjHeaderRow = subjectsSheet.getRow(1);
        subjHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        subjHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFC000' }
        };
      }
      
      // Write to buffer
      const buffer = await workbook.xlsx.writeBuffer();
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
        'Subject Name': q.subjectId?.name || q.subjectId?.name_en || '',
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
          'Subject Name': '',
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
        { wch: 25 }, // Subject Name (wider for names)
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
        
        // Support both Subject Name (new) and Subject Code (legacy)
        const subjectName = (row['Subject Name'] || row['subjectName'] || '').toString().trim();
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

        if (!subjectName && !subjectCode) {
          results.errors.push({ row: rowNum, error: 'Subject Name or Subject Code is required' });
          results.failed++;
          continue;
        }

        if (!['mcq', 'tf', 'short', 'essay'].includes(type)) {
          results.errors.push({ row: rowNum, error: `Invalid type: ${type}. Must be mcq, tf, short, or essay` });
          results.failed++;
          continue;
        }

        // Find subject by name (search all language fields) or code (fallback)
        const subjectFilter = {};
        if (subjectName) {
          // Try to find by name in any language (case-insensitive)
          const nameRegex = new RegExp(`^${subjectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
          subjectFilter.$or = [
            { name: subjectName },
            { name: nameRegex },
            { name_en: subjectName },
            { name_en: nameRegex },
            { name_jp: subjectName },
            { name_jp: nameRegex }
          ];
        } else if (subjectCode) {
          subjectFilter.code = subjectCode;
        }
        
        if (orgId && mongoose.isValidObjectId(orgId)) {
          subjectFilter.orgId = new mongoose.Types.ObjectId(orgId);
        } else {
          subjectFilter.orgId = { $exists: false };
        }
        
        const subject = await Subject.findOne(subjectFilter);

        if (!subject) {
          const searchTerm = subjectName || subjectCode;
          const searchType = subjectName ? 'name' : 'code';
          results.errors.push({ row: rowNum, error: `Subject with ${searchType} "${searchTerm}" not found. Please check Available Subjects sheet in template.` });
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


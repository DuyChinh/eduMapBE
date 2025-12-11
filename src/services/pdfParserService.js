const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v2: cloudinary } = require('cloudinary');
const { generateResponse } = require('./aiService');

class PDFParserService {
  constructor() {
    if (!cloudinary.config().cloud_name) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    }
  }

  async parsePDF(pdfBuffer, filename = 'exam.pdf') {
    try {
      console.log(`Processing PDF: ${filename}, size: ${pdfBuffer.length} bytes`);
      
      console.log('Step 1: Using AI to extract questions from PDF...');
      const questionsData = await this.extractQuestionsWithAI(pdfBuffer);
      console.log(`Step 1 complete: AI detected ${questionsData.length} questions`);
      
      console.log('Step 2: Creating placeholder images for pages...');
      const pageCount = this.estimatePageCount(questionsData);
      const pagesWithImages = await this.convertPagesToImages(pdfBuffer, pageCount);
      console.log(`Step 2 complete: Generated ${pagesWithImages.length} images`);
      
      console.log('Step 3: Organizing questions by page...');
      const pages = this.organizeQuestionsByPage(questionsData, pagesWithImages);
      console.log(`Step 3 complete: Organized into ${pages.length} pages`);
      
      return {
        success: true,
        pages
      };
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  async extractQuestionsWithAI(pdfBuffer) {
    try {
      const base64Pdf = pdfBuffer.toString('base64');
      
      const prompt = `Đọc file PDF này và export câu hỏi theo format JSON sau:

Format mong muốn cho mỗi câu hỏi:
{
  "name": "qe_eng01", 
  "text": "Nội dung câu hỏi",
  "choices": [
    { "key": "A", "text": "Đáp án A" },
    { "key": "B", "text": "Đáp án B" },
    { "key": "C", "text": "Đáp án C" },
    { "key": "D", "text": "Đáp án D" }
  ],
  "answer": "C",
  "explanation": "Giải thích (nếu có, không có thì để trống)"
}

Lưu ý:
- Đối với câu trắc nghiệm: bao gồm đầy đủ choices (A, B, C, D) và answer
- Đối với câu tự luận: để choices = [] và answer = ""
- name format: qe_math01, qe_math02, ... (dựa vào môn học và số thứ tự)
- Chỉ trả về mảng JSON, không thêm text giải thích

Trả về format: [{"name": "...", "text": "...", "choices": [...], "answer": "...", "explanation": "..."}]`;

      const attachments = [{
        mimeType: 'application/pdf',
        data: base64Pdf
      }];

      console.log('Sending PDF to AI for analysis...');
      const aiResponse = await generateResponse(prompt, attachments);
      console.log('AI Response received, length:', aiResponse.length);
      
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('AI response không chứa JSON array hợp lệ');
      }
      
      const questions = JSON.parse(jsonMatch[0]);
      console.log(`AI extracted ${questions.length} questions successfully`);
      
      return questions;
    } catch (error) {
      console.error('Error extracting questions with AI:', error);
      throw error;
    }
  }

  estimatePageCount(questions) {
    return Math.max(1, Math.ceil(questions.length / 5));
  }

  organizeQuestionsByPage(questionsData, pagesWithImages) {
    const questionsPerPage = Math.ceil(questionsData.length / pagesWithImages.length);
    
    return pagesWithImages.map((pageImage, pageIndex) => {
      const startIdx = pageIndex * questionsPerPage;
      const endIdx = Math.min(startIdx + questionsPerPage, questionsData.length);
      const pageQuestions = questionsData.slice(startIdx, endIdx);
      
      const questions = pageQuestions.map((q, qIndex) => {
        const questionNumber = startIdx + qIndex + 1;
        const yOffset = (qIndex * 200);
        
        const question = {
          questionNumber,
          questionText: q.text,
          type: q.choices && q.choices.length > 0 ? 'multiple-choice' : 'essay',
          x: 50,
          y: yOffset + 50,
          width: 700,
          height: 30,
          answers: []
        };
        
        if (q.choices && q.choices.length > 0) {
          question.answers = q.choices.map((choice, cIndex) => ({
            key: choice.key,
            text: choice.text,
            x: 50 + (cIndex % 2) * 400,
            y: yOffset + 90 + Math.floor(cIndex / 2) * 30,
            width: 350,
            height: 25,
            isCorrect: choice.key === q.answer
          }));
        }
        
        if (q.answer) {
          question.correctAnswer = q.answer;
        }
        
        if (q.explanation) {
          question.explanation = q.explanation;
        }
        
        return question;
      });
      
      return {
        pageNumber: pageIndex + 1,
        imageUrl: pageImage.imageUrl,
        width: 800,
        height: 1131,
        questions
      };
    });
  }

  async convertPagesToImages(pdfBuffer, pageCount) {
    try {
      const images = [];
      
      for (let i = 0; i < pageCount; i++) {
        const placeholderBuffer = await sharp({
          create: {
            width: 800,
            height: 1131,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        })
        .png()
        .toBuffer();
        
        const imageUrl = await this.uploadToCloudinary(
          placeholderBuffer,
          `pdf-page-${Date.now()}-${i + 1}`
        );
        
        images.push({
          pageNumber: i + 1,
          imageUrl
        });
      }
      
      return images;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw error;
    }
  }

  uploadToCloudinary(buffer, filename) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'pdf-exams',
          public_id: filename,
          resource_type: 'image'
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      );
      
      const streamifier = require('streamifier');
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }
}

module.exports = new PDFParserService();

const PDFParser = require('pdf2json');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');
const Tesseract = require('tesseract.js');

/**
 * Parse PDF và extract questions với coordinates
 */
class PDFParserService {
  constructor() {
    // Configure Cloudinary if not already done
    if (!cloudinary.config().cloud_name) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    }
  }

  /**
   * Main function: Parse PDF buffer và trả về structured data
   */
  async parsePDF(pdfBuffer) {
    try {
      console.log('Starting PDF parsing...', {
        bufferSize: pdfBuffer.length,
        bufferType: typeof pdfBuffer
      });
      
      // Step 1: Parse PDF với pdf2json
      console.log('Step 1: Parsing PDF with pdf2json...');
      const pdfData = await this.parsePDFWithCoordinates(pdfBuffer);
      console.log(`Step 1 complete: Found ${pdfData.pages.length} pages`);
      
      // Step 2: Convert PDF pages to images và upload to Cloudinary
      console.log('Step 2: Converting pages to images...');
      const pagesWithImages = await this.convertPagesToImages(pdfBuffer, pdfData.pages.length);
      console.log(`Step 2 complete: Generated ${pagesWithImages.length} images`);
      
      // Step 3: Extract questions từ parsed data with improved merging
      console.log('Step 3: Extracting questions...');
      const pagesWithQuestions = this.extractQuestionsWithImprovedMerge(pdfData);
      const totalQuestionsFound = pagesWithQuestions.reduce((sum, p) => sum + p.questions.length, 0);
      console.log(`Step 3 complete: Found ${totalQuestionsFound} questions`);
      
      // Step 4: Merge images và questions
      const finalPages = pagesWithQuestions.map((page, index) => ({
        ...page,
        imageUrl: pagesWithImages[index]?.imageUrl || null
      }));
      
      console.log(`Successfully parsed ${finalPages.length} pages with ${totalQuestionsFound} questions`);
      
      return {
        success: true,
        pages: finalPages
      };
    } catch (error) {
      console.error('Error parsing PDF:', error);
      console.error('Error stack:', error.stack);
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse PDF với pdf2json để lấy text và coordinates
   */
  parsePDFWithCoordinates(pdfBuffer) {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('PDF parsing timeout (30s)'));
      }, 30000);
      
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          clearTimeout(timeout);
          
          console.log('PDF data structure:', {
            hasPages: !!pdfData.Pages,
            hasFormImage: !!pdfData.formImage,
            pagesCount: (pdfData.Pages || pdfData.formImage?.Pages || []).length
          });
          
          const pages = pdfData.Pages || pdfData.formImage?.Pages || [];
          
          if (pages.length === 0) {
            reject(new Error('No pages found in PDF. The PDF might be empty or encrypted.'));
            return;
          }
          
          const parsedPages = pages.map((page, pageIndex) => {
            const texts = (page.Texts || []).map(text => {
              try {
                // Decode URL-encoded text
                const decodedText = decodeURIComponent(
                  text.R?.[0]?.T || ''
                ).trim();
                
                return {
                  text: decodedText,
                  x: text.x || 0,
                  y: text.y || 0,
                  width: text.w || 0,
                  height: (text.R?.[0]?.TS?.[1] || 0) / 10 // Font size as height approximation
                };
              } catch (e) {
                console.warn(`Failed to decode text at page ${pageIndex + 1}:`, e);
                return null;
              }
            }).filter(t => t && t.text.length > 0);
            
            console.log(`Page ${pageIndex + 1}: Found ${texts.length} text items`);
            
            return {
              pageNumber: pageIndex + 1,
              pageWidth: page.Width || 612, // Default PDF width
              pageHeight: page.Height || 792, // Default PDF height
              texts: texts
            };
          });
          
          console.log(`Successfully parsed ${parsedPages.length} pages with pdf2json`);
          resolve({ pages: parsedPages });
        } catch (error) {
          clearTimeout(timeout);
          console.error('Error processing PDF data:', error);
          reject(new Error(`Failed to process PDF data: ${error.message}`));
        }
      });
      
      pdfParser.on('pdfParser_dataError', (error) => {
        clearTimeout(timeout);
        console.error('pdf2json error:', error);
        reject(new Error(`PDF parsing error: ${error.parserError || error.message || 'Unknown error'}`));
      });
      
      try {
        // Parse the buffer
        console.log('Calling pdfParser.parseBuffer...');
        pdfParser.parseBuffer(pdfBuffer);
      } catch (error) {
        clearTimeout(timeout);
        console.error('Error calling parseBuffer:', error);
        reject(new Error(`Failed to parse buffer: ${error.message}`));
      }
    });
  }

  /**
   * Convert PDF pages to PNG images và upload to Cloudinary
   */
  async convertPagesToImages(pdfBuffer, pageCount) {
    try {
      const images = [];
      
      // Note: pdf-poppler requires file path, not buffer
      // For now, we'll use a workaround with temp file
      const tempDir = path.join(__dirname, '../../temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempPdfPath = path.join(tempDir, `temp-${Date.now()}.pdf`);
      await fs.writeFile(tempPdfPath, pdfBuffer);
      
      // Convert using pdf-poppler (requires poppler-utils installed on system)
      // For MVP, we'll use sharp to create placeholder images
      // TODO: Implement actual PDF to image conversion with pdf-poppler
      
      for (let i = 0; i < pageCount; i++) {
        // Create a placeholder image (white background)
        const placeholderBuffer = await sharp({
          create: {
            width: 800,
            height: 1131, // A4 ratio
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        })
        .png()
        .toBuffer();
        
        // Upload to Cloudinary
        const imageUrl = await this.uploadToCloudinary(
          placeholderBuffer,
          `pdf-page-${Date.now()}-${i + 1}`
        );
        
        images.push({
          pageNumber: i + 1,
          imageUrl
        });
      }
      
      // Cleanup temp file
      await fs.unlink(tempPdfPath).catch(() => {});
      
      return images;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw error;
    }
  }

  /**
   * Upload image buffer to Cloudinary
   */
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
      
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  /**
   * Merge text items that are on same line and close to each other
   */
  mergeTextItems(texts) {
    if (texts.length === 0) return [];
    
    // Sort by y first (line), then by x (position in line)
    const sorted = [...texts].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) < 0.5) { // Same line threshold - increased from 0.3
        return a.x - b.x;
      }
      return yDiff;
    });
    
    const merged = [];
    let currentLine = {
      text: sorted[0].text,
      x: sorted[0].x,
      y: sorted[0].y,
      width: sorted[0].width,
      height: sorted[0].height
    };
    
    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      const prev = sorted[i - 1];
      
      // Check if same line (y-coordinate close)
      const sameLine = Math.abs(curr.y - currentLine.y) < 0.5;
      
      // More generous horizontal threshold - merge items on same line regardless of gap
      // This helps merge fragmented text like "x–9 = 0 có t" + "ập nghi" + "ệm là:"
      const xGap = curr.x - (currentLine.x + currentLine.width);
      const reasonableGap = xGap < 10; // Increased from 2 to 10
      
      if (sameLine && reasonableGap && xGap >= 0) {
        // Merge with current line
        const separator = xGap > 0.3 ? ' ' : ''; // Add space if gap > 0.3 units
        currentLine.text += separator + curr.text;
        currentLine.width = curr.x + curr.width - currentLine.x;
        currentLine.height = Math.max(currentLine.height, curr.height);
      } else {
        // Save current line and start new one
        if (currentLine.text.trim().length > 0) {
          merged.push(currentLine);
        }
        currentLine = {
          text: curr.text,
          x: curr.x,
          y: curr.y,
          width: curr.width,
          height: curr.height
        };
      }
    }
    
    // Don't forget the last line
    if (currentLine.text.trim().length > 0) {
      merged.push(currentLine);
    }
    
    return merged;
  }

  /**
   * Extract questions từ parsed pages với regex patterns
   */
  extractQuestions(pdfData) {
    return pdfData.pages.map(page => {
      const { texts, pageWidth, pageHeight } = page;
      
      // Step 1: Merge fragmented text items
      console.log(`\n=== Page ${page.pageNumber} - Merging text items ===`);
      const mergedTexts = this.mergeTextItems(texts);
      console.log(`Merged ${texts.length} items into ${mergedTexts.length} lines`);
      
      // DEBUG: Log first 30 merged lines
      console.log(`\n=== Page ${page.pageNumber} - First 30 merged lines ===`);
      mergedTexts.slice(0, 30).forEach((t, i) => {
        console.log(`[${i}] "${t.text}" (x: ${t.x.toFixed(2)}, y: ${t.y.toFixed(2)})`);
      });
      
      // Sort texts by columns first (x), then by rows (y)
      const sortedTexts = this.sortTextsByColumns(mergedTexts, pageWidth);
      
      const questions = [];
      let currentQuestion = null;
      let currentAnswers = [];
      
      // Regex patterns - More flexible to match "Câu1" or "Câu 1"
      const questionPattern = /^(?:Câu|Cau)\s*(\d+)[:.)\s-]*/i;
      const answerPattern = /^([A-D])[\.\):\-\s]|^\s*([A-D])[\.\)]/i;
      
      sortedTexts.forEach((textItem, index) => {
        const questionMatch = textItem.text.match(questionPattern);
        const answerMatch = textItem.text.match(answerPattern);
        
        // DEBUG: Log matches
        if (index < 30) {
          if (questionMatch) {
            console.log(`✓ QUESTION MATCH: "${textItem.text}"`);
          }
          if (answerMatch) {
            console.log(`✓ ANSWER MATCH: "${textItem.text}"`);
          }
        }
        
        if (questionMatch) {
          // Found a new question - save previous question if exists
          if (currentQuestion) {
            questions.push({
              ...currentQuestion,
              answers: currentAnswers
            });
          }
          
          // Start new question
          const questionNumber = parseInt(questionMatch[1]);
          const questionText = textItem.text.replace(questionPattern, '').trim();
          
          // Look ahead for continuation text
          let fullQuestionText = questionText;
          let questionEndIndex = index;
          
          for (let j = index + 1; j < sortedTexts.length; j++) {
            const nextText = sortedTexts[j].text;
            // Stop if we hit an answer or next question
            if (nextText.match(answerPattern) || nextText.match(questionPattern)) {
              break;
            }
            // Check if next text is close in Y coordinate (same line or next line)
            if (Math.abs(sortedTexts[j].y - textItem.y) < 0.5) {
              fullQuestionText += ' ' + nextText;
              questionEndIndex = j;
            } else {
              break;
            }
          }
          
          currentQuestion = {
            questionNumber,
            questionText: fullQuestionText,
            questionCoords: {
              x: textItem.x,
              y: textItem.y,
              width: textItem.width,
              height: textItem.height
            }
          };
          currentAnswers = [];
        } else if (answerMatch && currentQuestion) {
          // Found an answer
          const answerKey = answerMatch[1];
          const answerText = textItem.text.replace(answerPattern, '').trim();
          
          // Look ahead for answer continuation
          let fullAnswerText = answerText;
          for (let j = index + 1; j < sortedTexts.length; j++) {
            const nextText = sortedTexts[j].text;
            // Stop if we hit another answer, question, or text is far away
            if (nextText.match(answerPattern) || nextText.match(questionPattern)) {
              break;
            }
            if (Math.abs(sortedTexts[j].y - textItem.y) < 0.3) {
              fullAnswerText += ' ' + nextText;
            } else {
              break;
            }
          }
          
          currentAnswers.push({
            key: answerKey,
            text: fullAnswerText,
            coords: {
              x: textItem.x,
              y: textItem.y,
              width: textItem.width,
              height: textItem.height
            }
          });
        }
      });
      
      // Don't forget the last question
      if (currentQuestion) {
        questions.push({
          ...currentQuestion,
          answers: currentAnswers
        });
      }
      
      return {
        pageNumber: page.pageNumber,
        pageWidth,
        pageHeight,
        questions
      };
    });
  }

  /**
   * Extract questions with improved text merging strategy
   */
  extractQuestionsWithImprovedMerge(pdfData) {
    return pdfData.pages.map(page => {
      const { texts, pageWidth, pageHeight } = page;
      
      // Step 1: Group texts by line (same y-coordinate)
      const lines = this.groupTextsByLine(texts);
      console.log(`\n=== Page ${page.pageNumber} - Grouped into ${lines.length} lines ===`);
      
      // Step 2: Merge each line into complete text
      const mergedLines = lines.map(line => {
        const sortedByX = line.sort((a, b) => a.x - b.x);
        const merged = sortedByX.map(t => t.text).join('');
        return {
          text: merged,
          y: line[0].y,
          x: line[0].x
        };
      });
      
      // Sort by y-coordinate
      mergedLines.sort((a, b) => a.y - b.y);
      
      // Debug: Show first 30 merged lines
      console.log(`\n=== Page ${page.pageNumber} - First 30 merged lines ===`);
      mergedLines.slice(0, 30).forEach((line, i) => {
        console.log(`[${i}] "${line.text}"`);
      });
      
      // Step 3: Extract questions
      const questions = [];
      let currentQuestion = null;
      let currentAnswers = [];
      
      const questionPattern = /^(?:Câu|Cau)\s*(\d+)[:.)\s-]*/i;
      const answerPattern = /^([A-D])[\.\):\-\s]/i;
      
      mergedLines.forEach((line, index) => {
        const questionMatch = line.text.match(questionPattern);
        const answerMatch = line.text.match(answerPattern);
        
        if (index < 50) {
          if (questionMatch) {
            console.log(`✓ QUESTION MATCH: "${line.text}"`);
          }
          if (answerMatch) {
            console.log(`✓ ANSWER MATCH: "${line.text}"`);
          }
        }
        
        if (questionMatch) {
          // Save previous question
          if (currentQuestion && currentAnswers.length > 0) {
            currentQuestion.answers = currentAnswers;
            questions.push(currentQuestion);
          }
          
          // Start new question
          const questionNumber = parseInt(questionMatch[1]);
          const questionText = line.text.replace(questionPattern, '').trim();
          
          currentQuestion = {
            questionNumber,
            questionText,
            type: 'multiple-choice',
            x: line.x * 10,
            y: line.y * 10,
            width: pageWidth * 8,
            height: 20
          };
          currentAnswers = [];
        } else if (answerMatch && currentQuestion) {
          // Check if line contains multiple answers (e.g., "A.text1B.text2C.text3D.text4")
          const multipleAnswersPattern = /([A-D])[\.\):\-\s]([^A-D]*?)(?=[A-D][\.\):\-\s]|$)/g;
          const matches = [...line.text.matchAll(multipleAnswersPattern)];
          
          if (matches.length > 1) {
            // Line contains multiple answers - split them
            console.log(`  → Splitting into ${matches.length} answers`);
            matches.forEach(match => {
              const answerLetter = match[1];
              const answerText = match[2].trim();
              
              currentAnswers.push({
                letter: answerLetter,
                text: answerText,
                x: line.x * 10,
                y: line.y * 10,
                width: pageWidth * 6,
                height: 15
              });
            });
          } else {
            // Single answer
            const answerLetter = answerMatch[1];
            const answerText = line.text.replace(answerPattern, '').trim();
            
            currentAnswers.push({
              letter: answerLetter,
              text: answerText,
              x: line.x * 10,
              y: line.y * 10,
              width: pageWidth * 6,
              height: 15
            });
          }
        } else if (currentQuestion && !answerMatch && line.text.length < 150) {
          // Continuation text
          if (currentAnswers.length > 0) {
            // Append to last answer
            const lastAnswer = currentAnswers[currentAnswers.length - 1];
            lastAnswer.text += ' ' + line.text;
          } else {
            // Append to question
            currentQuestion.questionText += ' ' + line.text;
          }
        }
      });
      
      // Don't forget last question
      if (currentQuestion) {
        if (currentAnswers.length > 0) {
          currentQuestion.answers = currentAnswers;
        } else {
          // Essay question (no multiple choice answers)
          currentQuestion.type = 'essay';
          currentQuestion.answers = [];
        }
        questions.push(currentQuestion);
      }
      
      console.log(`Page ${page.pageNumber}: Found ${questions.length} questions (${questions.filter(q => q.type === 'multiple-choice').length} MC, ${questions.filter(q => q.type === 'essay').length} essay)`);
      
      return {
        pageNumber: page.pageNumber,
        pageWidth,
        pageHeight,
        questions
      };
    });
  }

  /**
   * Group text items by line (same y-coordinate)
   */
  groupTextsByLine(texts) {
    const lines = [];
    const threshold = 0.2; // Y-coordinate threshold for same line
    
    texts.forEach(text => {
      // Find existing line with similar y-coordinate
      let foundLine = lines.find(line => {
        const avgY = line.reduce((sum, t) => sum + t.y, 0) / line.length;
        return Math.abs(avgY - text.y) < threshold;
      });
      
      if (foundLine) {
        foundLine.push(text);
      } else {
        lines.push([text]);
      }
    });
    
    return lines;
  }

  /**
   * Sort texts by columns (handle multi-column layouts)
   */
  sortTextsByColumns(texts, pageWidth) {
    // Detect if page has multiple columns
    const xPositions = texts.map(t => t.x).sort((a, b) => a - b);
    const midPoint = pageWidth / 2;
    
    // Check if there's a significant gap around midpoint
    const leftTexts = texts.filter(t => t.x < midPoint);
    const rightTexts = texts.filter(t => t.x >= midPoint);
    
    // If both columns have texts, sort by column then by y
    if (leftTexts.length > 0 && rightTexts.length > 0) {
      const sortedLeftTexts = leftTexts.sort((a, b) => a.y - b.y);
      const sortedRightTexts = rightTexts.sort((a, b) => a.y - b.y);
      return [...sortedLeftTexts, ...sortedRightTexts];
    }
    
    // Otherwise, just sort by y (single column)
    return texts.sort((a, b) => a.y - b.y);
  }

  /**
   * Convert PDF to local image files (not uploaded yet)
   */
  async convertPagesToLocalImages(pdfBuffer) {
    const tempDir = path.join(__dirname, '../../temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempPdfPath = path.join(tempDir, `temp-${Date.now()}.pdf`);
    await fs.writeFile(tempPdfPath, pdfBuffer);
    
    try {
      // Use pdftoppm (from pdf-poppler) to convert PDF to PNG
      const pdfImage = require('pdf-image').PDFImage;
      const pdfImg = new pdfImage(tempPdfPath);
      
      const imageFiles = [];
      const pageCount = await this.getPDFPageCount(pdfBuffer);
      
      for (let i = 0; i < pageCount; i++) {
        const imagePath = await pdfImg.convertPage(i);
        imageFiles.push({
          pageNumber: i + 1,
          path: imagePath
        });
      }
      
      return imageFiles;
    } catch (error) {
      console.error('Error with pdf-image, using sharp fallback...');
      // Fallback: Use sharp to create image from first page
      const images = [];
      const pageCount = await this.getPDFPageCount(pdfBuffer);
      
      for (let i = 0; i < pageCount; i++) {
        const imagePath = path.join(tempDir, `page-${Date.now()}-${i + 1}.png`);
        const placeholderBuffer = await sharp({
          create: {
            width: 800,
            height: 1131,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        }).png().toBuffer();
        
        await fs.writeFile(imagePath, placeholderBuffer);
        images.push({
          pageNumber: i + 1,
          path: imagePath
        });
      }
      
      return images;
    }
  }

  /**
   * Extract text from images using Tesseract OCR
   */
  async extractTextWithOCR(images) {
    const pagesWithText = [];
    
    for (const image of images) {
      console.log(`OCR processing page ${image.pageNumber}...`);
      
      try {
        const { data } = await Tesseract.recognize(
          image.path,
          'vie+eng', // Vietnamese + English
          {
            logger: m => console.log(`Page ${image.pageNumber} OCR:`, m)
          }
        );
        
        console.log(`Page ${image.pageNumber} OCR text (first 200 chars):`, data.text.substring(0, 200));
        
        pagesWithText.push({
          pageNumber: image.pageNumber,
          text: data.text,
          confidence: data.confidence
        });
      } catch (error) {
        console.error(`OCR failed for page ${image.pageNumber}:`, error);
        pagesWithText.push({
          pageNumber: image.pageNumber,
          text: '',
          confidence: 0
        });
      }
    }
    
    return pagesWithText;
  }

  /**
   * Upload images to Cloudinary
   */
  async uploadImagesToCloudinary(images) {
    const uploaded = [];
    
    for (const image of images) {
      try {
        const imageBuffer = await fs.readFile(image.path);
        const imageUrl = await this.uploadToCloudinary(
          imageBuffer,
          `pdf-page-${Date.now()}-${image.pageNumber}`
        );
        
        uploaded.push({
          pageNumber: image.pageNumber,
          imageUrl
        });
      } catch (error) {
        console.error(`Failed to upload page ${image.pageNumber}:`, error);
        uploaded.push({
          pageNumber: image.pageNumber,
          imageUrl: null
        });
      }
    }
    
    return uploaded;
  }

  /**
   * Extract questions from clean OCR text
   */
  extractQuestionsFromOCRText(pagesWithText) {
    return pagesWithText.map(page => {
      const lines = page.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      console.log(`\n=== Page ${page.pageNumber} - OCR Lines (first 30) ===`);
      lines.slice(0, 30).forEach((line, i) => {
        console.log(`[${i}] "${line}"`);
      });
      
      const questions = [];
      let currentQuestion = null;
      let currentAnswers = [];
      
      // Regex patterns
      const questionPattern = /^(?:Câu|Cau)\s*(\d+)[:.)\s-]*/i;
      const answerPattern = /^([A-D])[\.\):\-\s]/i;
      
      lines.forEach((line, index) => {
        const questionMatch = line.match(questionPattern);
        const answerMatch = line.match(answerPattern);
        
        if (index < 50) {
          if (questionMatch) {
            console.log(`✓ QUESTION MATCH: "${line}"`);
          }
          if (answerMatch) {
            console.log(`✓ ANSWER MATCH: "${line}"`);
          }
        }
        
        if (questionMatch) {
          // Save previous question
          if (currentQuestion && currentAnswers.length > 0) {
            currentQuestion.answers = currentAnswers;
            questions.push(currentQuestion);
          }
          
          // Start new question
          const questionNumber = parseInt(questionMatch[1]);
          const questionText = line.replace(questionPattern, '').trim();
          
          currentQuestion = {
            questionNumber,
            questionText,
            type: 'multiple-choice',
            x: 0,
            y: 0,
            width: 100,
            height: 20
          };
          currentAnswers = [];
        } else if (answerMatch && currentQuestion) {
          // Add answer to current question
          const answerLetter = answerMatch[1];
          const answerText = line.replace(answerPattern, '').trim();
          
          currentAnswers.push({
            letter: answerLetter,
            text: answerText,
            x: 0,
            y: 0,
            width: 80,
            height: 15
          });
        } else if (currentQuestion && !answerMatch) {
          // Continue question text or answer text
          if (currentAnswers.length > 0 && line.length < 100) {
            // Likely continuation of last answer
            const lastAnswer = currentAnswers[currentAnswers.length - 1];
            lastAnswer.text += ' ' + line;
          } else if (currentAnswers.length === 0) {
            // Continuation of question text
            currentQuestion.questionText += ' ' + line;
          }
        }
      });
      
      // Don't forget last question
      if (currentQuestion && currentAnswers.length > 0) {
        currentQuestion.answers = currentAnswers;
        questions.push(currentQuestion);
      }
      
      console.log(`Page ${page.pageNumber}: Found ${questions.length} questions`);
      
      return {
        pageNumber: page.pageNumber,
        pageWidth: 800,
        pageHeight: 1131,
        questions
      };
    });
  }

  /**
   * Get PDF page count
   */
  async getPDFPageCount(pdfBuffer) {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        const pages = pdfData.Pages || pdfData.formImage?.Pages || [];
        resolve(pages.length);
      });
      
      pdfParser.on('pdfParser_dataError', (error) => {
        reject(new Error(`PDF parsing error: ${error.parserError}`));
      });
      
      pdfParser.parseBuffer(pdfBuffer);
    });
  }
}

module.exports = new PDFParserService();


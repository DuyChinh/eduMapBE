const pdfParse = require('pdf-parse');
const sharp = require('sharp');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

class PDFParserService {
  constructor() {
    this.prompt = `
      Bạn là một trợ lý AI chuyên về giáo dục. Nhiệm vụ của bạn là trích xuất câu hỏi trắc nghiệm từ nội dung văn bản của file PDF.
      
      YÊU CẦU ĐẦU RA:
      Trả về kết quả dướii dạng một JSON Array thuần túy (không bọc trong markdown, không có text dẫn dắt).
      Mỗi phần tử trong mảng là một object đại diện cho một câu hỏi với cấu trúc sau:
      {
        "questionNumber": "số câu",
        "questionText": "nội dung câu hỏi (giữ nguyên công thức toán học)",
        "type": "multiple-choice",
        "pageNumber": "số trang chứa câu hỏi này (ước lượng)",
        "hasImage": false, // Set true nếu câu hỏi có chứa cụm từ "như hình vẽ", "hình bên", "đồ thị", ...
        "answers": [
           { "key": "A", "text": "nội dung đáp án A", "isCorrect": false },
           { "key": "B", "text": "nội dung đáp án B", "isCorrect": false },
           { "key": "C", "text": "nội dung đáp án C", "isCorrect": false },
           { "key": "D", "text": "nội dung đáp án D", "isCorrect": false }
        ],
        "correctAnswer": "A", 
        "explanation": ""
      }

      QUY TẮC QUAN TRỌNG:
      1. PHÂN BIỆT VĂN BẢN VÀ TOÁN HỌC (QUAN TRỌNG):
         - CHỈ DÙNG dấu $ bao quanh: số, biến (x, y), biểu thức (x+1), phương trình.
         - TUYỆT ĐỐI KHÔNG bao quanh các từ tiếng Việt bằng dấu $.
           + SAI (Cấm): $Cho hình chóp S.ABCD$ (Lỗi: chữ bị dính và nghiêng)
           + SAI (Cấm): $với$ $x > 0$
           + ĐÚNG: Cho hình chóp $S.ABCD$
           + ĐÚNG: với $x > 0$

      2. CÚ PHÁP LATEX:
         - Dùng double backslash (\\\\) cho lệnh: \\\\frac, \\\\int, \\\\sqrt.
         - KHÔNG ĐƯỢC viết dấu $ bên trong ngoặc nhọn { }.
           + SAI (Lỗi cú pháp): \\\\overrightarrow{$MN$}
           + ĐÚNG: \\\\overrightarrow{MN}
         - Lệnh \\\\sqrt, \\\\frac, \\\\overrightarrow, số mũ ^ bắt buộc có { } bao quanh tham số.
           + SAI: \\\\sqrt 2x
           + ĐÚNG: \\\\sqrt{2x}
      3. Hình ảnh/Đồ thị: Nếu câu hỏi có hình vẽ (ví dụ: "Đồ thị hình bên...", "như hình vẽ"), hãy set 'hasImage': true và mô tả nội dung hình vẽ đó trong ngoặc vuông ngay trong questionText. Ví dụ: "Tìm hàm số có đồ thị như hình vẽ [Hình vẽ: Đồ thị hàm bậc 3 đi qua gốc tọa độ...]"
      4. KHÔNG ĐƯỢC CẮT BỚT: Phải trích xuất TOÀN BỘ câu hỏi trong đề. Nếu đề dài, hãy cố gắng xử lý hết khả năng cho phép.
      5. TỐC ĐỘ LÀ ƯU TIÊN: KHÔNG tạo lời giải chi tiết. Trường 'explanation' BẮT BUỘC để chuỗi rỗng "". KHÔNG cố gắng tự giải đề.
      6. XỬ LÝ ĐÁP ÁN (RẤT QUAN TRỌNG):
         - Hãy QUÉT TOÀN BỘ VĂN BẢN để tìm Bảng Đáp Án (thường là một bảng kẻ ô hoặc danh sách dạng 1.A 2.B... ở cuối tài liệu).
         - Nếu tìm thấy: Hãy đối chiếu và điền chính xác vào trường 'correctAnswer' (chỉ lấy chữ cái A, B, C, hoặc D). Đồng thời set 'isCorrect': true cho lựa chọn tương ứng trong mảng 'answers'.
         - Nếu KHÔNG tìm thấy bảng đáp án: Hãy để 'correctAnswer': null hoặc "A" (nhưng ưu tiên tìm kiếm kỹ).
      7. CHÍNH TẢ: Tuyệt đối không để lại các kí tự lỗi như , ?, . Hãy đọc hiểu ngữ cảnh để sửa lại từ tiếng Việt cho đúng (Ví dụ: "đ lớn" -> "độ lớn", "cưng độ" -> "cường độ").
      8. XỬ LÝ SỐ CÂU HỎI (RẤT QUAN TRỌNG):
         - Giữ nguyên số thứ tự câu hỏi gốc trong đề. Ví dụ: đề bài ghi "Câu 81", hãy điền "81" vào 'questionNumber'.
         - TUYỆT ĐỐI KHÔNG tự đặt lại số thứ tự từ 1 nếu đề bài không ghi như vậy.
      9. XỬ LÝ ĐÁP ÁN & LỜI GIẢI CHI TIẾT:
         - Nhiệm vụ quan trọng nhất là trích xuất ĐỦ số lượng câu hỏi có trong đề. Đừng bỏ sót câu nào, đặc biệt là các câu ở cuối trang hoặc cuối đề ngay trước Bảng Đáp Án.
         - Tách biệt rõ ràng: Nếu gặp phần "Lời giải chi tiết" (có giải thích dài dòng), hãy DỪNG trích xuất câu hỏi tại đó, CHỈ lấy Bảng Đáp Án (nếu có) từ phần đó.
      10. HỆ PHƯƠNG TRÌNH: Nếu gặp hệ phương trình (dấu ngoặc nhọn), HÃY CHẮC CHẮN dùng \\begin{cases} ... \\end{cases} và KIỂM TRA ĐÓNG NGOẶC. Nếu không chắc chắn, hãy dùng text thường.
      11. XỬ LÝ BẢNG BIẾN THIÊN/BẢNG XÉT DẤU (QUAN TRỌNG):
         - Do đọc file PDF, dữ liệu bảng thường bị vỡ thành các dòng số nằm dọc (ví dụ: + vô cùng, -1, 0, ...).
         - NẾU câu hỏi có hình ảnh (hasImage: true) chứa bảng này: HÃY BỎ QUA các dòng số liệu rác đó trong 'questionText'.
         - Thay thế bằng text mô tả ngắn gọn: "Cho hàm số y=f(x) có bảng biến thiên như hình bên." (Không cần chép lại các số liệu bị vỡ).
    `;
  }

  async extractTextWithCoords(buffer) {
    try {
      // Use dynamic import for pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist');

      const uint8Array = new Uint8Array(buffer);
      const loadingTask = pdfjsLib.getDocument(uint8Array);
      const doc = await loadingTask.promise;
      const numPages = doc.numPages;

      let fullText = '';
      const layoutData = [];



      for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        const items = textContent.items.map(item => {
          const tx = item.transform;
          const yBottomUp = tx[5];
          const yTopDown = viewport.height - yBottomUp;
          return {
            text: item.str,
            x: tx[4],
            y: yTopDown,
            h: item.height || 10,
            w: item.width || 0,
            pdfWidth: viewport.width
          };
        });

        // Simple line grouper
        items.sort((a, b) => {
          if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
          return a.y - b.y;
        });

        const lines = [];
        if (items.length > 0) {
          let currentLine = {
            page: i,
            text: items[0].text,
            y: items[0].y,
            x: items[0].x,
            h: items[0].h,
            pdfHeight: viewport.height,
            pdfWidth: viewport.width,
            w: items[0].w || 0
          };

          for (let k = 1; k < items.length; k++) {
            const item = items[k];
            if (Math.abs(item.y - currentLine.y) < 6) {
              currentLine.text += (Math.abs(item.x - (currentLine.x + (currentLine.w || 0))) > 4 ? ' ' : '') + item.text;
              currentLine.h = Math.max(currentLine.h, item.h);
              currentLine.w = Math.max(currentLine.w, (item.x + item.w) - currentLine.x); // approx
            } else {
              lines.push(currentLine);
              currentLine = {
                page: i,
                text: item.text,
                y: item.y,
                x: item.x,
                h: item.h,
                pdfHeight: viewport.height,
                pdfWidth: viewport.width,
                w: item.w
              };
            }
          }
          lines.push(currentLine);
        }

        lines.forEach(l => {
          layoutData.push(l);
          fullText += l.text + '\n';
        });

        fullText += '\n';
      }

      return { text: fullText, layoutData };

    } catch (error) {
      console.error('[TextExtract] Coords Failed:', error);
      const text = await this.extractText(buffer);
      return { text, layoutData: [] };
    }
  }

  async extractText(buffer) {
    try {
      let parser = pdfParse;
      if (typeof parser !== 'function') {
        if (parser.default) parser = parser.default;
        if (parser.PDFParse) parser = parser.PDFParse;
      }

      const data = await parser(buffer);
      return data.text || '';
    } catch (error) {
      console.warn('[TextExtract] Failed (minor):', error.message);
      return '';
    }
  }

  async parsePDF(file, originalName) {
    try {
      // Support both file object (with buffer property) and raw buffer
      let validBuffer = file.buffer || file;
      if (!Buffer.isBuffer(validBuffer)) validBuffer = Buffer.from(validBuffer);

      const cloudinaryPromise = this.uploadPdfForImages(validBuffer)
        .then(data => data)
        .catch(err => {
          console.error('[Cloudinary] Background upload failed:', err.message);
          return null;
        });

      let cleanText = await this.extractText(validBuffer);
      let layoutData = [];

      try {
        const coordResult = await this.extractTextWithCoords(validBuffer);
        layoutData = coordResult.layoutData;
      } catch (e) {
        console.warn('[ParsePDF] Layout extraction error.');
      }

      const hasText = cleanText && cleanText.trim().length > 200;

      if (!hasText) {
        return await this.extractQuestionsWithAI(validBuffer, true, '', cloudinaryPromise, layoutData);
      } else {
        return await this.extractQuestionsWithAI(validBuffer, false, cleanText, cloudinaryPromise, layoutData);
      }

    } catch (error) {
      console.error('[ParsePDF] Critical Error:', error);
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  attachBBoxes(questions, layoutData) {
    if (!Array.isArray(questions)) return questions;

    const getInt = (q) => {
      if (typeof q === 'number') return q;
      const res = parseInt(q.questionNumber);
      return isNaN(res) ? 0 : res;
    };

    questions.sort((a, b) => getInt(a) - getInt(b));

    questions.forEach((q, index) => {
      const qNum = getInt(q);
      const targetPage = parseInt(q.pageNumber);

      if (!targetPage) return;

      const pageItems = layoutData.filter(item => item.page === targetPage);

      let startItem = null;
      let startItemIndex = -1;

      const strictLabelRegex = new RegExp(`(?:^|\\s)(Câu|Question|Bài)\\s*${qNum}[:.]`, 'i');

      for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        if (strictLabelRegex.test(item.text)) {
          startItem = item;
          startItemIndex = i;
          break;
        }
      }

      if (!startItem) {
        const numOnlyRegex = new RegExp(`^${qNum}[:.]`);
        for (let i = 0; i < pageItems.length; i++) {
          const item = pageItems[i];
          const text = item.text.trim();

          if (numOnlyRegex.test(text)) {
            if (item.x < 250 && text.length < 50) {
              startItem = item;
              startItemIndex = i;
              break;
            }
          }
        }
      }

      if (startItem) {
        let endY = startItem.pdfHeight;

        let nextQStartItem = null;
        let nextQOnSamePage = false;

        const nextQNum = qNum + 1;
        const nextStrictRegex = new RegExp(`(?:^|\\s)(Câu|Question|Bài)\\s*${nextQNum}[:.]`, 'i');
        const nextNumOnlyRegex = new RegExp(`^${nextQNum}[:.]`);

        // Check Same Page
        for (let j = startItemIndex + 1; j < pageItems.length; j++) {
          const item = pageItems[j];
          const t = item.text.trim();
          const isStrict = nextStrictRegex.test(t);
          const isLoose = nextNumOnlyRegex.test(t);

          if (isStrict || (isLoose && item.x < 250 && t.length < 50)) {
            if (item.y > startItem.y + 10) {
              nextQStartItem = item;
              nextQOnSamePage = true;
              break;
            }
          }
        }

        // Check Next Page
        let nextPageItems = [];
        if (!nextQStartItem) {
          nextPageItems = layoutData.filter(item => item.page === targetPage + 1);

          for (let j = 0; j < nextPageItems.length; j++) {
            const item = nextPageItems[j];
            const t = item.text.trim();
            const isStrict = nextStrictRegex.test(t);
            const isLoose = nextNumOnlyRegex.test(t);

            if (isStrict || (isLoose && item.x < 250 && t.length < 50)) {
              nextQStartItem = item;
              nextQOnSamePage = false;
              break;
            }
          }

          if (!nextQStartItem && nextPageItems.length > 0) {
            nextPageItems.sort((a, b) => a.y - b.y);

            const pdfH = startItem.pdfHeight || 842;
            const spaceOnCurrent = pdfH - startItem.y;

            // If current page is cramped OR next page starts with a gap
            if (spaceOnCurrent < 250 || nextPageItems[0].y > 50) {
              nextQStartItem = nextPageItems[0];
              nextQOnSamePage = false;
            }
          }
        }

        const imageKeywords = ['như hình vẽ', 'hình bên', 'xem hình', 'bảng biến thiên', 'đồ thị hình bên', 'đồ thị hàm số bên', 'bảng xét dấu', 'như sau'];
        const needsImage = (q.hasImage === true) || imageKeywords.some(kw => (q.questionText || '').toLowerCase().includes(kw));

        if (needsImage) {
          let useNextPage = false;
          const pdfH = startItem.pdfHeight || 842;

          if (nextQStartItem) {
            if (nextQOnSamePage) {
              endY = nextQStartItem.y;
            } else {
              const spaceOnCurrent = pdfH - startItem.y;
              const spaceOnNext = nextQStartItem.y;

              if (spaceOnCurrent < 150 || spaceOnNext > spaceOnCurrent || spaceOnNext > 100) {
                useNextPage = true;
                endY = nextQStartItem.y;
              }
            }
          }

          const optionRegex = /(?:^|\s)[A-D][.:]\s/i;

          if (useNextPage) {
            if (nextPageItems.length === 0) {
              nextPageItems = layoutData.filter(item => item.page === targetPage + 1);
              nextPageItems.sort((a, b) => a.y - b.y);
            }
            for (let item of nextPageItems) {
              if (item.y >= endY) break;
              if (optionRegex.test(item.text)) {
                endY = item.y;
                break;
              }
            }
          } else {
            for (let j = startItemIndex + 1; j < pageItems.length; j++) {
              const item = pageItems[j];
              if (item.y >= endY) break;
              if (optionRegex.test(item.text)) {
                endY = item.y;
                break;
              }
            }
          }

          const topBuffer = 15;
          const bottomBuffer = 2;

          if (useNextPage) {
            const ymin = 0;
            const ymax = Math.floor(((endY - bottomBuffer) / pdfH) * 1000);
            const targetP = targetPage + 1;

            if (ymax > ymin + 50) {
              q.bbox = [ymin, 0, ymax, 1000];
              q.pageNumber = targetP;
            }
          } else {
            const ymin = Math.floor(((startItem.y + topBuffer) / pdfH) * 1000);
            const ymax = Math.floor(((endY - bottomBuffer) / pdfH) * 1000);

            if (ymax > ymin + 30) {
              q.bbox = [ymin, 0, ymax, 1000];
              q.pageNumber = startItem.page;
            }
          }
        }
      }
    });

    return questions;
  }

  async extractQuestionsWithAI(pdfBuffer, isImageMode, rawText = '', cloudinaryPromise, layoutData = []) {
    const aiService = require('./aiService');
    let allQuestions = [];

    if (isImageMode) {
      const partitions = [
        { label: 'Part 1', instruction: 'Hãy trích xuất các câu hỏi từ ĐẦU ĐỀ đến câu số 30. Dừng lại sau câu 30.' },
        { label: 'Part 2', instruction: 'Hãy BỎ QUA 30 câu đầu tiên. Chỉ trích xuất từ câu số 31 đến hết đề.' }
      ];

      const results = [];
      for (const part of partitions) {
        try {
          const promptInput = this.prompt + `\n\nNHIỆM VỤ PARTITION (${part.label}):\n${part.instruction}\n\nXử lý file PDF đính kèm.`;
          const attachments = [{ mimeType: 'application/pdf', data: pdfBuffer.toString('base64') }];
          const aiResponse = await aiService.generateResponseFile(promptInput, attachments);
          const qs = this.parseAIResponse(aiResponse);
          results.push(qs);
        } catch (e) {
          console.error(`[AI] ${part.label} Failed:`, e.message);
          results.push([]);
        }
      }
      results.forEach(qs => allQuestions.push(...qs));

    } else {
      const CHUNK_SIZE = 12000;
      const totalLength = rawText.length;
      if (totalLength < CHUNK_SIZE * 1.2) {
        const promptInput = this.prompt + `\n\nNỘI DUNG VĂN BẢN PDF:\n${rawText}`;
        const aiResponse = await aiService.generateResponseFile(promptInput, []);
        allQuestions = this.parseAIResponse(aiResponse);
      } else {
        const chunks = [];
        for (let i = 0; i < totalLength; i += CHUNK_SIZE) {
          chunks.push(rawText.substring(i, Math.min(i + CHUNK_SIZE + 1000, totalLength)));
        }
        const chunkPromises = chunks.map(async (chunk, idx) => {
          await new Promise(r => setTimeout(r, idx * 1000));
          const promptInput = this.prompt + `\n\n(PHẦN ${idx + 1}/${chunks.length})\nNỘI DUNG:\n${chunk}`;
          try {
            const resp = await aiService.generateResponseFile(promptInput, []);
            return this.parseAIResponse(resp);
          } catch (e) {
            return [];
          }
        });
        const results = await Promise.all(chunkPromises);
        results.forEach(qs => allQuestions.push(...qs));
      }
    }

    allQuestions = this.sanitizeQuestions(allQuestions);
    allQuestions = this.deduplicateAndSort(allQuestions);

    if (layoutData && layoutData.length > 0) {
      allQuestions = this.attachBBoxes(allQuestions, layoutData);
    }

    let pdfCloudinaryData = null;
    try {
      pdfCloudinaryData = await cloudinaryPromise;
    } catch (e) { /* ignore */ }

    const maxPage = allQuestions.reduce((max, q) => Math.max(max, q.pageNumber || 1), 1);
    let pageImages = [];

    if (pdfCloudinaryData) {
      const { public_id, width, height } = pdfCloudinaryData;
      pageImages = this.generatePageImageUrls(public_id, maxPage);

      allQuestions.forEach(q => {
        if (q.bbox && q.bbox.length === 4) {
          const cropUrl = this.generateCloudinaryCropUrl(public_id, q.pageNumber || 1, q.bbox, width, height);
          if (cropUrl) {
            q.images = [cropUrl];
            q.image = cropUrl;
          }
        }
      });
    } else {
      pageImages = await this.convertPagesToImages(null, maxPage);
    }

    return {
      totalQuestions: allQuestions.length,
      pages: this.organizeByPages(allQuestions, pageImages)
    };
  }

  parseAIResponse(aiResponse) {
    if (!aiResponse) return [];
    try {
      const startIdx = aiResponse.indexOf('[');
      const endIdx = aiResponse.lastIndexOf(']');
      if (startIdx === -1 || endIdx === -1) return [];
      const jsonStr = aiResponse.substring(startIdx, endIdx + 1);
      return JSON.parse(jsonStr);
    } catch (e) {
      return [];
    }
  }

  sanitizeQuestions(questions) {
    if (!Array.isArray(questions)) return [];
    return questions.map(q => {
      const fixLatex = (str) => {
        if (!str) return '';
        let s = str;

        s = s.replace(/\\begin\s*\{cases\}/g, '\\begin{cases}');
        s = s.replace(/\\end\s*\{cases\}/g, '\\end{cases}');

        const firstEnd = s.indexOf('\\end{cases}');
        const firstBegin = s.indexOf('\\begin{cases}');
        if (firstEnd !== -1) {
          if (firstBegin === -1 || firstBegin > firstEnd) {
            s = '\\begin{cases} ' + s;
          }
        }

        let openCount = (s.match(/\\begin\{cases\}/g) || []).length;
        let closeCount = (s.match(/\\end\{cases\}/g) || []).length;
        if (openCount > closeCount) {
          s += ' \\end{cases}'.repeat(openCount - closeCount);
        }
        openCount = (s.match(/\\begin\{cases\}/g) || []).length;
        closeCount = (s.match(/\\end\{cases\}/g) || []).length;
        if (closeCount > openCount) {
          s = '\\begin{cases} '.repeat(closeCount - openCount) + s;
        }

        s = s.replace(/\\(leq|geq|in(?!fty|t|f)|approx|neq|times|div)(?=[a-zA-Z0-9])/g, '\\$1 ');

        const casesRegex = /(\\begin\{cases\}[\s\S]*?\\end\{cases\})/g;
        s = s.replace(casesRegex, (match) => {
          let inner = match.replace(/\$/g, '');
          return inner;
        });

        // 7. SMART WRAPPING: Context-aware cases handling
        // Heuristic: Count number of $ before the block. If Even -> Text Mode (Wrap). If Odd -> Math Mode (Keep).
        s = s.replace(casesRegex, (match, p1, offset, originalString) => {
          const prefix = originalString.substring(0, offset);
          const dollarCount = (prefix.match(/\$/g) || []).length;
          const isInsideMath = (dollarCount % 2 === 1);

          if (isInsideMath) {
            return match; // Already in math ($...cases...), leave as is
          } else {
            return '$' + match + '$'; // Text mode, must wrap
          }
        });

        // Final Cleanup
        s = s.replace(/\$\$\s*\\begin\{cases\}/g, '$\\begin{cases}');
        s = s.replace(/\\end\{cases\}\s*\$\$/g, '\\end{cases}$');

        return s;
      };

      if (q.questionText) q.questionText = fixLatex(q.questionText);
      if (q.answers && Array.isArray(q.answers)) {
        q.answers.forEach(a => {
          if (a.text) a.text = fixLatex(a.text);
        });
      }
      return q;
    });
  }

  async uploadPdfForImages(buffer) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'pdf-exams-source', resource_type: 'image', format: 'pdf' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  generatePageImageUrls(publicId, count) {
    const images = [];
    for (let i = 1; i <= count; i++) {
      const url = cloudinary.url(publicId, {
        page: i,
        resource_type: 'image',
        format: 'jpg',
        transformation: [{ quality: "auto", width: 1000, crop: "scale" }]
      });
      images.push({ pageNumber: i, imageUrl: url });
    }
    return images;
  }

  generateCloudinaryCropUrl(publicId, page, bbox, pdfW, pdfH) {
    if (!bbox || bbox.length !== 4) return null;
    let [ymin, xmin, ymax, xmax] = bbox;
    ymin = Math.max(0, ymin); xmin = Math.max(0, xmin);
    ymax = Math.min(1000, ymax); xmax = Math.min(1000, xmax);
    if (xmax <= xmin || ymax <= ymin) return null;

    return cloudinary.url(publicId, {
      page: page,
      resource_type: 'image',
      format: 'jpg',
      transformation: [
        {
          x: (xmin / 1000).toFixed(3),
          y: (ymin / 1000).toFixed(3),
          width: ((xmax - xmin) / 1000).toFixed(3),
          height: ((ymax - ymin) / 1000).toFixed(3),
          crop: 'crop',
          flags: 'relative'
        },
        { quality: 'auto' }
      ]
    });
  }

  deduplicateAndSort(questions) {
    const getNum = q => { const m = String(q.questionNumber).match(/\d+/); return m ? parseInt(m[0], 10) : 999999; };
    questions.sort((a, b) => getNum(a) - getNum(b));
    const unique = []; const seen = new Set();
    for (const q of questions) {
      const sig = (q.questionText || '').slice(0, 100).trim();
      if (sig && !seen.has(sig)) { seen.add(sig); unique.push(q); }
    }
    unique.forEach((q, i) => q.questionNumber = i + 1);
    return unique;
  }

  organizeByPages(questions, pageImages) {
    const questionsByPage = {};
    questions.forEach(q => {
      const pNum = q.pageNumber || 1;
      if (!questionsByPage[pNum]) questionsByPage[pNum] = [];
      questionsByPage[pNum].push(q);
    });
    const sortedPageParams = Object.keys(questionsByPage).map(Number).sort((a, b) => a - b);
    return sortedPageParams.map(pageNum => {
      const pageImgObj = pageImages.find(img => img.pageNumber === pageNum);
      return {
        pageNumber: pageNum,
        imageUrl: pageImgObj ? pageImgObj.imageUrl : null,
        questions: questionsByPage[pageNum]
      };
    });
  }

  async convertPagesToImages(pdfBuffer, pageCount) {
    try {
      const images = [];
      for (let i = 0; i < pageCount; i++) {
        const svgImage = `
        <svg width="800" height="1131" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f0f0f0"/>
          <text x="50%" y="50%" font-size="40" text-anchor="middle" fill="#555" font-family="Arial">Trang ${i + 1}</text>
          <text x="50%" y="60%" font-size="20" text-anchor="middle" fill="#888" font-family="Arial">(Không thể hiển thị ảnh PDF gốc trong môi trường này)</text>
        </svg>
        `;
        const buffer = await sharp(Buffer.from(svgImage)).png().toBuffer();
        const imageUrl = await this.uploadToCloudinary(buffer, `pdf-page-placeholder-${Date.now()}-${i + 1}`);
        images.push({ pageNumber: i + 1, imageUrl: imageUrl });
      }
      return images;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      return [];
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
            console.error('Cloudinary Upload Error:', error);
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      );
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }
}

module.exports = new PDFParserService();

# 📚 Tài Liệu Hướng Dẫn Tính Năng Thi (Exam Features)

## 📋 Tổng Quan

Tài liệu này mô tả các tính năng thi đã được triển khai trong hệ thống EduMap, bao gồm:
- Làm bài thi (Take Exam)
- Chấm điểm tự động
- Giám sát (Proctoring)
- Báo cáo và thống kê

---

## 🎯 Tuần 4: Làm Bài & Chấm Điểm

### Ngày 22: Model Submission

**Mô tả:** Model Submission đã được tạo với các trường:
- `answers[]`: Mảng câu trả lời
- `score`: Điểm số
- `status`: Trạng thái (in_progress, submitted, graded, late)
- `timeSpent`: Thời gian làm bài (giây)
- `proctoringData`: Dữ liệu giám sát

**File:** `src/models/Submission.js`

---

### Ngày 23: API Bắt Đầu Làm Bài

**Endpoint:** `POST /v1/api/submissions/start`

**Request:**
```json
{
  "examId": "exam_id_here",
  "password": "exam_password" // optional
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "submission": {
      "_id": "submission_id",
      "examId": "exam_id",
      "userId": "user_id",
      "questionOrder": ["q1", "q2", "q3"],
      "startedAt": "2024-01-01T00:00:00Z",
      "status": "in_progress"
    },
    "exam": {
      "_id": "exam_id",
      "name": "Math Final Exam",
      "questions": [...],
      "duration": 120
    },
    "questionOrder": ["q1", "q2", "q3"]
  }
}
```

**Tính năng:**
- Kiểm tra mật khẩu exam (nếu có)
- Kiểm tra số lần làm bài tối đa
- Shuffle câu hỏi và đáp án (nếu được bật)
- Tạo submission mới hoặc trả về submission đang làm dở

**File:** 
- Backend: `src/services/submissionService.js`, `src/controllers/submissionController.js`
- Frontend: `src/api/submissionService.js`

---

### Ngày 24: Trang TakeExam

**Route:** `/student/exam/:examId/take`

**Tính năng:**
- ✅ Hiển thị câu hỏi theo thứ tự
- ✅ Timer đếm ngược theo duration
- ✅ Điều hướng giữa các câu hỏi
- ✅ Hiển thị progress bar
- ✅ Hỗ trợ các loại câu hỏi: MCQ, True/False, Short Answer, Essay

**UI Components:**
- Question navigation sidebar
- Question card với answer inputs
- Timer hiển thị thời gian còn lại
- Progress bar hiển thị số câu đã trả lời

**File:** `src/pages/student/TakeExam.jsx`

---

### Ngày 25: Auto-save

**Endpoint:** `PATCH /v1/api/submissions/:id/answers`

**Tính năng:**
- Tự động lưu câu trả lời mỗi 15 giây
- Lưu thủ công bằng nút "Save"
- Hiển thị trạng thái lưu (saving, saved, error)

**Request:**
```json
{
  "answers": [
    {
      "questionId": "question_id",
      "value": "answer_value"
    }
  ]
}
```

**File:**
- Backend: `src/services/submissionService.js` → `updateSubmissionAnswers()`
- Frontend: `src/pages/student/TakeExam.jsx` → `handleAutoSave()`

---

### Ngày 26: Nộp Bài & Chấm Điểm

**Endpoint:** `POST /v1/api/submissions/:id/submit`

**Tính năng:**
- Chấm điểm tự động cho MCQ, True/False, Short Answer
- Tính điểm dựa trên marks của từng câu
- Kiểm tra thời gian (có cho phép nộp muộn không)
- Cập nhật trạng thái submission

**Chấm điểm:**
- **MCQ/True-False:** So sánh chính xác với đáp án
- **Short Answer:** So sánh không phân biệt hoa thường
- **Essay:** Không tự động chấm (0 điểm, cần giáo viên chấm thủ công)

**Response:**
```json
{
  "ok": true,
  "data": {
    "_id": "submission_id",
    "score": 85,
    "maxScore": 100,
    "percentage": 85,
    "status": "graded",
    "answers": [
      {
        "questionId": "q1",
        "value": "answer",
        "isCorrect": true,
        "points": 10
      }
    ]
  }
}
```

**File:** `src/services/submissionService.js` → `submitExam()`

---

### Ngày 27: Hiển Thị Kết Quả

**Tính năng:**
- Hiển thị điểm sau khi nộp bài (nếu `viewMark` cho phép)
- Hiển thị câu trả lời đúng/sai
- Hiển thị giải thích (nếu có)
- Lưu lịch sử vào Results page

**Route:** `/student/results/:submissionId`

**File:** `src/pages/student/Results.jsx` (cần cập nhật)

---

### Ngày 28: Chống Gian Lận

**Server-side:**
- ✅ Shuffle câu hỏi (nếu `settings.randomizeQuestionOrder = true`)
- ✅ Shuffle đáp án (nếu `settings.randomizeChoiceOrder = true`)
- ✅ Mỗi học sinh có thứ tự câu hỏi khác nhau

**Client-side:**
- ✅ Disable copy/paste
- ✅ Disable right-click
- ✅ Disable developer tools (F12, Ctrl+Shift+I)
- ✅ Log các sự kiện: visibility change, fullscreen change, beforeunload

**File:**
- Backend: `src/services/submissionService.js` → `startSubmission()`
- Frontend: `src/pages/student/TakeExam.jsx` → useEffect với event listeners

---

## 🎯 Tuần 5: Giám Sát & Báo Cáo

### Ngày 29: Model ProctorLog

**Mô tả:** Model ProctorLog đã được tạo với các trường:
- `submissionId`: ID submission
- `userId`: ID học sinh
- `event`: Loại sự kiện (visibility, fullscreen, beforeunload, etc.)
- `severity`: Mức độ nghiêm trọng (low, medium, high, critical)
- `meta`: Metadata bổ sung

**File:** `src/models/ProctorLog.js`

---

### Ngày 30: Client Ghi Log

**Endpoint:** `POST /v1/api/proctor/log`

**Tính năng:**
- Tự động ghi log khi:
  - Tab bị chuyển (visibilitychange)
  - Fullscreen thay đổi (fullscreenchange)
  - Trang bị đóng (beforeunload)
  - Copy/paste được thực hiện
  - Right-click được thực hiện

**Request:**
```json
{
  "submissionId": "submission_id",
  "event": "visibility",
  "severity": "medium",
  "meta": {
    "visible": false,
    "reason": "Tab switched"
  }
}
```

**File:**
- Backend: `src/controllers/proctorController.js`
- Frontend: `src/pages/student/TakeExam.jsx` → event listeners

---

### Ngày 31: Trang Monitor

**Route:** `/teacher/exams/:examId/monitor`

**Tính năng:**
- ✅ Xem tất cả submissions của một exam
- ✅ Xem proctoring logs theo submission
- ✅ Filter theo submission và severity
- ✅ Hiển thị violations và warnings

**UI Components:**
- Submissions overview table
- Proctoring logs table với filters
- Severity indicators

**File:** `src/pages/teacher/Monitor.jsx`

---

### Ngày 32: Báo Cáo Lớp API

**Endpoint:** `GET /v1/api/reports/class/:classId?examId=exam_id`

**Response:**
```json
{
  "ok": true,
  "data": {
    "classId": "class_id",
    "examId": "exam_id",
    "totalStudents": 30,
    "totalSubmissions": 25,
    "statistics": {
      "averageScore": 75.5,
      "minScore": 45,
      "maxScore": 100,
      "averagePercentage": 75.5,
      "passRate": 80
    },
    "scoreDistribution": [
      { "range": "0-20", "count": 2, "percentage": 8 },
      { "range": "21-40", "count": 3, "percentage": 12 },
      ...
    ],
    "questionAnalysis": [
      {
        "questionId": "q1",
        "questionText": "Question text",
        "correctCount": 20,
        "totalAttempts": 25,
        "incorrectCount": 5,
        "accuracyRate": 80
      }
    ],
    "submissions": [...]
  }
}
```

**File:** `src/services/reportService.js`

---

### Ngày 33: UI Reports

**Route:** `/teacher/classes/:classId/reports`

**Tính năng:**
- ✅ Hiển thị statistics (average, min, max, pass rate)
- ✅ Score distribution chart
- ✅ Bảng câu hỏi sai nhiều nhất
- ✅ Bảng submissions của học sinh
- ✅ Export CSV

**UI Components:**
- Statistics cards
- Score distribution
- Question analysis table
- Submissions table

**File:** `src/pages/teacher/Reports.jsx`

---

### Ngày 34: Export CSV

**Endpoint:** `GET /v1/api/reports/class/:classId/export?examId=exam_id`

**Tính năng:**
- Export báo cáo lớp ra file CSV
- Bao gồm: Student Name, Email, Score, Max Score, Percentage, Status, Submitted At

**File:** `src/services/reportService.js` → `exportClassReportCSV()`

---

## 📝 API Endpoints Summary

### Submissions
- `POST /v1/api/submissions/start` - Bắt đầu làm bài
- `GET /v1/api/submissions/:id` - Lấy submission theo ID
- `PATCH /v1/api/submissions/:id/answers` - Cập nhật câu trả lời
- `POST /v1/api/submissions/:id/submit` - Nộp bài
- `GET /v1/api/submissions/exam/:examId` - Lấy tất cả submissions của exam

### Proctor
- `POST /v1/api/proctor/log` - Ghi log giám sát
- `GET /v1/api/proctor/submission/:submissionId` - Lấy logs của submission
- `GET /v1/api/proctor/exam/:examId` - Lấy logs của exam

### Reports
- `GET /v1/api/reports/class/:classId` - Lấy báo cáo lớp
- `GET /v1/api/reports/class/:classId/export` - Export CSV

---

## 🚀 Hướng Dẫn Sử Dụng

### Cho Học Sinh

1. **Bắt đầu làm bài:**
   - Vào trang exam detail
   - Click "Start Exam"
   - Nhập mật khẩu (nếu có)
   - Bắt đầu làm bài

2. **Làm bài:**
   - Chọn câu trả lời cho từng câu
   - Sử dụng navigation để chuyển câu
   - Câu trả lời tự động lưu mỗi 15 giây
   - Có thể lưu thủ công bằng nút "Save"

3. **Nộp bài:**
   - Click "Submit Exam"
   - Xác nhận nộp bài
   - Xem kết quả (nếu được phép)

### Cho Giáo Viên

1. **Giám sát:**
   - Vào `/teacher/exams/:examId/monitor`
   - Xem submissions và proctoring logs
   - Filter theo submission hoặc severity

2. **Xem báo cáo:**
   - Vào `/teacher/classes/:classId/reports`
   - Xem statistics và phân tích
   - Export CSV nếu cần

---

## 🔧 Cấu Hình

### Exam Settings liên quan:

```javascript
{
  settings: {
    randomizeQuestionOrder: true,  // Shuffle câu hỏi
    randomizeChoiceOrder: true,    // Shuffle đáp án
    allowLateSubmission: false,    // Cho phép nộp muộn
    timeLimit: true                // Giới hạn thời gian
  },
  viewMark: 1,  // 0: never, 1: afterCompletion, 2: afterAllFinish
  viewExamAndAnswer: 1,
  maxAttempts: 3  // Số lần làm bài tối đa
}
```

---

## 📌 Lưu Ý

1. **Auto-save:** Mặc định lưu mỗi 15 giây, có thể điều chỉnh trong code
2. **Timer:** Tự động submit khi hết thời gian (nếu không cho phép nộp muộn)
3. **Proctoring:** Logs được lưu 90 ngày (TTL index)
4. **Chấm điểm:** Chỉ tự động chấm MCQ, True/False, Short Answer. Essay cần chấm thủ công.

---

## 🐛 Troubleshooting

### Lỗi "Maximum attempts reached"
- Kiểm tra `maxAttempts` của exam
- Xóa các submission cũ nếu cần

### Auto-save không hoạt động
- Kiểm tra network connection
- Kiểm tra console logs
- Thử lưu thủ công

### Timer không chính xác
- Kiểm tra `startedAt` của submission
- Kiểm tra `duration` của exam (đơn vị: phút)

---

## 📚 Files Created/Modified

### Backend
- `src/models/Submission.js` (đã có, đã kiểm tra)
- `src/models/ProctorLog.js` (đã có, đã kiểm tra)
- `src/services/submissionService.js` (mới)
- `src/controllers/submissionController.js` (mới)
- `src/services/reportService.js` (mới)
- `src/controllers/reportController.js` (mới)
- `src/controllers/proctorController.js` (mới)
- `src/routes/submissions.js` (mới)
- `src/routes/proctor.js` (mới)
- `src/routes/reports.js` (mới)

### Frontend
- `src/api/submissionService.js` (mới)
- `src/api/proctorService.js` (mới)
- `src/api/reportService.js` (mới)
- `src/pages/student/TakeExam.jsx` (mới)
- `src/pages/student/TakeExam.css` (mới)
- `src/pages/teacher/Monitor.jsx` (mới)
- `src/pages/teacher/Monitor.css` (mới)
- `src/pages/teacher/Reports.jsx` (mới)
- `src/pages/teacher/Reports.css` (mới)
- `src/routes/index.jsx` (đã cập nhật)

---

**Tài liệu được tạo:** 2024
**Phiên bản:** 1.0


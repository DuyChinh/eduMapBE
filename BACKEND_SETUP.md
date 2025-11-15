# Backend Setup - Exam Statistics Features

## Tổng quan các thay đổi

Backend đã được cập nhật để hỗ trợ các tính năng mới cho Exam Management:

### 1. Model mới: ActivityLog
- **File**: `src/models/ActivityLog.js`
- **Mục đích**: Tracking hoạt động của học sinh trong quá trình làm bài
- **Chức năng**:
  - Ghi lại các hành động: answer, tab_switch, copy_attempt, paste_attempt, etc.
  - Đánh dấu suspicious activities
  - Tính toán severity level

### 2. Controller mới: examStatsController
- **File**: `src/controllers/examStatsController.js`
- **Endpoints mới**:
  - `GET /v1/api/exams/:examId/statistics` - Thống kê tổng quan
  - `GET /v1/api/exams/:examId/leaderboard` - Bảng xếp hạng
  - `GET /v1/api/exams/:examId/submissions` - Danh sách bài nộp
  - `GET /v1/api/exams/:examId/submissions/:studentId` - Chi tiết bài làm học sinh
  - `GET /v1/api/exams/:examId/submissions/:studentId/activity` - Activity log
  - `GET /v1/api/exam-results` - Lịch sử thi của học sinh
  - `GET /v1/api/exam-results/subject-averages` - Điểm trung bình theo môn

### 3. Routes mới
- **File**: `src/routes/examResults.js`
- **Mục đích**: Routes cho exam results history và statistics

### 4. Migration mới
- **File**: `src/migrations/021_create_activity_logs_collection.js`
- **Mục đích**: Tạo collection ActivityLogs với đầy đủ indexes

## Hướng dẫn cài đặt

### Bước 1: Cấu hình .env

Đảm bảo file `.env` hoặc `.env (2)` có các biến sau:

```env
# Database connection
DATABASE_MG_URL=mongodb://localhost:27017/edumap
MIGRATE_MG_URL=mongodb://localhost:27017/edumap

# JWT Secret
JWT_SECRET=your-secret-key

# Port
PORT=5000
```

### Bước 2: Chạy Migration

```bash
# Xem trạng thái migrations
npm run migrate:status

# Chạy migration mới
npm run migrate:up

# Hoặc nếu muốn migrate down
npm run migrate:down
```

### Bước 3: Khởi động server

```bash
# Development mode
npm start

# Production mode
node src/app.js
```

## API Documentation

### 1. Exam Statistics

**GET** `/v1/api/exams/:examId/statistics`

**Response:**
```json
{
  "ok": true,
  "data": {
    "totalSubmissions": 25,
    "averageScore": 75.5,
    "highestScore": 95,
    "lowestScore": 45,
    "passRate": 80.5,
    "completionRate": 90.0,
    "totalMarks": 100
  }
}
```

### 2. Exam Leaderboard

**GET** `/v1/api/exams/:examId/leaderboard?limit=50`

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "rank": 1,
      "student": {
        "_id": "...",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": "...",
        "studentCode": "ST001"
      },
      "score": 95,
      "totalMarks": 100,
      "percentage": 95,
      "timeSpent": 3600,
      "submittedAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### 3. Exam Submissions

**GET** `/v1/api/exams/:examId/submissions`

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "_id": "...",
      "student": {
        "_id": "...",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "status": "submitted",
      "score": 85,
      "totalMarks": 100,
      "percentage": 85,
      "timeSpent": 3600,
      "startedAt": "2024-01-01T09:00:00Z",
      "submittedAt": "2024-01-01T10:00:00Z",
      "attemptNumber": 1
    }
  ]
}
```

### 4. Student Submission Detail

**GET** `/v1/api/exams/:examId/submissions/:studentId`

**Response:**
```json
{
  "ok": true,
  "data": {
    "_id": "...",
    "exam": {
      "_id": "...",
      "name": "Midterm Exam",
      "totalMarks": 100
    },
    "student": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "score": 85,
    "totalMarks": 100,
    "percentage": 85,
    "timeSpent": 3600,
    "submittedAt": "2024-01-01T10:00:00Z",
    "answers": [
      {
        "question": {
          "_id": "...",
          "name": "Question 1",
          "text": "What is 2+2?",
          "type": "mcq",
          "correctAnswer": "4"
        },
        "selectedAnswer": "4",
        "isCorrect": true,
        "earnedMarks": 5,
        "marks": 5
      }
    ],
    "suspiciousActivities": [
      {
        "type": "tab_switch",
        "count": 3
      }
    ]
  }
}
```

### 5. Activity Log

**GET** `/v1/api/exams/:examId/submissions/:studentId/activity`

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "_id": "...",
      "type": "start",
      "action": "Started exam",
      "timestamp": "2024-01-01T09:00:00Z",
      "isSuspicious": false,
      "severity": "low"
    },
    {
      "_id": "...",
      "type": "tab_switch",
      "action": "Switched browser tab",
      "timestamp": "2024-01-01T09:15:00Z",
      "isSuspicious": true,
      "severity": "medium"
    }
  ]
}
```

### 6. Exam Results History

**GET** `/v1/api/exam-results?subject=MATH&status=submitted`

**Response:**
```json
{
  "ok": true,
  "data": {
    "examHistory": [
      {
        "_id": "...",
        "examId": "...",
        "exam": {
          "name": "Midterm Exam",
          "subject": "MATH"
        },
        "score": 85,
        "totalMarks": 100,
        "percentage": 85,
        "status": "submitted",
        "submittedAt": "2024-01-01T10:00:00Z"
      }
    ],
    "overallStats": {
      "totalExams": 10,
      "averageScore": 78.5,
      "totalTimeSpent": 36000,
      "passRate": 85.0
    }
  }
}
```

### 7. Subject Averages

**GET** `/v1/api/exam-results/subject-averages`

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "subject": "MATH",
      "examCount": 5,
      "averageScore": 82.5,
      "totalMarks": 100,
      "highestScore": 95
    }
  ]
}
```

## Database Schema

### ActivityLog Collection

```javascript
{
  submissionId: ObjectId,
  examId: ObjectId,
  userId: ObjectId,
  type: String, // 'start', 'answer', 'tab_switch', etc.
  action: String,
  details: Object,
  timestamp: Date,
  isSuspicious: Boolean,
  severity: String, // 'low', 'medium', 'high'
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

- `submissionId` + `timestamp`
- `examId` + `userId`
- `userId` + `isSuspicious`
- `type` + `timestamp`

## Permissions

- **Teacher/Admin**: 
  - Có thể xem statistics, leaderboard, submissions của exams họ sở hữu
  - Admin có thể xem tất cả

- **Student**:
  - Chỉ có thể xem exam results của chính mình
  - Có thể xem leaderboard nếu exam không bật `hideLeaderboard`

## Testing

Để test các API endpoints:

```bash
# 1. Tạo exam
curl -X POST http://localhost:5000/v1/api/exams \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Exam", "duration":60, ...}'

# 2. Get statistics
curl http://localhost:5000/v1/api/exams/EXAM_ID/statistics \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Get leaderboard
curl http://localhost:5000/v1/api/exams/EXAM_ID/leaderboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Migration errors

Nếu gặp lỗi `No url defined in config file`:

1. Kiểm tra file `.env` có biến `MIGRATE_MG_URL`
2. Chạy: `npm run migrate:status` để xem trạng thái
3. Copy từ `.env (2)` nếu cần

### Connection errors

Nếu không kết nối được database:

1. Kiểm tra MongoDB đang chạy: `brew services list | grep mongodb`
2. Kiểm tra `DATABASE_MG_URL` trong `.env`
3. Test connection: `mongosh YOUR_MONGODB_URL`

## Notes

- ActivityLog collection sẽ lưu trữ rất nhiều records, cần setup cleanup job định kỳ
- Indexes đã được tối ưu cho các queries thường dùng
- Tất cả timestamps đều sử dụng UTC
- Phân quyền đã được implement đầy đủ cho từng endpoint


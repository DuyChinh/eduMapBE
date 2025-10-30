# Exam API Documentation

## Overview
The Exam API provides endpoints for managing exams, including creating exams, adding questions, and managing exam settings. This API supports comprehensive exam management with flexible settings and question validation.

## Base URL
```
http://localhost:3000/v1/api/exams
```

## Authentication
All endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer {token}
```

## Permissions
- **Teachers**: Can create, read, update, and delete their own exams
- **Admins**: Can manage all exams
- **Students**: Cannot access exam management endpoints

## Endpoints

### 1. Create Exam
**POST** `/exams`

Creates a new exam.

#### Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "Math Final Exam",
  "description": "Final exam for Grade 10 Math",
  "duration": 120,
  "totalMarks": 100,
  "subjectId": "68f254ffef3cded20b0e2110",
  "gradeId": "68f254ffef3cded20b0e2111",
  "examPurpose": "exam",
  "isAllowUser": "everyone",
  "examPassword": "exam123",
  "maxAttempts": 3,
  "viewMark": 1,
  "viewExamAndAnswer": 1,
  "availableFrom": "2024-01-15T08:00:00Z",
  "availableUntil": "2024-01-15T18:00:00Z",
  "fee": 0,
  "questions": [
    {
      "questionId": "68e783537ceeea23e3d0e061",
      "order": 1,
      "marks": 20,
      "isRequired": true
    },
    {
      "questionId": "68e750fa7d0ffb21a570524e",
      "order": 2,
      "marks": 30,
      "isRequired": true
    }
  ],
  "startTime": "2024-12-01T08:00:00.000Z",
  "endTime": "2024-12-01T10:30:00.000Z",
  "timezone": "Asia/Ho_Chi_Minh",
  "autoMonitoring": "off",
  "studentVerification": false,
  "eduMapOnly": false,
  "hideGroupTitles": false,
  "sectionsStartFromQ1": false,
  "hideLeaderboard": false,
  "addTitleInfo": false,
  "preExamNotification": false,
  "preExamNotificationText": "Chúc bạn làm bài tốt!",
  "settings": {
    "allowReview": true,
    "showCorrectAnswer": false,
    "shuffleQuestions": false,
    "shuffleChoices": false,
    "timeLimit": true,
    
    "teacherCanStart": true,
    "teacherCanPause": true,
    "teacherCanStop": true,
    "showProgress": true,
    "showTimer": true,
    "allowSkip": false,
    "allowBack": true,
    "autoSubmit": false,
    "confirmSubmit": true,
    "allowLateSubmission": false,
    "preventCopy": false,
    "preventRightClick": false,
    "fullscreenMode": false,
    "notifyOnStart": true,
    "notifyOnSubmit": true,
    "notifyOnTimeWarning": true,
    "questionPerPage": 1,
    "saveProgress": true,
    "allowReviewAfterSubmit": false,
    "showQuestionNumbers": true,
    "allowMarkForReview": true,
    "showAnswerExplanation": false,
    "allowQuestionFeedback": false,
    "randomizeQuestionOrder": false,
    "randomizeChoiceOrder": false,
    "allowPartialCredit": false,
    "showScoreImmediately": false,
    "allowRetake": false,
    "maxRetakeAttempts": 0,
    "retakeDelay": 0,
    "timeWarningThreshold": 5,
    "gracePeriod": 0,
    "lateSubmissionPenalty": 0,
    "theme": "default",
    "fontSize": "medium",
    "showNavigation": true,
    "showQuestionList": true,
    "allowFullscreen": true,
    "showInstructions": true,
    "instructions": ""
  }
}
```

#### Response
```json
{
  "ok": true,
  "data": {
    "_id": "68f6f6c620ab14a45e11315b",
    "name": "Math Final Exam",
    "description": "Final exam for Grade 10 Math",
    "duration": 120,
    "totalMarks": 100,
    "questions": [
      {
        "questionId": "68e783537ceeea23e3d0e061",
        "order": 1,
        "marks": 20,
        "isRequired": true
      },
      {
        "questionId": "68e750fa7d0ffb21a570524e",
        "order": 2,
        "marks": 30,
        "isRequired": true
      }
    ],
    "startTime": "2024-12-01T08:00:00.000Z",
    "endTime": "2024-12-01T10:30:00.000Z",
    "timezone": "Asia/Ho_Chi_Minh",
    "subjectId": "68f254ffef3cded20b0e2110",
    "subjectCode": "MATH",
    "gradeId": "68f254ffef3cded20b0e2111",
    "examPurpose": "exam",
    "isAllowUser": "everyone",
    "availableFrom": "2024-01-15T08:00:00Z",
    "availableUntil": "2024-01-15T18:00:00Z",
    "fee": 0,
    "examPassword": "exam123",
    "maxAttempts": 3,
    "viewMark": 1,
    "viewExamAndAnswer": 1,
    "autoMonitoring": "off",
    "studentVerification": false,
    "eduMapOnly": false,
    "hideGroupTitles": false,
    "sectionsStartFromQ1": false,
    "hideLeaderboard": false,
    "addTitleInfo": false,
    "preExamNotification": false,
    "preExamNotificationText": "Good luck!",
    "ownerId": "68e3ce12bb8ee016c4d4107f",
    "settings": {
      "allowReview": true,
      "showCorrectAnswer": false,
      "shuffleQuestions": false,
      "shuffleChoices": false,
      "timeLimit": true,
      
      "teacherCanStart": true,
      "teacherCanPause": true,
      "teacherCanStop": true,
      "showProgress": true,
      "showTimer": true,
      "allowSkip": false,
      "allowBack": true,
      "autoSubmit": false,
      "confirmSubmit": true,
      "allowLateSubmission": false,
      "preventCopy": false,
      "preventRightClick": false,
      "fullscreenMode": false,
      "notifyOnStart": true,
      "notifyOnSubmit": true,
      "notifyOnTimeWarning": true,
      "questionPerPage": 1,
      "saveProgress": true,
      "allowReviewAfterSubmit": false,
      "showQuestionNumbers": true,
      "allowMarkForReview": true,
      "showAnswerExplanation": false,
      "allowQuestionFeedback": false,
      "randomizeQuestionOrder": false,
      "randomizeChoiceOrder": false,
      "allowPartialCredit": false,
      "showScoreImmediately": false,
      "allowRetake": false,
      "maxRetakeAttempts": 0,
      "retakeDelay": 0,
      "timeWarningThreshold": 5,
      "gracePeriod": 0,
      "lateSubmissionPenalty": 0,
      "theme": "default",
      "fontSize": "medium",
      "showNavigation": true,
      "showQuestionList": true,
      "allowFullscreen": true,
      "showInstructions": true,
      "instructions": ""
    },
    "status": "draft",
    "isActive": true,
    "stats": {
      "totalAttempts": 0,
      "averageScore": 0,
      "completionRate": 0
    },
    "createdAt": "2024-10-21T02:58:14.305Z",
    "updatedAt": "2024-10-21T02:58:14.305Z",
    "__v": 0
  }
}
```

### 2. Get All Exams
**GET** `/exams`

Retrieves a list of exams with pagination and filtering.

#### Query Parameters
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `sort` (string): Sort order (default: '-createdAt')
- `status` (string): Filter by status ('draft', 'published', 'archived')
- `q` (string): Search query (searches name and description)
- `ownerId` (string): Filter by owner ID (admin only)

#### Response
```json
{
  "ok": true,
  "items": [
    {
      "_id": "68f6f6c620ab14a45e11315b",
      "name": "Math Final Exam",
      "description": "Final exam for Grade 10 Math",
      "duration": 120,
      "totalMarks": 100,
      "questions": [],
      "startTime": "2024-12-01T08:00:00.000Z",
      "endTime": "2024-12-01T10:30:00.000Z",
      "timezone": "Asia/Ho_Chi_Minh",
      "ownerId": "68e3ce12bb8ee016c4d4107f",
      "subjectId": "68f254ffef3cded20b0e2110",
      "gradeId": "68f254ffef3cded20b0e2111",
      "examPurpose": "exam",
      "isAllowUser": "everyone",
      "availableFrom": "2024-01-15T08:00:00Z",
      "availableUntil": "2024-01-15T18:00:00Z",
      "fee": 0,
      "examPassword": "exam123",
      "maxAttempts": 3,
      "viewMark": 1,
      "viewExamAndAnswer": 1,
      "autoMonitoring": "off",
      "studentVerification": false,
      "eduMapOnly": false,
      "hideGroupTitles": false,
      "sectionsStartFromQ1": false,
      "hideLeaderboard": false,
      "addTitleInfo": false,
      "preExamNotification": false,
      "preExamNotificationText": "Good luck!",
      "settings": {
        "allowReview": true,
        "showCorrectAnswer": false,
        "shuffleQuestions": false,
        "shuffleChoices": false,
        "timeLimit": true,
        
        "teacherCanStart": true,
        "showProgress": true,
        "showTimer": true
      },
      "status": "draft",
      "isActive": true,
      "stats": {
        "totalAttempts": 0,
        "averageScore": 0,
        "completionRate": 0
      },
      "createdAt": "2024-10-21T02:58:14.305Z",
      "updatedAt": "2024-10-21T02:58:14.305Z",
      "__v": 0
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

### 3. Get Exam by ID
**GET** `/exams/{id}`

Retrieves a specific exam with full details including populated questions.

#### Response
```json
{
  "ok": true,
  "data": {
    "_id": "68f6f6c620ab14a45e11315b",
    "name": "Math Final Exam",
    "description": "Final exam for Grade 10 Math",
    "duration": 120,
    "totalMarks": 100,
    "questions": [
      {
        "questionId": {
          "_id": "68e783537ceeea23e3d0e061",
          "name": "Math Question 1",
          "text": "What is 2 + 2?",
          "type": "mcq",
          "choices": [
            {"key": "1", "text": "3"},
            {"key": "2", "text": "4"},
            {"key": "3", "text": "5"}
          ],
          "answer": "2",
          "level": 1,
          "subjectId": "68f254ffef3cded20b0e2110"
        },
        "order": 1,
        "marks": 10,
        "isRequired": true
      }
    ],
    "startTime": "2024-12-01T08:00:00.000Z",
    "endTime": "2024-12-01T10:30:00.000Z",
    "timezone": "Asia/Ho_Chi_Minh",
    "ownerId": "68e3ce12bb8ee016c4d4107f",
    "subjectId": "68f254ffef3cded20b0e2110",
    "subjectCode": "MATH",
    "gradeId": "68f254ffef3cded20b0e2111",
    "examPurpose": "exam",
    "isAllowUser": "everyone",
    "availableFrom": "2024-01-15T08:00:00Z",
    "availableUntil": "2024-01-15T18:00:00Z",
    "fee": 0,
    "examPassword": "exam123",
    "maxAttempts": 3,
    "viewMark": 1,
    "viewExamAndAnswer": 1,
    "autoMonitoring": "off",
    "studentVerification": false,
    "eduMapOnly": false,
    "hideGroupTitles": false,
    "sectionsStartFromQ1": false,
    "hideLeaderboard": false,
    "addTitleInfo": false,
    "preExamNotification": false,
    "preExamNotificationText": "Good luck!",
    "settings": {
      "allowReview": true,
      "showCorrectAnswer": false,
      "shuffleQuestions": false,
      "shuffleChoices": false,
      "timeLimit": true,
      
      "teacherCanStart": true,
      "showProgress": true,
      "showTimer": true
    },
    "status": "draft",
    "isActive": true,
    "stats": {
      "totalAttempts": 0,
      "averageScore": 0,
      "completionRate": 0
    },
    "createdAt": "2024-10-21T02:58:14.305Z",
    "updatedAt": "2024-10-21T02:58:14.305Z",
    "__v": 0
  }
}
```

### 4. Update Exam
**PATCH** `/exams/{id}`

Updates an existing exam with partial data.

#### Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "Updated Math Final Exam",
  "description": "Updated description",
  "duration": 90,
  "status": "published",
  "settings": {
    "allowReview": false,
    "showCorrectAnswer": true,
    "shuffleQuestions": true
  }
}
```

#### Response
```json
{
  "ok": true,
  "data": {
    "_id": "68f6f6c620ab14a45e11315b",
    "name": "Updated Math Final Exam",
    "description": "Updated description",
    "duration": 90,
    "totalMarks": 100,
    "questions": [],
    "ownerId": "68e3ce12bb8ee016c4d4107f",
    "settings": {
      "allowReview": false,
      "showCorrectAnswer": true,
      "shuffleQuestions": true,
      "shuffleChoices": false,
      "timeLimit": true,
      
      "teacherCanStart": true,
      "showProgress": true,
      "showTimer": true
    },
    "status": "published",
    "isActive": true,
    "stats": {
      "totalAttempts": 0,
      "averageScore": 0,
      "completionRate": 0
    },
    "createdAt": "2024-10-21T02:58:14.305Z",
    "updatedAt": "2024-10-21T03:15:30.123Z",
    "__v": 0
  }
}
```

### 5. Delete Exam
**DELETE** `/exams/{id}`

Deletes an exam permanently.

#### Response
```json
{
  "ok": true,
  "message": "Exam deleted successfully",
  "data": {
    "_id": "68f6f6c620ab14a45e11315b",
    "name": "Math Final Exam",
    "description": "Final exam for Grade 10 Math",
    "duration": 120,
    "totalMarks": 100,
    "questions": [],
    "ownerId": "68e3ce12bb8ee016c4d4107f",
    "status": "draft",
    "isActive": true,
    "createdAt": "2024-10-21T02:58:14.305Z",
    "updatedAt": "2024-10-21T02:58:14.305Z",
    "__v": 0
  }
}
```

### 6. Add Questions to Exam
**POST** `/exams/{id}/questions`

Adds questions to an existing exam with subject validation.

#### Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

#### Request Body
```json
{
  "questionIds": [
    "68e783537ceeea23e3d0e061",
    "68e750fa7d0ffb21a570524e",
    "68e735aadc42dc7019584a7a"
  ],
  "subjectId": "68f254ffef3cded20b0e2110"
}
```

#### Response
```json
{
  "ok": true,
  "data": {
    "_id": "68f6f6c620ab14a45e11315b",
    "name": "Math Final Exam",
    "description": "Final exam for Grade 10 Math",
    "duration": 120,
    "totalMarks": 100,
    "questions": [
      {
        "questionId": "68e783537ceeea23e3d0e061",
        "order": 1,
        "marks": 1,
        "isRequired": true
      },
      {
        "questionId": "68e750fa7d0ffb21a570524e",
        "order": 2,
        "marks": 1,
        "isRequired": true
      },
      {
        "questionId": "68e735aadc42dc7019584a7a",
        "order": 3,
        "marks": 1,
        "isRequired": true
      }
    ],
    "ownerId": "68e3ce12bb8ee016c4d4107f",
    "settings": {
      "allowReview": true,
      "showCorrectAnswer": false,
      "shuffleQuestions": false,
      "shuffleChoices": false,
      "timeLimit": true,
      
      "teacherCanStart": true,
      "showProgress": true,
      "showTimer": true
    },
    "status": "draft",
    "isActive": true,
    "stats": {
      "totalAttempts": 0,
      "averageScore": 0,
      "completionRate": 0
    },
    "createdAt": "2024-10-21T02:58:14.305Z",
    "updatedAt": "2024-10-21T03:20:45.789Z",
    "__v": 0
  }
}
```

### 7. Remove Question from Exam
**DELETE** `/exams/{id}/questions/{questionId}`

Removes a specific question from an exam.

#### Response
```json
{
  "ok": true,
  "data": {
    "_id": "68f6f6c620ab14a45e11315b",
    "name": "Math Final Exam",
    "description": "Final exam for Grade 10 Math",
    "duration": 120,
    "totalMarks": 100,
    "questions": [
      {
        "questionId": "68e750fa7d0ffb21a570524e",
        "order": 1,
        "marks": 1,
        "isRequired": true
      },
      {
        "questionId": "68e735aadc42dc7019584a7a",
        "order": 2,
        "marks": 1,
        "isRequired": true
      }
    ],
    "ownerId": "68e3ce12bb8ee016c4d4107f",
    "settings": {
      "allowReview": true,
      "showCorrectAnswer": false,
      "shuffleQuestions": false,
      "shuffleChoices": false,
      "timeLimit": true,
      
      "teacherCanStart": true,
      "showProgress": true,
      "showTimer": true
    },
    "status": "draft",
    "isActive": true,
    "stats": {
      "totalAttempts": 0,
      "averageScore": 0,
      "completionRate": 0
    },
    "createdAt": "2024-10-21T02:58:14.305Z",
    "updatedAt": "2024-10-21T03:25:30.456Z",
    "__v": 0
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "ok": false,
  "message": "name is required and cannot be empty"
}
```

```json
{
  "ok": false,
  "message": "duration must be a positive integer (minutes)"
}
```

```json
{
  "ok": false,
  "message": "startTime must be before endTime"
}
```

```json
{
  "ok": false,
  "message": "Exam duration cannot exceed the time range"
}
```

```json
{
  "ok": false,
  "message": "An exam with this name already exists for this teacher"
}
```

```json
{
  "ok": false,
  "message": "All questions must belong to the same subject"
}
```

```json
{
  "ok": false,
  "message": "Total question marks (70) cannot exceed exam total marks (50)"
}
```

### 401 Unauthorized
```json
{
  "ok": false,
  "message": "Access denied. No token provided or invalid format."
}
```

### 403 Forbidden
```json
{
  "ok": false,
  "message": "Forbidden"
}
```

### 404 Not Found
```json
{
  "ok": false,
  "message": "Exam not found"
}
```

### 500 Internal Server Error
```json
{
  "ok": false,
  "message": "Something broke!"
}
```

## Data Models

### Exam Schema
```javascript
{
  _id: ObjectId,
  name: String (required, unique per owner),
  description: String,
  duration: Number (required, min: 1), // minutes
  totalMarks: Number (required, min: 0),
  questions: [ExamQuestionSchema],

  // Scheduling
  startTime: Date (optional, default: current time),
  endTime: Date (optional, default: current time + 3 days),
  timezone: String (default: 'Asia/Ho_Chi_Minh'),

  // Subject
  subjectId: ObjectId (required when creating exam with questions),
  subjectCode: String (auto-filled from questions),

  // Grade
  gradeId: ObjectId (optional, ref: 'Grade'),

  // Purpose & Access
  examPurpose: String (enum: ['exam','practice','quiz','assignment'], default: 'exam'),
  isAllowUser: String (enum: ['everyone','class','student'], default: 'everyone'),

  // Availability Window
  availableFrom: Date (optional),
  availableUntil: Date (optional),

  // Fee
  fee: Number (default: 0, min: 0),

  // Security & Attempts & Views
  examPassword: String (required),
  maxAttempts: Number (required, min: 1, default: 1),
  viewMark: Number (enum: [0,1,2], default: 1),
  viewExamAndAnswer: Number (enum: [0,1,2], default: 1),
  autoMonitoring: String (enum: ['off','screenExit','fullMonitoring'], default: 'off'),
  studentVerification: Boolean (default: false),
  eduMapOnly: Boolean (default: false),

  // Display flags
  hideGroupTitles: Boolean (default: false),
  sectionsStartFromQ1: Boolean (default: false),
  hideLeaderboard: Boolean (default: false),
  addTitleInfo: Boolean (default: false),
  preExamNotification: Boolean (default: false),
  preExamNotificationText: String (default: ''),

  // Ownership
  ownerId: ObjectId (required, ref: 'User'),

  // Settings
  settings: {
    allowReview: Boolean (default: true),
    showCorrectAnswer: Boolean (default: false),
    timeLimit: Boolean (default: true),
    shuffleQuestions: Boolean (default: false),
    shuffleChoices: Boolean (default: false),

    // Teacher controls
    teacherCanStart: Boolean (default: true),
    teacherCanPause: Boolean (default: true),
    teacherCanStop: Boolean (default: true),

    // Student experience
    showProgress: Boolean (default: true),
    showTimer: Boolean (default: true),
    allowSkip: Boolean (default: false),
    allowBack: Boolean (default: true),

    // Submission settings
    autoSubmit: Boolean (default: false),
    confirmSubmit: Boolean (default: true),
    allowLateSubmission: Boolean (default: false),

    // Security settings
    preventCopy: Boolean (default: false),
    preventRightClick: Boolean (default: false),
    fullscreenMode: Boolean (default: false),

    // Notification settings
    notifyOnStart: Boolean (default: true),
    notifyOnSubmit: Boolean (default: true),
    notifyOnTimeWarning: Boolean (default: true),

    // Advanced settings
    questionPerPage: Number (default: 1),
    saveProgress: Boolean (default: true),
    allowReviewAfterSubmit: Boolean (default: false),
    showQuestionNumbers: Boolean (default: true),
    allowMarkForReview: Boolean (default: true),
    showAnswerExplanation: Boolean (default: false),
    allowQuestionFeedback: Boolean (default: false),
    randomizeQuestionOrder: Boolean (default: false),
    randomizeChoiceOrder: Boolean (default: false),
    allowPartialCredit: Boolean (default: false),
    showScoreImmediately: Boolean (default: false),
    allowRetake: Boolean (default: false),
    maxRetakeAttempts: Number (default: 0),
    retakeDelay: Number (default: 0),

    // Time settings
    timeWarningThreshold: Number (default: 5),
    gracePeriod: Number (default: 0),
    lateSubmissionPenalty: Number (default: 0),

    // Display settings
    theme: String (default: 'default', enum: ['default','dark','light']),
    fontSize: String (default: 'medium', enum: ['small','medium','large']),
    showNavigation: Boolean (default: true),
    showQuestionList: Boolean (default: true),
    allowFullscreen: Boolean (default: true),
    showInstructions: Boolean (default: true),
    instructions: String (default: '')
  },

  // Status & metadata
  status: String (enum: ['draft','published','archived'], default: 'draft'),
  isActive: Boolean (default: true),
  stats: {
    totalAttempts: Number (default: 0),
    averageScore: Number (default: 0),
    completionRate: Number (default: 0)
  },
  createdAt: Date,
  updatedAt: Date
}
```

### ExamQuestion Schema
```javascript
{
  questionId: ObjectId (required, ref: 'Question'),
  order: Number (required, min: 1),
  marks: Number (default: 1, min: 0),
  isRequired: Boolean (default: true)
}
```

## Business Rules

### Exam Creation
- Only teachers and admins can create exams
- Exams are created in 'draft' status by default
- All required fields must be provided
- Settings are initialized with default values

### Question Management
- Questions are referenced by ID, not embedded
- Questions can be added/removed from exams dynamically
- Question order can be customized per exam
- Marks can be customized per exam
- **Simple Design**: No custom overrides - questions maintain their original content
- **Subject Validation**: All questions must belong to the same subject when creating an exam

### Access Control
- Teachers can only manage their own exams
- Admins can manage all exams
- Students cannot access exam management endpoints

### Exam Status
- `draft`: Exam is being created/edited
- `published`: Exam is available for students
- `archived`: Exam is no longer active

## Validation Rules

### Required Fields
- `name`: Must be provided, trimmed, and unique per owner
- `duration`: Must be a positive integer (minutes)
- `totalMarks`: Must be a non-negative number (>= 0)
- `questions`: Must be provided and cannot be empty array
- `subjectId`: Must be provided when creating exam with questions
- `ownerId`: Must be a valid ObjectId
- `examPurpose`: Must be one of `exam`, `practice`, `quiz`, `assignment`
- `isAllowUser`: Must be one of `everyone`, `class`, `student`
- `examPassword`: Must be a non-empty string
- `maxAttempts`: Must be a positive integer (>= 1)
- `viewMark`: Must be one of `0` (never), `1` (afterCompletion), `2` (afterAllFinish)
- `viewExamAndAnswer`: Must be one of `0` (never), `1` (afterCompletion), `2` (afterAllFinish)

### Optional Fields
- `description`: Can be empty
- `settings`: All have default values
- `startTime`: Start time of exam (ISO string)
- `endTime`: End time of exam (ISO string)
- `timezone`: Timezone (default: Asia/Ho_Chi_Minh)
- `gradeId`: Grade ID (optional, ref: 'Grade')
- `fee`: Exam fee (default: 0, min: 0)
- `availableFrom`: Exam availability start time (ISO string)
- `availableUntil`: Exam availability end time (ISO string)
- `preExamNotification`: Boolean flag to enable pre-exam notification
- `preExamNotificationText`: Optional unless `preExamNotification` is true

### Scheduling Validation
- `startTime` and `endTime` are optional with smart defaults
- If not provided: `startTime` = current time, `endTime` = current time + 3 days
- If provided: `startTime` must be before `endTime`
- `duration` cannot exceed the time range from `startTime` to `endTime`
- All time fields must be valid ISO date strings

### Availability Window Validation
- `availableFrom` and `availableUntil` are optional
- If both provided: `availableFrom` must be before `availableUntil`
- All time fields must be valid ISO date strings

### Unique Constraints
- Exam name must be unique per teacher (ownerId)
- Different teachers can use the same exam name
- Database enforces unique constraint on `name + ownerId`

### Subject Validation
When creating an exam:
1. `questions` array is required and cannot be empty
2. `subjectId` must be provided
3. All questions must exist in the database
4. All questions must belong to the same subject (same subjectId)
5. `subjectCode` will be auto-filled from questions
6. If validation fails, returns 400 Bad Request with appropriate error message

**Note**: You cannot create an exam without questions. All questions must be added during exam creation.

### Grade Validation
- `gradeId` is optional when creating an exam
- If provided, must be a valid ObjectId
- References the `Grade` collection for grade information
- Used for filtering and organizing exams by grade level

### Fee Validation
- `fee` must be a non-negative number (>= 0)
- Default value is 0 (free exam)
- Used for paid exam functionality
- Fee is charged per exam attempt

### Marks Validation
- Total marks of all questions cannot exceed exam's `totalMarks`
- Each question's marks must be non-negative
- If total question marks > exam total marks, returns 400 Bad Request

### Settings Validation
- All settings fields have default values
- Enum fields are validated against allowed values
- Numeric fields have minimum value constraints

## Testing

### Test Cases Included
- Create Exam
- Get All Exams (with pagination and filtering)
- Get Exam by ID
- Update Exam (partial update)
- Delete Exam
- Add Questions to Exam (with subject validation)
- Remove Question from Exam
- Error handling for all scenarios

### Sample Test Data

#### Test Case 1: Minimal Required Fields Only
```json
{
  "name": "Basic Math Test",
  "description": "Simple math test with required fields only",
  "duration": 30,
  "totalMarks": 50,
  "examPurpose": "exam",
  "isAllowUser": "everyone",
  "examPassword": "test123",
  
  "viewMark": 1,
  "viewExamAndAnswer": 1,
  "questions": [
    {
      "questionId": "68e783537ceeea23e3d0e061",
      "order": 1,
      "marks": 25,
      "isRequired": true
    },
    {
      "questionId": "68e750fa7d0ffb21a570524e",
      "order": 2,
      "marks": 25,
      "isRequired": true
    }
  ],
  "subjectId": "68f254ffef3cded20b0e2110"
}
```

#### Test Case 2: Full Features with Custom Settings
```json
{
  "name": "Advanced Physics Exam",
  "description": "Comprehensive physics exam with advanced features",
  "duration": 90,
  "totalMarks": 100,
  "examPurpose": "exam",
  "isAllowUser": "class",
  "availableFrom": "2024-12-01T08:00:00Z",
  "availableUntil": "2024-12-01T18:00:00Z",
  "examPassword": "physics2024",
  "maxAttempts": 2,
  "viewMark": 2,
  "viewExamAndAnswer": 2,
  "autoMonitoring": "screenExit",
  "studentVerification": true,
  "eduMapOnly": false,
  "hideGroupTitles": false,
  "sectionsStartFromQ1": true,
  "hideLeaderboard": true,
  "addTitleInfo": true,
  "preExamNotification": true,
  "preExamNotificationText": "Please ensure you have a stable internet connection before starting the exam.",
  "questions": [
    {
      "questionId": "68e783537ceeea23e3d0e061",
      "order": 1,
      "marks": 20,
      "isRequired": true
    },
    {
      "questionId": "68e750fa7d0ffb21a570524e",
      "order": 2,
      "marks": 30,
      "isRequired": true
    },
    {
      "questionId": "68e735aadc42dc7019584a7a",
      "order": 3,
      "marks": 50,
      "isRequired": true
    }
  ],
  "subjectId": "68f254ffef3cded20b0e2110",
  "gradeId": "68f254ffef3cded20b0e2111",
  "fee": 0,
  "startTime": "2024-12-01T08:00:00.000Z",
  "endTime": "2024-12-01T10:30:00.000Z",
  "timezone": "Asia/Ho_Chi_Minh",
  "settings": {
    "theme": "light",
    "allowReview": true,
    "showCorrectAnswer": false,
    "timeLimit": true,
    "shuffleQuestions": true,
    "shuffleChoices": false,
    "teacherCanStart": true,
    "teacherCanPause": true,
    "teacherCanStop": true,
    "showProgress": true,
    "showTimer": true,
    "allowSkip": false,
    "allowBack": true,
    "autoSubmit": false,
    "confirmSubmit": true,
    "allowLateSubmission": false,
    "preventCopy": true,
    "preventRightClick": true,
    "fullscreenMode": true,
    "notifyOnStart": true,
    "notifyOnSubmit": true,
    "notifyOnTimeWarning": true,
    "questionPerPage": 1,
    "saveProgress": true,
    "allowReviewAfterSubmit": false,
    "showQuestionNumbers": true,
    "allowMarkForReview": true,
    "showAnswerExplanation": false,
    "allowQuestionFeedback": false,
    "randomizeQuestionOrder": false,
    "randomizeChoiceOrder": false,
    "allowPartialCredit": false,
    "showScoreImmediately": false,
    "allowRetake": false,
    "maxRetakeAttempts": 0,
    "retakeDelay": 0,
    "timeWarningThreshold": 5,
    "gracePeriod": 0,
    "lateSubmissionPenalty": 0,
    "fontSize": "medium",
    "showNavigation": true,
    "showQuestionList": true,
    "allowFullscreen": true,
    "showInstructions": true,
    "instructions": "Read each question carefully before answering. You have 90 minutes to complete this exam."
  }
}
```

## Notes
- All timestamps are in ISO 8601 format
- ObjectIds are MongoDB ObjectId format
- Pagination uses 1-based page numbers
- Search is case-insensitive and searches both name and description
- Question population includes full question details when fetching exam by ID
- Subject validation ensures exam integrity and proper question organization
- **Scheduling**: Exams can be scheduled with specific start/end times and dates
- **Unique Names**: Exam names must be unique per teacher (ownerId)
- **Timezone Support**: All scheduling times respect the specified timezone
- **Validation**: Comprehensive validation ensures data integrity and business rules
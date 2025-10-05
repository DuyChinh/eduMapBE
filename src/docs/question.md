# Question API Documentation

## Question Types
- MCQ (Multiple Choice Question)
- TF (True/False)
- Short Answer
- Essay

## Endpoints

### List Questions
```http
GET /api/questions
```

Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `sort`: Sort field and order
- `q`: Search query
- `tags`: Comma-separated tags
- `type`: Question type (mcq, tf, short, essay)
- `level`: Difficulty level (1-5)
- `isPublic`: Filter by public/private status
- `ownerId`: Filter by owner

### Get Single Question
```http
GET /api/questions/:id
```

### Create Question
```http
POST /api/questions
```

Required permissions: `teacher` or `admin`

Body format:
```json
{
  "text": "Question text",
  "type": "mcq|tf|short|essay",
  "level": 1-5,
  "isPublic": boolean,
  "tags": string[],
  "answer": (varies by type),
  "choices": [{ "key": "a", "text": "..." }] (for MCQ only)
}
```

### Update Question
```http
PUT /api/questions/:id
```

Required permissions: Owner of question or `admin`

### Delete Question
```http
DELETE /api/questions/:id
```

Required permissions: Owner of question or `admin`

## Validation Rules

### MCQ
- Requires `choices` array with at least 2 items
- `answer` must match one of the choice keys

### True/False
- `answer` must be boolean or "true"/"false" string

### Short Answer
- `answer` must be string or array of strings

### Essay
- Optional `answer` field for rubric (must be string)

### Common Rules
- `text` is required for all types
- `level` must be between 1 and 5
- `type` must be one of: mcq, tf, short, essay
```

# Subjects API Documentation

## Overview
API endpoints for managing subjects in the EduMap system. Subjects support multiple languages (Vietnamese, English, Japanese) and can be searched, filtered, and paginated.

## Base URL
```
http://localhost:3000/v1/api/subjects
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header.

---

## 1. Create Subject

**POST** `/v1/api/subjects`

Creates a new subject. Only teachers and admins can create subjects.

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
```json
{
  "name": "Khoa học máy tính",
  "name_en": "Computer Science", 
  "name_jp": "コンピュータサイエンス",
  "code": "CS",
  "grade": "12"
}
```

### Parameters
- `name` (string, required): Subject name in Vietnamese
- `name_en` (string, optional): Subject name in English
- `name_jp` (string, optional): Subject name in Japanese
- `code` (string, required): Unique subject code (uppercase)
- `grade` (string, optional): Grade level

### Response
```json
{
  "ok": true,
  "data": {
    "_id": "68f26b8a7866a64def9c0d7a",
    "name": "Khoa học máy tính",
    "name_en": "Computer Science",
    "name_jp": "コンピュータサイエンス", 
    "code": "CS",
    "grade": "12",
    "isActive": true,
    "createdAt": "2025-10-17T16:15:06.174Z",
    "updatedAt": "2025-10-17T16:15:06.174Z"
  }
}
```

### Error Responses
- `400`: Missing required fields (name and code are required)
- `403`: Forbidden (not teacher/admin)
- `409`: Subject code already exists

---

## 2. Get All Subjects

**GET** `/v1/api/subjects`

Retrieves a list of subjects with search, filtering, and pagination support. Accessible by all authenticated users.

### Headers
```
Authorization: Bearer <token>
```

### Query Parameters
- `q` (string, optional): Search query (searches name, name_en, name_jp, code)
- `grade` (string, optional): Filter by grade level
- `code` (string, optional): Filter by subject code
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50, max: 100)
- `sort` (string, optional): Sort order (default: "grade name code")
- `lang` (string, optional): Language preference for displayName field (default: "vi")
  - `vi`: Vietnamese (default)
  - `en`: English
  - `jp` or `ja`: Japanese

### Example Requests
```bash
# Get all subjects
curl -X GET "http://localhost:3000/v1/api/subjects" \
  -H "Authorization: Bearer <token>"

# Search subjects
curl -X GET "http://localhost:3000/v1/api/subjects?q=math" \
  -H "Authorization: Bearer <token>"

# Filter by grade
curl -X GET "http://localhost:3000/v1/api/subjects?grade=12" \
  -H "Authorization: Bearer <token>"

# Pagination
curl -X GET "http://localhost:3000/v1/api/subjects?page=1&limit=5" \
  -H "Authorization: Bearer <token>"

# Language preference
curl -X GET "http://localhost:3000/v1/api/subjects?lang=en" \
  -H "Authorization: Bearer <token>"

# Combined filters
curl -X GET "http://localhost:3000/v1/api/subjects?q=math&grade=12&lang=jp" \
  -H "Authorization: Bearer <token>"
```

### Response
```json
{
  "ok": true,
  "items": [
    {
      "_id": "68f254feef3cded20b0e20fe",
      "name": "Toán học",
      "name_en": "Mathematics",
      "name_jp": "数学",
      "code": "MATH",
      "grade": "10",
      "displayName": "Toán học",
      "isActive": true,
      "createdAt": "2025-10-17T14:38:55.264Z",
      "updatedAt": "2025-10-17T14:38:55.264Z"
    },
    {
      "_id": "68f254ffef3cded20b0e2103",
      "name": "Tiếng Anh",
      "name_en": "English",
      "name_jp": "英語",
      "code": "ENG",
      "displayName": "Tiếng Anh",
      "isActive": true,
      "createdAt": "2025-10-17T14:38:55.546Z",
      "updatedAt": "2025-10-17T14:38:55.546Z"
    }
  ],
  "total": 19,
  "page": 1,
  "limit": 50,
  "pages": 1,
  "lang": "vi"
}
```

---

## 3. Get Subject by ID

**GET** `/v1/api/subjects/:id`

Retrieves a specific subject by its ID. Accessible by all authenticated users.

### Headers
```
Authorization: Bearer <token>
```

### Path Parameters
- `id` (string, required): Subject ID

### Query Parameters
- `lang` (string, optional): Language preference for displayName field (default: "vi")
  - `vi`: Vietnamese (default)
  - `en`: English
  - `jp` or `ja`: Japanese

### Example Request
```bash
curl -X GET "http://localhost:3000/v1/api/subjects/68f254feef3cded20b0e20fe" \
  -H "Authorization: Bearer <token>"

# With language preference
curl -X GET "http://localhost:3000/v1/api/subjects/68f254feef3cded20b0e20fe?lang=en" \
  -H "Authorization: Bearer <token>"
```

### Response
```json
{
  "ok": true,
  "data": {
    "_id": "68f254feef3cded20b0e20fe",
    "name": "Toán học",
    "name_en": "Mathematics",
    "name_jp": "数学",
    "code": "MATH", 
    "grade": "10",
    "displayName": "Toán học",
    "isActive": true,
    "createdAt": "2025-10-17T14:38:55.264Z",
    "updatedAt": "2025-10-17T14:38:55.264Z"
  },
  "lang": "vi"
}
```

### Error Responses
- `400`: Invalid subject ID
- `404`: Subject not found

---

## 4. Update Subject

**PUT** `/v1/api/subjects/:id`

Updates an existing subject. Only teachers and admins can update subjects.

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Path Parameters
- `id` (string, required): Subject ID

### Request Body
```json
{
  "name": "Khoa học máy tính nâng cao",
  "name_en": "Advanced Computer Science",
  "name_jp": "高度なコンピュータサイエンス",
  "code": "CS_ADV",
  "grade": "12"
}
```

### Parameters
- `name` (string, optional): Subject name in Vietnamese
- `name_en` (string, optional): Subject name in English
- `name_jp` (string, optional): Subject name in Japanese
- `code` (string, optional): Unique subject code (uppercase)
- `grade` (string, optional): Grade level

### Example Request
```bash
curl -X PUT "http://localhost:3000/v1/api/subjects/68f26b8a7866a64def9c0d7a" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Khoa học máy tính nâng cao",
    "name_en": "Advanced Computer Science",
    "code": "CS_ADV"
  }'
```

### Response
```json
{
  "ok": true,
  "message": "Subject updated successfully",
  "data": {
    "_id": "68f26b8a7866a64def9c0d7a",
    "name": "Khoa học máy tính nâng cao",
    "name_en": "Advanced Computer Science",
    "name_jp": "高度なコンピュータサイエンス",
    "code": "CS_ADV",
    "grade": "12",
    "isActive": true,
    "createdAt": "2025-10-17T16:15:06.174Z",
    "updatedAt": "2025-10-17T16:20:30.123Z"
  }
}
```

### Error Responses
- `400`: Invalid subject ID
- `403`: Forbidden (not teacher/admin)
- `404`: Subject not found
- `409`: Subject code already exists

---

## 5. Delete Subject

**DELETE** `/v1/api/subjects/:id`

Deletes a subject. Only teachers and admins can delete subjects.

### Headers
```
Authorization: Bearer <token>
```

### Path Parameters
- `id` (string, required): Subject ID

### Example Request
```bash
curl -X DELETE "http://localhost:3000/v1/api/subjects/68f26b8a7866a64def9c0d7a" \
  -H "Authorization: Bearer <token>"
```

### Response
```json
{
  "ok": true,
  "message": "Subject deleted successfully"
}
```

### Error Responses
- `400`: Invalid subject ID
- `403`: Forbidden (not teacher/admin)
- `404`: Subject not found

---

## Default Subjects

The system comes with the following default subjects (19 total):

| Code | Vietnamese | English | Japanese |
|------|------------|---------|----------|
| MATH | Toán học | Mathematics | 数学 |
| LIT | Ngữ văn | Literature | 文学 |
| PHYS | Vật lý | Physics | 物理学 |
| CHEM | Hóa học | Chemistry | 化学 |
| BIO | Sinh học | Biology | 生物学 |
| ENG | Tiếng Anh | English | 英語 |
| HIST | Lịch sử | History | 歴史 |
| GEO | Địa lý | Geography | 地理学 |
| CIVIC | Giáo dục công dân | Civic Education | 公民教育 |
| TECH | Công nghệ | Technology | 技術 |
| ART | Mỹ thuật | Art | 美術 |
| MUSIC | Âm nhạc | Music | 音楽 |
| PE | Thể dục | Physical Education | 体育 |
| INFO | Tin học | Computer Science | 情報学 |
| FRENCH | Tiếng Pháp | French | フランス語 |
| CHINESE | Tiếng Trung | Chinese | 中国語 |
| JAPANESE | Tiếng Nhật | Japanese | 日本語 |
| KOREAN | Tiếng Hàn | Korean | 韓国語 |
| OTHER | Khác/Chưa phân loại | Other/Unclassified | その他/未分類 |

---

## Test Credentials

For testing with Postman:

### Student Account
- **Email:** `trangquangtung@gmail.com`
- **Password:** `password`
- **Role:** student
- **Permissions:** Can view all subjects, cannot create subjects

### Teacher Account  
- **Email:** `trangquangtungteacher@gmail.com`
- **Password:** `teacher`
- **Role:** teacher
- **Permissions:** Can view all subjects, can create subjects

---

## Postman Collection

Use the provided Postman collection `Subject-API-Test.postman_collection.json` with environment `Subject-API-Environment.postman_environment.json` for comprehensive testing.

### Test Cases Included:
- ✅ **Authentication** - Login for both student and teacher
- ✅ **Get All Subjects** - List all subjects with pagination
- ✅ **Search Subjects** - Search by math, english keywords
- ✅ **Get Subject by ID** - Retrieve specific subject
- ✅ **Create Subject** - Teacher creates new subject
- ✅ **Update Subject** - Teacher updates existing subject
- ✅ **Delete Subject** - Teacher deletes subject
- ✅ **Error Handling** - Duplicate code, missing fields, permission errors
- ✅ **Pagination & Filtering** - Test pagination and grade filtering

---

## Notes

- Subject codes are automatically converted to uppercase
- Subject codes must be unique within an organization
- Search functionality supports Vietnamese, English, and Japanese text
- All timestamps are in ISO 8601 format
- Pagination is 1-based (page 1 is the first page)
- All endpoints return consistent response format with `ok` boolean field
- Error responses include descriptive error messages
- **Language Support**: Use `lang` parameter to get localized `displayName` field
  - `lang=vi` (default): `displayName` = `name` (Vietnamese)
  - `lang=en`: `displayName` = `name_en` (falls back to `name` if not available)
  - `lang=jp` or `lang=ja`: `displayName` = `name_jp` (falls back to `name` if not available)

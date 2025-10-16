# API Lớp học

## Tạo lớp học mới
### URL: http://localhost:3000/v1/api/classes
#### Phương thức: POST
#### Headers:
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### Body:
```json
{
  "name": "Toán 12A1",
  "academicYear": "2024-2025"   // optional, lưu vào metadata.academicYear
}
```
> Nếu là admin, có thể truyền thêm `teacherId` để tạo lớp cho giáo viên khác:
```json
{
  "name": "Toán 12A1",
  "academicYear": "2024-2025",
  "teacherId": "teacher_id"
}
```

#### Phản hồi:
```json
{
  "ok": true,
  "data": {
    "_id": "class_id",
    "orgId": "org_id",
    "teacherId": "teacher_id",
    "name": "Toán 12A1",
    "code": "XYZ789", // tự động sinh
    "studentIds": [],
    "settings": {},
    "metadata": {
      "academicYear": "2024-2025"
    },
    "createdAt": "2023-10-15T10:30:00Z",
    "updatedAt": "2023-10-15T10:30:00Z"
  }
}
```

### Lưu ý:
- Chỉ giáo viên và admin mới có quyền tạo lớp.
- Giáo viên chỉ tạo lớp cho chính mình.
- Admin có thể tạo lớp cho giáo viên khác qua `teacherId`.
- `academicYear` là tùy chọn, sẽ lưu vào `metadata.academicYear`.
- Các trường khác như `settings`, `studentIds`, `metadata` (ngoài academicYear) **không được truyền khi tạo lớp**.
- Mã lớp (`code`) được tự động sinh ngẫu nhiên, duy nhất trong tổ chức.
- Nếu truyền `orgId` không hợp lệ sẽ báo lỗi 400.
- Nếu mã lớp bị trùng (hiếm gặp) sẽ báo lỗi 409.

---

## Lấy danh sách lớp học
### URL: `/v1/api/classes`
#### Phương thức: GET
#### Query Parameters:
- `q` (optional): Tìm kiếm theo tên lớp (tùy chọn)
- `teacherId` hoặc `teacherEmail`: Lọc theo giáo viên (chỉ admin dùng)
- `page`, `limit`: Phân trang
- `sort`: Sắp xếp (mặc định: `-createdAt`)

#### Headers:
```
Authorization: Bearer {token}
```

#### Ví dụ:
```bash
# Lấy tất cả lớp học
GET /v1/api/classes?page=1&limit=20

# Lấy lớp học với tìm kiếm
GET /v1/api/classes?q=Toán học&page=1&limit=10

# Lọc theo giáo viên (admin only)
GET /v1/api/classes?teacherId=teacher_id&page=1&limit=20
```

#### Phản hồi:
```json
{
  "ok": true,
  "items": [/* danh sách lớp */],
  "total": 100,
  "page": 1,
  "limit": 20,
  "pages": 5
}
```

#### Lưu ý:
- API này dùng để **lấy danh sách** lớp học với các filter cơ bản
- Để **tìm kiếm chuyên sâu**, sử dụng API `/search` riêng biệt
- Kết quả được lọc theo organization của user hiện tại
- Giáo viên chỉ thấy lớp của mình (trừ khi admin chỉ định `teacherId`)

---

## Tìm kiếm lớp học theo tên
### URL: `/v1/api/classes/search`
#### Phương thức: GET
#### Query Parameters:
- `q` (required): Từ khóa tìm kiếm (tối thiểu 2 ký tự)
- `page` (optional): Số trang (mặc định: 1)
- `limit` (optional): Số lượng kết quả mỗi trang (mặc định: 20)
- `sort` (optional): Sắp xếp (mặc định: `-createdAt`)

#### Headers:
```
Authorization: Bearer {token}
```

#### Ví dụ:
```bash
# Tìm kiếm cơ bản
GET /v1/api/classes/search?q=Toán học

# Tìm kiếm với pagination
GET /v1/api/classes/search?q=Toán học&page=1&limit=10

# Tìm kiếm với sắp xếp theo tên
GET /v1/api/classes/search?q=Toán học&sort=name
```

#### Phản hồi thành công:
```json
{
  "ok": true,
  "items": [
    {
      "_id": "class_id",
      "name": "Toán học cơ bản",
      "code": "MATH001",
      "teacherId": {
        "_id": "teacher_id",
        "name": "Nguyễn Văn A",
        "email": "teacher@example.com"
      },
      "studentIds": ["student1", "student2"],
      "orgId": "org_id",
      "settings": {
        "allowLateSubmission": false,
        "maxAttempts": 1,
        "proctoringEnabled": false
      },
      "metadata": {
        "subject": "Toán học",
        "semester": "Học kỳ 1",
        "academicYear": "2024-2025"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20,
  "pages": 2,
  "query": "Toán học"
}
```

#### Phản hồi lỗi:
```json
// Query quá ngắn (< 2 ký tự)
{
  "ok": false,
  "message": "Search query must be at least 2 characters"
}

// Thiếu query parameter
{
  "ok": false,
  "message": "Search query must be at least 2 characters"
}

// Không có kết quả
{
  "ok": true,
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "pages": 1,
  "query": "xyz"
}
```

#### Tính năng:
- **Tìm kiếm không phân biệt hoa thường**: "toán học" sẽ tìm được "Toán học"
- **Pagination**: Hỗ trợ phân trang với `page` và `limit`
- **Populate teacher**: Tự động populate thông tin giáo viên
- **Organization filter**: Tự động lọc theo organization của user
- **Sorting**: Hỗ trợ sắp xếp theo các trường khác nhau
- **Query tracking**: Trả về query trong response để frontend biết đang search gì

#### Lưu ý:
- Chỉ tìm kiếm theo tên lớp (`name` field)
- Kết quả được lọc theo organization của user hiện tại
- Cần có token hợp lệ để truy cập
- Query phải có ít nhất 2 ký tự

---

## Lấy danh sách lớp của tôi (giáo viên hoặc học sinh)
### URL: `/v1/api/classes/mine`
#### Phương thức: GET
#### Headers:
```
Authorization: Bearer {token}
```
#### Phản hồi:
- Giáo viên: các lớp mình dạy
- Học sinh: các lớp mình tham gia

---

## Xem chi tiết lớp học
### URL: `/v1/api/classes/:id`
#### Phương thức: GET
#### Headers:
```
Authorization: Bearer {token}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": { /* thông tin lớp học */ }
}
```
> Chỉ giáo viên owner, admin hoặc học sinh đã tham gia mới xem được.

---

## Sửa thông tin lớp học
### URL: `/v1/api/classes/:id`
#### Phương thức: PATCH
#### Headers:
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### Body:
```json
{
  "name": "Tên mới",
  "settings": { ... },        // optional
  "metadata": { ... }         // optional
}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": { /* lớp đã cập nhật */ }
}
```
> Chỉ giáo viên owner hoặc admin được sửa.

---

## Xóa lớp học
### URL: `/v1/api/classes/:id`
#### Phương thức: DELETE
#### Headers:
```
Authorization: Bearer {token}
```
#### Phản hồi:
```json
{
  "ok": true,
  "message": "Class deleted",
  "data": { /* lớp đã xóa */ }
}
```
> Chỉ giáo viên owner hoặc admin được xóa.

---

## Học sinh tham gia lớp học bằng mã lớp
### URL: `/v1/api/classes/join`
#### Phương thức: POST
#### Headers:
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### Body:
```json
{
  "code": "ABC123"
}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": {
    "_id": "class_id",
    "name": "Toán 12A1",
    "code": "ABC123",
    "teacherId": "teacher_id",
    "studentIds": ["student_id"],
    "createdAt": "2023-10-15T10:30:00Z"
  }
}
```

---

## Học sinh tham gia lớp học bằng email giáo viên
### URL: `/v1/api/classes/join-class-by-teacher`
#### Phương thức: POST
#### Headers:
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### Body:
```json
{
  "teacherEmail": "teacher@school.edu.vn"
}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": {
    "_id": "class_id",
    "name": "Toán 12A1",
    "code": "ABC123",
    "teacherId": "teacher_id",
    "studentIds": ["student_id"],
    "createdAt": "2023-10-15T10:30:00Z"
  }
}
```
#### Lưu ý:
- Nếu teacher có nhiều lớp, student sẽ được thêm vào lớp đầu tiên
- Chỉ student mới có thể sử dụng API này
- Teacher email phải tồn tại và có role 'teacher'

---

## Tìm kiếm lớp học
### URL: `/v1/api/classes/search`
#### Phương thức: GET
#### Query Parameters:
- `q` (required): Từ khóa tìm kiếm (ít nhất 2 ký tự)
- `page`, `limit`: Phân trang
- `sort`: Sắp xếp (mặc định: `-createdAt`)

#### Headers:
```
Authorization: Bearer {token}
```

#### Ví dụ:
```
GET /v1/api/classes/search?q=toán&page=1&limit=10
```

#### Phản hồi:
```json
{
  "ok": true,
  "items": [
    {
      "_id": "class_id",
      "name": "Toán 12A1",
      "code": "ABC123",
      "teacherId": "teacher_id",
      "createdAt": "2023-10-15T10:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "pages": 1
}
```

#### Lưu ý:
- Query phải có ít nhất 2 ký tự
- Tìm kiếm theo tên lớp và mô tả

---

## Thêm nhiều học sinh vào lớp
### URL: `/v1/api/classes/:id/students/bulk`
#### Phương thức: POST
#### Headers:
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### Body:
```json
{
  "studentIds": ["id1", "id2"],           // hoặc
  "studentEmails": ["a@gmail.com", ...]   // hoặc cả hai
}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": { /* lớp sau khi thêm */ },
  "report": {
    "added": ["id3"],
    "already": ["id1"],
    "invalidIds": [],
    "notFoundIds": [],
    "invalidEmails": [],
    "notFoundEmails": [],
    "notStudents": []
  }
}
```
> Chỉ giáo viên owner hoặc admin được thêm học sinh.

---

## Học sinh tham gia lớp bằng mã code
### URL: `/v1/api/classes/join`
#### Phương thức: POST
#### Headers:
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### Body:
```json
{
  "code": "ABC123"
}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": { /* thông tin lớp */ }
}
```
> Chỉ học sinh mới được join bằng code.

---

## Giáo viên hoặc admin tạo lại mã code lớp
### URL: `/v1/api/classes/:id/regenerate-code`
#### Phương thức: POST
#### Headers:
```
Authorization: Bearer {token}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": { /* lớp với mã code mới */ }
}
```
> Chỉ giáo viên owner hoặc admin được tạo lại mã code.

---

## So sánh List vs Search API

### API List (`/v1/api/classes`)
**Mục đích**: Lấy danh sách lớp học với filter cơ bản
- **Query `q`**: Tùy chọn, không bắt buộc
- **Use case**: Hiển thị danh sách lớp học, có thể kèm tìm kiếm nhẹ
- **Performance**: Tối ưu cho việc load danh sách
- **Filter**: Hỗ trợ filter theo teacher, pagination

### API Search (`/v1/api/classes/search`)
**Mục đích**: Tìm kiếm chuyên sâu theo tên lớp
- **Query `q`**: Bắt buộc, tối thiểu 2 ký tự
- **Use case**: Tìm kiếm lớp học cụ thể
- **Performance**: Tối ưu cho việc tìm kiếm
- **Features**: Populate teacher info, query tracking

### Khi nào dùng API nào?

#### Dùng **List API** khi:
- Hiển thị danh sách lớp học trong dashboard
- Load trang đầu tiên với pagination
- Filter theo teacher (admin)
- Cần hiệu suất cao cho việc load danh sách

#### Dùng **Search API** khi:
- User nhập từ khóa để tìm lớp cụ thể
- Cần thông tin chi tiết về teacher
- Implement tính năng search box
- Cần validation query (tối thiểu 2 ký tự)

### Ví dụ sử dụng:

```javascript
// Dashboard - hiển thị danh sách lớp
const getClasses = async (page = 1) => {
  const response = await fetch(`/v1/api/classes?page=${page}&limit=20`);
  return response.json();
};

// Search box - tìm kiếm lớp
const searchClasses = async (query) => {
  if (query.length < 2) return { items: [] };
  const response = await fetch(`/v1/api/classes/search?q=${encodeURIComponent(query)}`);
  return response.json();
};
```

---
# API Lớp học

## Tạo lớp học mới
### URL: https://edu-map-be.vercel.app/v1/api/classes
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
#### Query:
- `q`: tìm kiếm theo tên lớp (tùy chọn)
- `teacherId` hoặc `teacherEmail`: lọc theo giáo viên (chỉ admin dùng)
- `page`, `limit`: phân trang
- `sort`: sắp xếp (mặc định: `-createdAt`)
#### Headers:
```
Authorization: Bearer {token}
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
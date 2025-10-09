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
  "settings": {
    "allowJoin": true,
    "maxStudents": 40
  },
  "metadata": {
    "schedule": "Thứ 2,4,6",
    "room": "A102"
  },
  "studentIds": ["id1", "id2"],
  "teacherId": "teacher_id"  // chỉ admin mới được truyền field này
}
```

#### Phản hồi:
```json
{
  "ok": true,
  "data": {
    "id": "class_id",
    "orgId": "org_id", 
    "teacherId": "teacher_id",
    "name": "Toán 12A1",
    "code": "XYZ789", // tự động sinh
    "studentIds": ["id1", "id2"],
    "settings": {
      "allowJoin": true,
      "maxStudents": 40
    },
    "metadata": {
      "schedule": "Thứ 2,4,6", 
      "room": "A102"
    },
    "createdAt": "2023-10-15T10:30:00Z",
    "updatedAt": "2023-10-15T10:30:00Z"
  }
}
```

## Lưu ý:
- Tất cả API đều yêu cầu xác thực qua token JWT
- Chỉ giáo viên và admin mới có quyền tạo lớp
- Giáo viên chỉ có thể tạo lớp cho chính mình
- Admin có thể tạo lớp và chỉ định giáo viên qua `teacherId` 
- Mã lớp (`code`) được tự động sinh ngẫu nhiên và đảm bảo duy nhất trong phạm vi tổ chức
- Mã lớp chỉ bao gồm chữ cái in hoa (A-Z, không có O/I) và số (2-9)
- `settings` và `metadata` là optional và có thể tùy chỉnh theo nhu cầu
- `studentIds` là optional, có thể thêm học sinh sau
- Nếu truyền `orgId` không hợp lệ sẽ báo lỗi 400
- Nếu mã lớp bị trùng (hiếm gặp) sẽ báo lỗi 409
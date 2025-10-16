# API Câu hỏi

## Lấy danh sách câu hỏi
### URL: https://edu-map-be.vercel.app/v1/api/questions
#### Phương thức: GET
#### Headers:
```
Authorization: Bearer {token}
```
#### Tham số truy vấn:
- `page`: Số trang (mặc định: 1)
- `limit`: Số lượng item trên mỗi trang (mặc định: 20) 
- `sort`: Sắp xếp (mặc định: '-createdAt')
- `q`: Tìm kiếm tổng quát (tìm trong text, choices.text và tags)
- `name`: Lọc theo nội dung câu hỏi (text contains)
- `tags`: Các tag (phân cách bằng dấu phẩy)
- `type`: Loại câu hỏi ('mcq', 'tf', 'short', 'essay')
- `level`: Độ khó (1-5)
- `isPublic`: Lọc theo trạng thái công khai (true/false)
- `ownerId`: Lọc theo người tạo
- `subjectId`: Lọc theo môn học (ObjectId)
- `subjectCode`: Lọc theo mã môn học ('MATH', 'LIT', 'PHYS', etc.)

#### Ví dụ tìm kiếm:
```
/questions?q=toán học    // tìm trong text, choices và tags
/questions?name=phương trình  // chỉ tìm trong text
/questions?tags=toán,đại số   // phải có cả 2 tag
/questions?type=mcq&level=2   // lọc theo type và level
/questions?subjectCode=MATH   // lọc theo môn Toán
/questions?subjectId=64a1b2c3d4e5f6789012345  // lọc theo ID môn học
```

#### Phản hồi:
```json
{
  "ok": true,
  "items": [
    {
      "id": "id_cauhoi",
      "orgId": "id_tochuc",
      "ownerId": "id_nguoidung", 
      "type": "mcq",
      "text": "Nội dung câu hỏi",
      "choices": [
        {
          "key": "a",
          "text": "Lựa chọn A"
        },
        {
          "key": "b",
          "text": "Lựa chọn B"
        }
      ],
      "answer": "a",
      "tags": ["toán", "đại số"],
      "level": 1,
      "isPublic": true,
      "createdAt": "2023-10-15T10:30:00Z",
      "updatedAt": "2023-10-15T10:30:00Z"
    }
  ],
  "total": 100,
  "page": 1, 
  "limit": 20,
  "pages": 5
}
```

## Lấy thông tin một câu hỏi
### URL: https://edu-map-be.vercel.app/v1/api/questions/{id}
#### Phương thức: GET 
#### Headers:
```
Authorization: Bearer {token}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": {
    "id": "id_cauhoi",
    "orgId": "id_tochuc",
    "ownerId": "id_nguoidung",
    "type": "mcq", 
    "text": "Nội dung câu hỏi",
    "choices": [
      {
        "key": "a",
        "text": "Lựa chọn A"
      },
      {
        "key": "b",
        "text": "Lựa chọn B"
      }
    ],
    "answer": "a",
    "tags": ["toán", "đại số"],
    "level": 1,
    "isPublic": true,
    "createdAt": "2023-10-15T10:30:00Z",
    "updatedAt": "2023-10-15T10:30:00Z"
  }
}
```

## Tạo câu hỏi mới
### URL: https://edu-map-be.vercel.app/v1/api/questions  
#### Phương thức: POST
#### Headers:
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### Body:
```json
{
  "type": "mcq",
  "text": "2 + 2 = ?",
  "choices": [
    {
      "key": "a", 
      "text": "3"
    },
    {
      "key": "b",
      "text": "4"
    }
  ],
  "answer": "b",
  "tags": ["toán", "cộng"],
  "level": 1,
  "isPublic": true,
  "subjectId": "64a1b2c3d4e5f6789012345",  // hoặc
  "subjectCode": "MATH"  // hoặc cả hai
}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": {
    "id": "id_cauhoi_moi",
    "type": "mcq",
    "text": "2 + 2 = ?",
    "choices": [
      {
        "key": "a",
        "text": "3"
      },
      {
        "key": "b",
        "text": "4"  
      }
    ],
    "answer": "b",
    "tags": ["toán", "cộng"],
    "level": 1,
    "isPublic": true,
    "createdAt": "2023-10-15T10:30:00Z",
    "updatedAt": "2023-10-15T10:30:00Z"
  }
}
```

## Cập nhật câu hỏi
### URL: https://edu-map-be.vercel.app/v1/api/questions/{id}
#### Phương thức: PUT
#### Headers:
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### Body:
```json
{
  "text": "Nội dung câu hỏi đã cập nhật",
  "isPublic": false,
  "level": 2
}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": {
    "id": "id_cauhoi",
    "text": "Nội dung câu hỏi đã cập nhật",
    "isPublic": false, 
    "level": 2,
    "updatedAt": "2023-10-15T11:30:00Z"
  }
}
```

## Xóa câu hỏi
### URL: https://edu-map-be.vercel.app/v1/api/questions/{id}
#### Phương thức: DELETE
#### Headers:
```
Authorization: Bearer {token}
```
#### Phản hồi:
```json
{
  "ok": true,
  "data": {
    "id": "id_cauhoi_daxoa",
    "text": "Câu hỏi đã xóa"
  }
}
```

## Lưu ý:
- Tất cả API đều yêu cầu xác thực qua token JWT
- Giáo viên chỉ có thể quản lý câu hỏi do mình tạo
- Admin có thể quản lý tất cả câu hỏi 
- Học sinh chỉ có thể xem câu hỏi công khai
- Tìm kiếm (`q`) sẽ tìm trong text, choices.text và tags
- `subjectId` hoặc `subjectCode` là bắt buộc khi tạo câu hỏi
- Nếu chỉ có `subjectCode`, hệ thống sẽ tự động tìm `subjectId` tương ứng

## Các môn học có sẵn:
- `MATH`: Toán học
- `LIT`: Ngữ văn
- `PHYS`: Vật lý
- `CHEM`: Hóa học
- `BIO`: Sinh học
- `ENG`: Tiếng Anh
- `HIST`: Lịch sử
- `GEO`: Địa lý
- `CIVIC`: Giáo dục công dân
- `TECH`: Công nghệ
- `ART`: Mỹ thuật
- `MUSIC`: Âm nhạc
- `PE`: Thể dục
- `INFO`: Tin học
- `FRENCH`: Tiếng Pháp
- `CHINESE`: Tiếng Trung
- `JAPANESE`: Tiếng Nhật
- `KOREAN`: Tiếng Hàn
- `OTHER`: Khác/Chưa phân loại
- Lọc theo nội dung (`name`) chỉ tìm trong trường text
- Lọc theo tags yêu cầu câu hỏi phải có tất cả các tag được chỉ định
- Các loại câu hỏi hỗ trợ: trắc nghiệm (mcq), đúng/sai (tf), trả lời ngắn (short), tự luận (essay)
- Độ khó từ 1-5
- Đối với câu hỏi trắc nghiệm, đáp án phải là một hoặc nhiều trong các key của lựa chọn
- Đối với câu hỏi đúng/sai, đáp án phải là boolean
- Đối với câu hỏi trả lời ngắn, đáp án có thể là chuỗi hoặc mảng chuỗi
- Đối với câu hỏi tự luận, đáp án (rubric) là không bắt buộc nhưng phải là chuỗi nếu có
# AUTH
## api/register
### call: https://edu-map-be.vercel.app/api/register
#### method: POST
-- body --
{
  "name": "Nguyễn Văn A",
  "email": "nguyenvana@example.com",
  "password": "yourpassword",
  "role": "student", // or teacher
}


## api/login
### call: https://edu-map-be.vercel.app/api/login
#### method: POST
-- body --
{
  "email": "nguyenvana@example.com",
  "password": "yourpassword",
}


## SSO Google (OAuth 2.0)

### 1) Khái quát luồng
- Client mở trình duyệt tới endpoint SSO → hệ thống redirect sang Google
- Người dùng đồng ý → Google redirect về callback của BE
- BE cấp JWT và (tuỳ cấu hình) redirect về FE kèm `token`

### 2) Biến môi trường bắt buộc
```
CLIENT_ID_GOOGLE=your_google_client_id
CLIENT_SECRET_GOOGLE=your_google_client_secret
GOOGLE_CALLBACK_URL=http(s)://<BE_HOST>/auth/google/callback
JWT_SECRET=your_jwt_secret
FE_REDIRECT_URL=http(s)://<FE_HOST>/auth/callback  # tuỳ chọn nếu muốn redirect kèm token
```

### 3) Endpoints

- GET `https://edu-map-be.vercel.app/auth/google`
  - Tác dụng: khởi tạo SSO Google (redirect sang Google)
  - Gọi từ trình duyệt (không dùng cURL vì là redirect)

- GET `https://edu-map-be.vercel.app/auth/google/callback`
  - Tác dụng: Google gọi về sau khi user đồng ý
  - Hành vi mặc định: Backend phát JWT và redirect về `FE_REDIRECT_URL?token=<JWT>`
  - Trường hợp bạn cấu hình trả JSON: response sẽ chứa `{ success, token }`

Lưu ý: Nếu môi trường local, thay `https://edu-map-be.vercel.app` bằng `http://localhost:3000`.

### 4) Cách dùng (FE)
- Mở đường dẫn: `GET /auth/google`
- Sau khi đăng nhập thành công, nhận `token` ở callback FE:
  - Nếu redirect: đọc `token` từ query string `?token=<JWT>`
  - Lưu `token` (localStorage hoặc cookie HTTPOnly tuỳ chiến lược bảo mật)
  - Gửi `Authorization: Bearer <token>` cho các API cần xác thực

### 5) Ví dụ (Local)
- Bắt đầu SSO: mở trình duyệt tới `http://localhost:3000/auth/google`
- Sau khi đăng nhập thành công, bạn sẽ được chuyển về `FE_REDIRECT_URL` với `?token=<JWT>`

### 6) Ghi chú bảo mật
- Production nên dùng cookie HTTPOnly + Secure để chứa token
- Thêm `state` vào OAuth flow (Passport hỗ trợ mặc định) để chống CSRF
- Nếu dùng multi-tenant, sau khi SSO có thể yêu cầu chọn `org` và cập nhật `user.orgId`

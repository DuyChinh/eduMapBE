# AUTH

## 🔐 Password Requirements
Tất cả password phải đáp ứng các yêu cầu bảo mật sau:
- **Độ dài:** Tối thiểu 8 ký tự, tối đa 128 ký tự
- **Chữ hoa:** Ít nhất 1 ký tự hoa (A-Z)
- **Chữ thường:** Ít nhất 1 ký tự thường (a-z)
- **Số:** Ít nhất 1 chữ số (0-9)
- **Ký tự đặc biệt:** Ít nhất 1 ký tự đặc biệt (!@#$%^&*()_+-=[]{}|;:,.<>?)
- **Không được chứa:** Hơn 2 ký tự giống nhau liên tiếp
- **Không được chứa:** Các từ thông dụng (password, 123456, qwerty, admin, user, v.v.)

### Ví dụ password hợp lệ:
- `MyPass123!`
- `SecureP@ssw0rd`
- `Strong#Pass2024`

### Ví dụ password không hợp lệ:
- `password` (thiếu ký tự hoa, số, đặc biệt)
- `PASS123!` (thiếu ký tự thường)
- `MyPass` (thiếu số và ký tự đặc biệt)
- `aaa123!` (có 3 ký tự giống nhau liên tiếp)

## 💡 Hướng dẫn cho Frontend

### Password Validation trên Frontend
FE nên implement client-side validation để cải thiện UX:

```javascript
// Password validation function cho FE
const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Mật khẩu phải có ít nhất 8 ký tự');
  }
  
  if (password.length > 128) {
    errors.push('Mật khẩu không được quá 128 ký tự');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất 1 chữ hoa');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất 1 chữ thường');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất 1 số');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất 1 ký tự đặc biệt');
  }
  
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Mật khẩu không được có hơn 2 ký tự giống nhau liên tiếp');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};
```

### Password Strength Indicator
```javascript
const getPasswordStrength = (password) => {
  let score = 0;
  
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 20;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 20;
  if (/[0-9]/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score += 10;
  
  if (score < 30) return { level: 'weak', color: 'red' };
  if (score < 60) return { level: 'fair', color: 'orange' };
  if (score < 90) return { level: 'good', color: 'blue' };
  return { level: 'strong', color: 'green' };
};
```

## api/register
### call: https://edu-map-be.vercel.app/v1/api/auth/register
#### method: POST
-- body --
{
  "name": "Nguyễn Văn A",
  "email": "nguyenvana@example.com",
  "password": "MyPass123!",
  "role": "student", // or teacher
}
#### response:
```
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "user_id",
    "name": "Nguyễn Văn A",
    "email": "nguyenvana@example.com",
    "role": "student"
  }
}
```
#### error responses:
```
// Password validation failed
{
  "success": false,
  "message": "Password validation failed: Password must be at least 8 characters long, Password must contain at least one uppercase letter (A-Z), Password must contain at least one number (0-9)"
}

// User already exists
{
  "success": false,
  "message": "User already exists"
}
```


## api/login
### call: https://edu-map-be.vercel.app/v1/api/auth/login
#### method: POST
-- body --
{
  "email": "nguyenvana@example.com",
  "password": "yourpassword",
}

## api/forgot-password
###🔄 Luồng hoạt động mới (OTP):
```
1. User nhập email → API tạo OTP 6 chữ số → Gửi email chứa OTP
2. User nhập OTP từ email → API verify OTP → Đánh dấu OTP đã sử dụng
3. User nhập password mới → API kiểm tra OTP đã verify → Cập nhật password
4. Xóa tất cả OTP của user
```

### Bước 1: Gửi OTP
### call: https://edu-map-be.vercel.app/v1/api/auth/forgot-password
#### method: POST
-- body --
{
  "email": "nguyenvana@example.com"
}
#### response:
```
{
  "success": true,
  "message": "If the email exists, an OTP has been sent"
}
```

### Bước 2: Xác thực OTP
### call: https://edu-map-be.vercel.app/v1/api/auth/verify-otp
#### method: POST
-- body --
{
  "email": "nguyenvana@example.com",
  "otp": "123456"
}
#### response:
```
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "userId": "user_id_here",
    "email": "nguyenvana@example.com"
  }
}
```
#### error responses:
```
// Invalid OTP
{
  "success": false,
  "message": "Invalid or expired OTP"
}

// Wrong email
{
  "success": false,
  "message": "Invalid OTP for this email"
}
```

### Bước 3: Reset Password
### call: https://edu-map-be.vercel.app/v1/api/auth/reset-password
#### method: POST
-- body --
{
  "email": "nguyenvana@example.com",
  "newPassword": "MyNewPass123!"
}
#### response:
```
{
  "success": true,
  "message": "Password reset successfully"
}
```
#### error responses:
```
// Missing fields
{
  "success": false,
  "message": "Email and new password are required"
}

// OTP not verified
{
  "success": false,
  "message": "Please verify OTP first"
}

// User not found
{
  "success": false,
  "message": "User not found"
}

// Password validation failed
{
  "success": false,
  "message": "Password validation failed",
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter (A-Z)",
    "Password must contain at least one number (0-9)"
  ]
}
```

### 📱 Hướng dẫn triển khai Frontend:

#### Flow UI/UX đề xuất:
```
1. Trang "Forgot Password" 
   ├── Input email → Gọi API forgot-password
   ├── Hiển thị: "OTP đã được gửi đến email của bạn"
   └── Redirect đến trang nhập OTP

2. Trang "Enter OTP"
   ├── Input OTP 6 chữ số
   ├── Timer countdown 15 phút
   ├── Button "Verify OTP" → Gọi API verify-otp
   └── Redirect đến trang đặt password mới

3. Trang "Reset Password"
   ├── Input password mới (2 lần)
   ├── Button "Reset Password" → Gọi API reset-password
   └── Redirect đến trang login với thông báo thành công
```

#### Lưu ý quan trọng:
- **OTP hết hạn**: 15 phút
- **OTP chỉ dùng 1 lần**: Sau khi verify thành công, không thể dùng lại
- **Session**: Frontend cần lưu email trong session/localStorage để dùng ở bước 3
- **Validation**: Kiểm tra OTP format (6 chữ số) trước khi gọi API
- **Error handling**: Xử lý các trường hợp OTP sai, hết hạn, email không tồn tại

#### Code example (React):
```javascript
// Step 1: Send OTP
const sendOTP = async (email) => {
  const response = await fetch('/v1/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return response.json();
};

// Step 2: Verify OTP
const verifyOTP = async (email, otp) => {
  const response = await fetch('/v1/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  return response.json();
};

// Step 3: Reset Password
const resetPassword = async (email, newPassword) => {
  const response = await fetch('/v1/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword })
  });
  return response.json();
};
```

## SSO Google (OAuth 2.0)

### 1) Khái quát luồng
- Client mở trình duyệt tới endpoint SSO → hệ thống redirect sang Google
- Người dùng đồng ý → Google redirect về callback của BE
- BE cấp JWT và (tuỳ cấu hình) redirect về FE kèm `token`

### 2) Biến môi trường bắt buộc
```
CLIENT_ID_GOOGLE=your_google_client_id
CLIENT_SECRET_GOOGLE=your_google_client_secret
GOOGLE_CALLBACK_URL=http(s)://<BE_HOST>/v1/api/auth/google/callback
JWT_SECRET=your_jwt_secret
FE_REDIRECT_URL=http(s)://<FE_HOST>/v1/api/auth/callback  # tuỳ chọn nếu muốn redirect kèm token

# Email service (for forgot password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password  # App password cho Gmail
FRONTEND_URL=http(s)://<FE_HOST>  # URL frontend để tạo reset link
```

### 3) Endpoints

- GET `https://edu-map-be.vercel.app/v1/api/auth/google`
  - Tác dụng: khởi tạo SSO Google (redirect sang Google)
  - Gọi từ trình duyệt (không dùng cURL vì là redirect)

- GET `https://edu-map-be.vercel.app/v1/api/auth/google/callback`
  - Tác dụng: Google gọi về sau khi user đồng ý
  - Hành vi mặc định: Backend phát JWT và redirect về `FE_REDIRECT_URL?token=<JWT>`
  - Trường hợp bạn cấu hình trả JSON: response sẽ chứa `{ success, token }`

Lưu ý: Nếu môi trường local, thay `https://edu-map-be.vercel.app` bằng `http://localhost:3000`.

### 4) Cách dùng (FE)
- Mở đường dẫn: `GET /v1/api/auth/google`
- Sau khi đăng nhập thành công, nhận `token` ở callback FE:
  - Nếu redirect: đọc `token` từ query string `?token=<JWT>`
  - Lưu `token` (localStorage hoặc cookie HTTPOnly tuỳ chiến lược bảo mật)
  - Gửi `Authorization: Bearer <token>` cho các API cần xác thực

### 5) Ví dụ (Local)
- Bắt đầu SSO: mở trình duyệt tới `http://localhost:3000/v1/api/auth/google`
- Sau khi đăng nhập thành công, bạn sẽ được chuyển về `FE_REDIRECT_URL` với `?token=<JWT>`

### 6) Ghi chú bảo mật
- Production nên dùng cookie HTTPOnly + Secure để chứa token
- Thêm `state` vào OAuth flow (Passport hỗ trợ mặc định) để chống CSRF
- Nếu dùng multi-tenant, sau khi SSO có thể yêu cầu chọn `org` và cập nhật `user.orgId`

# USER

## Lấy thông tin profile người dùng
### call: https://edu-map-be.vercel.app/v1/api/users/profile
#### method: GET
#### headers: 
```
Authorization: Bearer {token}
```
#### response:
```
{
  "success": true,
  "data": {
    "id": "user_id",
    "name": "Nguyễn Văn A",
    "email": "nguyenvana@example.com",
    "role": "student",
    "createdAt": "2023-10-15T10:30:00Z",
    "updatedAt": "2023-10-15T10:30:00Z"
  }
}
```

## Lấy thông tin người dùng theo ID
### call: https://edu-map-be.vercel.app/v1/api/users/{id}
#### method: GET
#### headers: 
```
Authorization: Bearer {token}
```
#### response:
```
{
  "success": true,
  "data": {
    "id": "user_id",
    "name": "Nguyễn Văn A",
    "email": "nguyenvana@example.com",
    "role": "student",
    "createdAt": "2023-10-15T10:30:00Z",
    "updatedAt": "2023-10-15T10:30:00Z"
  }
}
```

## Cập nhật thông tin người dùng
### call: https://edu-map-be.vercel.app/v1/api/users/{id}
#### method: PUT
#### headers: 
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### body:
```
{
  "name": "Nguyễn Văn A Updated",
  "email": "nguyenvana_new@example.com"
}
```
#### response:
```
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "user_id",
    "name": "Nguyễn Văn A Updated",
    "email": "nguyenvana_new@example.com",
    "role": "student",
    "updatedAt": "2023-10-16T15:45:00Z"
  }
}
```

## Cập nhật role người dùng (Chỉ admin)
### call: https://edu-map-be.vercel.app/v1/api/users/{id}/role
#### method: PATCH
#### headers: 
```
Authorization: Bearer {token}
Content-Type: application/json
```
#### body:
```
{
  "role": "teacher" // hoặc "student", "admin"
}
```
#### response:
```
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "id": "user_id",
    "name": "Nguyễn Văn A",
    "email": "nguyenvana@example.com",
    "role": "teacher"
  }
}
```
#### error responses:
```
// Invalid role
{
  "success": false,
  "message": "Invalid role. Must be one of: teacher, student, admin"
}

// User not found
{
  "success": false,
  "message": "User not found"
}

// Admin access required
{
  "message": "Admin access required"
}
```

## Xóa tài khoản người dùng
### call: https://edu-map-be.vercel.app/v1/api/users/{id}
#### method: DELETE
#### headers: 
```
Authorization: Bearer {token}
```
#### response:
```
{
  "success": true,
  "message": "Account deleted successfully"
}
```

Lưu ý: Đối với các API user, người dùng phải được xác thực bằng token JWT trước khi truy cập. Token JWT nhận được sau khi đăng nhập hoặc đăng nhập qua Google. API cập nhật role chỉ dành cho admin.

# CLASS

## Học sinh tham gia lớp học bằng mã
### call: https://edu-map-be.vercel.app/v1/api/classes/{code}/join
#### method: POST
#### headers: 
```
Authorization: Bearer {token}
```
#### response:
```
{
  "success": true,
  "message": "Successfully joined the class",
  "data": {
    "classId": "class_id",
    "className": "Toán 12A",
    "classCode": "MATH12A"
  }
}
```

#### error responses:
```
// Class not found
{
  "success": false,
  "message": "Class not found with the provided code"
}

// Already a member
{
  "success": false,
  "message": "You are already a member of this class"
}

// Not authenticated
{
  "success": false,
  "message": "Authentication required - missing user ID"
}
```

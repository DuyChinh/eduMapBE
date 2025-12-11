# Tóm tắt: Fix lỗi timeout khi xử lý PDF dài

## ✅ Đã hoàn thành

### 1. Cập nhật Model ChatHistory
**File:** `src/models/ChatHistory.js`

Thêm field `status` để track trạng thái xử lý message:
- `pending`: Đang xử lý
- `completed`: Đã xử lý xong  
- `error`: Có lỗi

### 2. Refactor Controller AI Chat
**File:** `src/controllers/aiController.js`

**Thay đổi chính:**
- Phát hiện file PDF trong request
- Nếu có PDF:
  - Trả về response ngay với status `pending` 
  - Xử lý AI trong background (async IIFE)
  - Update message khi hoàn thành
- Nếu không có PDF: Xử lý bình thường (synchronous)

**Thêm function mới:**
- `checkMessageStatus()`: Check trạng thái của một message cụ thể (để client poll)
- Update `getHistory()`: Thêm query param `since` để filter messages theo thời gian

### 3. Thêm Routes mới
**File:** `src/routes/ai.js`

```
GET /v1/api/ai/message/:messageId/status
```
Endpoint để client check status của message đang xử lý

### 4. Migration Database
**File:** `src/migrations/022_add_status_to_chat_history.js`

- Set status mặc định `completed` cho 267 messages cũ
- Tạo index trên field `status`
- Migration đã chạy thành công ✅

### 5. Documentation
**File:** `AI_CHAT_ASYNC_PROCESSING.md`

Document đầy đủ về:
- Vấn đề và giải pháp
- Cách hoạt động của async processing
- Hướng dẫn sử dụng API cho frontend
- Code examples

## 🎯 Kết quả

### Trước khi fix:
❌ Upload PDF dài (50 câu) → Timeout error hiển thị  
❌ User experience kém (không biết đang xử lý)  
❌ Phải reload lại page để thấy kết quả  

### Sau khi fix:
✅ Upload PDF dài → Response ngay lập tức  
✅ Hiển thị "⏳ Đang xử lý file PDF..." cho user  
✅ Client có thể poll để nhận kết quả realtime  
✅ Không còn timeout error  
✅ Backend xử lý trong background, scalable  

## 📋 Cách sử dụng (Frontend)

### Option 1: Poll bằng message status endpoint
```javascript
// 1. Gửi PDF
const res = await fetch('/v1/api/ai/chat', {
  method: 'POST',
  body: formData
});

const data = await res.json();

if (data.data.status === 'pending') {
  const messageId = data.data.messageId;
  
  // 2. Poll để check status
  const interval = setInterval(async () => {
    const statusRes = await fetch(`/v1/api/ai/message/${messageId}/status`);
    const statusData = await statusRes.json();
    
    if (statusData.data.status === 'completed') {
      updateUI(statusData.data.message);
      clearInterval(interval);
    }
  }, 2000);
}
```

### Option 2: Fetch lại history
```javascript
// Mỗi 3 giây fetch messages mới
setInterval(async () => {
  const res = await fetch(`/v1/api/ai/history/${sessionId}?since=${lastTime}`);
  const data = await res.json();
  
  data.data.forEach(msg => updateOrAddMessage(msg));
}, 3000);
```

## 🔄 Những thay đổi không breaking

- Chat thông thường (text, ảnh) vẫn hoạt động như cũ (synchronous)
- Chỉ áp dụng async cho file PDF
- API response format giữ nguyên, chỉ thêm field `status` và `messageId`
- Backward compatible: messages cũ tự động có status `completed`

## 📝 Notes quan trọng

1. **Timeout cho polling**: Frontend nên implement timeout (ví dụ: dừng sau 2 phút)
2. **Error handling**: Nếu AI processing fail, message sẽ có status `error`
3. **History filter**: Query param `since` giúp optimize, chỉ fetch messages mới
4. **Scalability**: Có thể mở rộng thêm WebSocket để push realtime thay vì polling

## 🚀 Upgrade paths tương lai

1. **WebSocket**: Thay polling bằng WebSocket để push realtime
2. **Progress tracking**: Thêm field `progress` (0-100%) để hiển thị tiến trình
3. **Queue system**: Sử dụng Redis/Bull để manage background jobs
4. **Retry mechanism**: Auto retry nếu AI processing fail

## 🧪 Testing

Để test:
1. Upload một file PDF dài (>30 câu)
2. Quan sát response trả về ngay với status `pending`
3. Poll endpoint `/message/:messageId/status` 
4. Khi status = `completed`, verify message content đã đầy đủ

---

**Tạo bởi:** Tech Lead Senior Developer  
**Ngày:** 11/12/2025  
**Version:** 1.0


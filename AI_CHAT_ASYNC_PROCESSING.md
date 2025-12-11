# AI Chat - Async Processing for Large PDF Files

## Vấn đề
Khi xử lý file PDF dài (50+ câu hỏi kèm giải thích), quá trình AI extraction mất 30-60 giây hoặc hơn, gây ra timeout ở phía client. Mặc dù backend vẫn xử lý thành công và lưu vào DB, nhưng client nhận được thông báo lỗi.

## Giải pháp
Implement **async processing** cho file PDF:
1. Khi nhận request với file PDF, server trả về response ngay lập tức với status `pending`
2. Xử lý AI trong background (không block HTTP request)
3. Client có thể poll hoặc fetch lại để lấy kết quả cuối cùng

## Thay đổi

### 1. Model: ChatHistory
Thêm field `status` để track trạng thái xử lý:
- `pending`: Đang xử lý (AI đang làm việc trong background)
- `completed`: Đã xử lý xong
- `error`: Có lỗi xảy ra

```javascript
status: {
    type: String,
    enum: ['pending', 'completed', 'error'],
    default: 'completed'
}
```

### 2. Controller: aiController.chat()
- Phát hiện file PDF trong request
- Nếu có PDF: 
  - Tạo message với status `pending`
  - Trả về response ngay lập tức
  - Xử lý AI trong background
  - Update message khi hoàn thành
- Nếu không có PDF: Xử lý bình thường (synchronous)

### 3. Endpoints mới

#### Check Message Status
```
GET /v1/api/ai/message/:messageId/status
```

Response:
```json
{
  "ok": true,
  "data": {
    "messageId": "...",
    "status": "pending|completed|error",
    "message": "...",
    "isError": false,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### Get History với filter by time
```
GET /v1/api/ai/history/:sessionId?since=2024-12-11T10:30:00Z
```

Query param `since` (optional): Chỉ lấy messages sau thời điểm này

## Cách sử dụng (Frontend)

### 1. Gửi message với PDF
```javascript
const formData = new FormData();
formData.append('message', 'Trích xuất câu hỏi từ file này');
formData.append('files', pdfFile);
formData.append('sessionId', currentSessionId);

const response = await fetch('/v1/api/ai/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();

if (data.data.status === 'pending') {
  // Message đang được xử lý
  const messageId = data.data.messageId;
  
  // Hiển thị message pending cho user
  displayMessage({
    text: data.data.response, // "⏳ Đang xử lý file PDF..."
    status: 'pending',
    messageId
  });
  
  // Bắt đầu poll để check status
  pollMessageStatus(messageId);
}
```

### 2. Poll để check status
```javascript
function pollMessageStatus(messageId) {
  const pollInterval = setInterval(async () => {
    const response = await fetch(`/v1/api/ai/message/${messageId}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.data.status === 'completed') {
      // Xử lý xong, update UI
      updateMessage(messageId, {
        text: data.data.message,
        status: 'completed'
      });
      clearInterval(pollInterval);
    } else if (data.data.status === 'error') {
      // Có lỗi
      updateMessage(messageId, {
        text: data.data.message,
        status: 'error',
        isError: true
      });
      clearInterval(pollInterval);
    }
    // Nếu vẫn pending, tiếp tục poll
  }, 2000); // Poll mỗi 2 giây
}
```

### 3. Hoặc sử dụng History endpoint
```javascript
// Thay vì poll từng message, có thể fetch lại toàn bộ history
async function refreshHistory(sessionId, lastMessageTime) {
  const response = await fetch(
    `/v1/api/ai/history/${sessionId}?since=${lastMessageTime}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await response.json();
  
  // Update UI với messages mới hoặc updated
  data.data.forEach(msg => {
    updateOrAddMessage(msg);
  });
}

// Gọi định kỳ
setInterval(() => {
  const lastTime = getLastMessageTime();
  refreshHistory(currentSessionId, lastTime);
}, 3000);
```

## Lợi ích
1. ✅ Không còn timeout error cho file PDF dài
2. ✅ User experience tốt hơn với feedback realtime
3. ✅ Backend có thể xử lý file lớn mà không bị giới hạn bởi HTTP timeout
4. ✅ Scalable: Có thể xử lý nhiều requests đồng thời
5. ✅ Dữ liệu vẫn được lưu đầy đủ vào DB

## Notes
- Chỉ áp dụng async processing cho file PDF (vì mất nhiều thời gian)
- Chat thông thường (text, ảnh) vẫn xử lý synchronous như cũ
- Client nên implement timeout cho polling (ví dụ: dừng sau 2 phút)
- Có thể mở rộng thêm WebSocket để push realtime thay vì polling


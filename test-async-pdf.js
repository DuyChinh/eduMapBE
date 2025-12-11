const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_BASE = 'http://localhost:3000/v1/api';
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE';

async function testAsyncPDFProcessing() {
  try {
    console.log('🧪 Testing Async PDF Processing...\n');

    const formData = new FormData();
    formData.append('message', 'Trích xuất tất cả câu hỏi từ file PDF này theo format JSON');
    
    const pdfPath = './src/docs/Đề kiểm tra Toán 8 TN + TL.pdf';
    if (fs.existsSync(pdfPath)) {
      formData.append('files', fs.createReadStream(pdfPath));
    } else {
      console.error('❌ PDF file not found at:', pdfPath);
      return;
    }

    console.log('📤 Step 1: Sending PDF to chat endpoint...');
    const chatResponse = await axios.post(`${API_BASE}/ai/chat`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    console.log('✅ Response received:');
    console.log('   Status:', chatResponse.data.data.status);
    console.log('   Message:', chatResponse.data.data.response);
    console.log('   Session ID:', chatResponse.data.data.sessionId);

    if (chatResponse.data.data.status === 'pending') {
      const messageId = chatResponse.data.data.messageId;
      const sessionId = chatResponse.data.data.sessionId;
      
      console.log('\n⏳ Step 2: Polling message status...');
      console.log('   Message ID:', messageId);

      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;

        const statusResponse = await axios.get(
          `${API_BASE}/ai/message/${messageId}/status`,
          {
            headers: {
              'Authorization': `Bearer ${AUTH_TOKEN}`
            }
          }
        );

        const status = statusResponse.data.data.status;
        console.log(`   [${attempts}] Status: ${status}`);

        if (status === 'completed') {
          console.log('\n✅ Step 3: Processing completed!');
          console.log('   Message preview:', statusResponse.data.data.message.substring(0, 200) + '...');
          
          const historyResponse = await axios.get(
            `${API_BASE}/ai/history/${sessionId}`,
            {
              headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
              }
            }
          );
          
          console.log('\n📊 Step 4: Full history retrieved');
          console.log('   Total messages:', historyResponse.data.data.length);
          
          const botMessage = historyResponse.data.data.find(
            msg => msg._id === messageId
          );
          
          if (botMessage) {
            console.log('\n📝 Final extracted content:');
            console.log(botMessage.message);
          }
          
          break;
        } else if (status === 'error') {
          console.log('\n❌ Processing failed with error');
          console.log('   Error message:', statusResponse.data.data.message);
          break;
        }
      }

      if (attempts >= maxAttempts) {
        console.log('\n⏱️ Timeout: Processing took too long');
      }
    } else {
      console.log('\n✅ Processing completed immediately (not async)');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

console.log('='.repeat(60));
console.log('  Async PDF Processing Test Script');
console.log('='.repeat(60));
console.log('\n⚠️  Before running:');
console.log('   1. Update AUTH_TOKEN in this file');
console.log('   2. Make sure server is running on localhost:3000');
console.log('   3. Have a PDF file at ./src/docs/Đề kiểm tra Toán 8 TN + TL.pdf');
console.log('\n');

if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
  console.log('❌ Please update AUTH_TOKEN before running this test');
  process.exit(1);
}

testAsyncPDFProcessing();


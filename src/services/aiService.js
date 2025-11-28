const axios = require('axios');
const https = require('https');

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY is missing in .env file");
}

const generateResponse = async (prompt, attachments = [], history = []) => {
    try {
        // Use gemini-2.0-flash (new standard model)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        let contents = [];

        // Add history first
        if (history && history.length > 0) {
            contents = [...history];
        }

        // Current message parts
        const currentParts = [{ text: prompt }];

        if (attachments && attachments.length > 0) {
            attachments.forEach(att => {
                currentParts.push({
                    inline_data: {
                        mime_type: att.mimeType,
                        data: att.data
                    }
                });
            });
        }

        // Add current message to contents
        contents.push({
            role: 'user',
            parts: currentParts
        });

        const payload = {
            contents: contents
        };

        // Force IPv4 to avoid ETIMEDOUT on IPv6
        const httpsAgent = new https.Agent({ family: 4 });

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            httpsAgent: httpsAgent,
            timeout: 30000 // 30 seconds timeout
        });

        // Extract text from response
        if (response.data &&
            response.data.candidates &&
            response.data.candidates.length > 0 &&
            response.data.candidates[0].content &&
            response.data.candidates[0].content.parts &&
            response.data.candidates[0].content.parts.length > 0) {

            return response.data.candidates[0].content.parts[0].text;
        }

        return "I didn't get a response from the AI.";

    } catch (error) {
        console.error("Error generating AI response:", error.message);
        if (error.response) {
            console.error("Gemini API Error Details:", JSON.stringify(error.response.data, null, 2));
        }
        throw new Error("Failed to generate response from AI service");
    }
};

module.exports = {
    generateResponse
};

const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY is missing in .env file");
}

const client = new GoogleGenAI({ apiKey: apiKey });

const generateResponse = async (prompt, attachments = [], history = []) => {
    try {
        // Prepare contents array with history and current message
        let contents = [];

        // Add history first (if any)
        if (history && history.length > 0) {
            // Convert history format to match new API
            history.forEach(msg => {
                contents.push({
                    role: msg.role,
                    parts: msg.parts || [{ text: msg.text || '' }]
                });
            });
        }

        // Prepare current message parts
        const currentParts = [{ text: prompt }];

        // Add attachments if any
        if (attachments && attachments.length > 0) {
            attachments.forEach(att => {
                currentParts.push({
                    inlineData: {
                        mimeType: att.mimeType,
                        data: att.data
                    }
                });
            });
        }

        // Add current user message
        contents.push({
            role: 'user',
            parts: currentParts
        });

        // Generate content using new API
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents
        });

        // Extract text from response
        if (response && response.text) {
            return response.text;
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

const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini API
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const GEMINI_API_KEY_ARRAY = (() => {
    try {
        let keys = process.env.GEMINI_API_KEY_ARRAY;
        if (!keys) return [];

        // Handle case where keys might be wrapped in quotes or use single quotes
        if (typeof keys === 'string') {
            keys = keys.trim();
            if (keys.startsWith("'") && keys.endsWith("'")) {
                keys = keys.slice(1, -1);
            }
            keys = keys.replace(/'/g, '"');

            return JSON.parse(keys);
        }

        return keys;
    } catch (e) {
        console.error("Failed to parse GEMINI_API_KEY_ARRAY from .env", e);
        // Fallback: try to split by comma if JSON parse fails
        try {
            const rawKeys = process.env.GEMINI_API_KEY_ARRAY;
            if (rawKeys) {
                return rawKeys.replace(/[\[\]"']/g, '').split(',').map(k => k.trim()).filter(k => k);
            }
        } catch (e2) {
            console.error("Fallback parsing also failed", e2);
        }
        return [];
    }
})();

if (GEMINI_API_KEY_ARRAY.length === 0) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY_ARRAY is missing or empty in .env file");
}

let currentKeyIndex = 0;

const getClient = () => {
    const apiKey = GEMINI_API_KEY_ARRAY[currentKeyIndex];
    return new GoogleGenAI({ apiKey: apiKey });
};

const generateResponse = async (prompt, attachments = [], history = []) => {
    try {
        let contents = [];

        if (history && history.length > 0) {
            history.forEach(msg => {
                contents.push({
                    role: msg.role,
                    parts: msg.parts || [{ text: msg.text || '' }]
                });
            });
        }
        const currentParts = [{ text: prompt }];
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

        contents.push({
            role: 'user',
            parts: currentParts
        });

        // Retry logic
        let attempt = 0;
        const maxRetries = GEMINI_API_KEY_ARRAY.length * 2; // Allow cycling through keys a couple of times if needed

        while (attempt < maxRetries) {
            try {
                const client = getClient();
                // Generate content using new API
                const response = await client.models.generateContent({
                    model: 'gemini-2.5-flash',
                    // model: 'gemini-2.5-pro',
                    // model: 'gemini-3-pro-preview',
                    contents: contents
                });

                // Extract text from response
                if (response && response.text) {
                    return response.text;
                }

                return "I didn't get a response from the AI.";

            } catch (error) {
                const isRateLimit = error.status === 429 ||
                    (error.message && error.message.includes("429")) ||
                    (error.message && error.message.includes("RESOURCE_EXHAUSTED"));

                attempt++;

                if (isRateLimit) {
                    console.warn(`[Key Index ${currentKeyIndex}] Gặp lỗi 429 (Rate Limit). Switching key...`);

                    // Switch to next key
                    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEY_ARRAY.length;

                    // Optional: small delay even when switching keys to be safe, but usually switching is enough
                    await sleep(1000);
                    continue;
                }

                throw error;
            }
        }

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

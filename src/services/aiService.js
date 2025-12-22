const https = require('https');

// Initialize Gemini API
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const GEMINI_API_KEY_ARRAY = (() => {
    try {
        let keys = process.env.GEMINI_API_KEY_ARRAY;
        if (!keys) return [];

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
        try {
            const rawKeys = process.env.GEMINI_API_KEY_ARRAY;
            if (rawKeys) {
                return rawKeys.replace(/[\[\]"']/g, '').split(',').map(k => k.trim()).filter(k => k);
            }
        } catch (e2) { }
        return [];
    }
})();

let currentKeyIndex = 0;

// Helper to make raw HTTP requests
const makeRequest = (method, path, apiKey, payload = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `${path}?key=${apiKey}`,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60000, // Reduced to 1 minute to prevent hanging
            family: 4 // Force IPv4
        };

        if (payload) {
            const data = JSON.stringify(payload);
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error('Invalid JSON response from Gemini API'));
                    }
                } else {
                    reject(new Error(`Gemini API Error: ${res.statusCode} - ${body}`));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request Timeout'));
        });

        req.on('error', (e) => reject(e));

        if (payload) {
            req.write(JSON.stringify(payload));
        }
        req.end();
    });
};

const getAvailableModels = async (apiKey) => {
    try {
        console.log('[AI] Listing available models...');
        const response = await makeRequest('GET', '/v1beta/models', apiKey);
        if (response && response.models) {
            // Filter for models that support generateContent
            const models = response.models
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', '')); // remove prefix

            console.log('[AI] Available Models:', models);
            return models;
        }
        return [];
    } catch (error) {
        console.warn('[AI] Failed to list models:', error.message);
        return [];
    }
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

        const payload = {
            contents: contents,
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 20000
            }
        };

        // Retry logic
        let attempt = 0;
        const maxRetries = GEMINI_API_KEY_ARRAY.length; // Don't retry endlessly

        // Start with User requested model
        let specificModel = 'gemini-2.0-flash';

        while (attempt < maxRetries) {
            try {
                const apiKey = GEMINI_API_KEY_ARRAY[currentKeyIndex];
                console.log(`[AI] Requesting specific model: ${specificModel} (Key Index: ${currentKeyIndex})...`);

                const response = await makeRequest('POST', `/v1beta/models/${specificModel}:generateContent`, apiKey, payload);

                if (response && response.candidates && response.candidates.length > 0) {
                    const candidate = response.candidates[0];
                    if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                        const text = candidate.content.parts[0].text;
                        console.log('[AI] Success!');
                        return text;
                    }
                }

                console.warn('[AI] Empty candidates in response.');
                return "I didn't get a response from the AI.";

            } catch (error) {
                attempt++;
                console.warn(`[AI] Attempt ${attempt} failed: ${error.message}`);

                const isRateLimit = error.message.includes("429") || error.message.includes("RESOURCE_EXHAUSTED");
                const isNotFound = error.message.includes("404") && error.message.includes("NOT_FOUND");
                const isOverloaded = error.message.includes("503") || error.message.includes("UNAVAILABLE");

                if (isRateLimit || isOverloaded) {
                    console.warn(`[Key Index ${currentKeyIndex}] Rate Limit/Overload. Switching key...`);
                    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEY_ARRAY.length;
                    await sleep(1000); // Short wait before retry
                    continue;
                }

                // If the model name is wrong (404), DISCOVER available models and switch.
                if (isNotFound) {
                    console.warn(`[AI] Model ${specificModel} not found. Attempting to discover available models...`);
                    const apiKey = GEMINI_API_KEY_ARRAY[currentKeyIndex];
                    const availableModels = await getAvailableModels(apiKey);

                    // Priority list for vision/text capability
                    // Prioritize 2.0/2.5 flash models
                    const preferredOrder = [
                        'gemini-2.0-flash',
                        'gemini-2.0-flash-exp',
                        'gemini-2.5-flash',
                        'gemini-1.5-flash',
                        'gemini-flash-latest'
                    ];

                    const bestMatch = preferredOrder.find(m => availableModels.includes(m)) || availableModels.find(m => m.includes('flash')) || availableModels[0];

                    if (bestMatch) {
                        console.log(`[AI] Switching to discovered model: ${bestMatch}`);
                        specificModel = bestMatch;
                        // Don't count this as a failed attempt, just retry immediately with correct model
                        attempt--;
                        await sleep(500);
                        continue;
                    }
                }

                if (attempt >= maxRetries) throw error;
                await sleep(1000);
            }
        }

    } catch (error) {
        console.error("Error generating AI response:", error.message);
        throw new Error("Failed to generate response from AI service");
    }
};

module.exports = {
    generateResponse
};

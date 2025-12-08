const aiService = require('../services/aiService');
const { ChatHistory, ChatSession } = require('../models');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

/**
 * Handle chat request
 * POST /v1/api/ai/chat
 */
const chat = async (req, res, next) => {
    try {
        const { message, sessionId } = req.body;
        const userId = req.user.id;
        const files = req.files || [];

        if (!message && files.length === 0) {
            return res.status(400).json({
                ok: false,
                message: 'Message or file is required'
            });
        }

        let currentSessionId = sessionId;
        let session;
        // Use full message as title, but limit to reasonable length (500 chars) to avoid extremely long titles
        const sessionTitle = message ? (message.length > 500 ? message.substring(0, 500) : message) : (files.length > 0 ? 'File Upload' : 'New Chat');

        // Create new session if no sessionId provided or if it doesn't exist
        if (!currentSessionId) {
            session = await ChatSession.create({
                userId,
                title: sessionTitle,
                lastMessage: message || (files.length > 0 ? '[File]' : '')
            });
            currentSessionId = session._id;
        } else {
            // Verify session exists and belongs to user
            session = await ChatSession.findOne({ _id: currentSessionId, userId });
            if (!session) {
                // If session invalid, create new one
                session = await ChatSession.create({
                    userId,
                    title: sessionTitle,
                    lastMessage: message || (files.length > 0 ? '[File]' : '')
                });
                currentSessionId = session._id;
            } else {
                // Update last message
                session.lastMessage = message || (files.length > 0 ? '[File]' : '');
                await session.save();
            }
        }

        // Process attachments
        let aiAttachments = [];
        let historyAttachments = [];

        if (files.length > 0) {
            // Upload files to Cloudinary and prepare for AI
            const uploadPromises = files.map(file => {
                return new Promise((resolve, reject) => {
                    // 1. Prepare for AI (base64)
                    const base64Data = file.buffer.toString('base64');

                    // 2. Upload to Cloudinary
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'edumap_chat',
                            resource_type: 'auto'
                        },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve({
                                aiAttachment: {
                                    mimeType: file.mimetype,
                                    data: base64Data
                                },
                                historyAttachment: {
                                    type: file.mimetype.startsWith('image/') ? 'image' : 'file',
                                    url: result.secure_url,
                                    name: file.originalname
                                }
                            });
                        }
                    );
                    streamifier.createReadStream(file.buffer).pipe(uploadStream);
                });
            });

            const results = await Promise.all(uploadPromises);

            results.forEach(res => {
                aiAttachments.push(res.aiAttachment);
                historyAttachments.push(res.historyAttachment);
            });
        }

        // Save user message
        await ChatHistory.create({
            userId,
            sessionId: currentSessionId,
            sender: 'user',
            message: message || '',
            attachments: historyAttachments
        });

        // Fetch recent history for context (last 20 messages)
        const recentHistory = await ChatHistory.find({
            userId,
            sessionId: currentSessionId
        })
            .sort({ createdAt: -1 })
            .limit(20);

        // Format history for Gemini
        const formattedHistory = recentHistory.reverse().map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.message }]
        }));

        // Generate AI response with history
        const response = await aiService.generateResponse(message || '', aiAttachments, formattedHistory);

        // Save bot response
        await ChatHistory.create({
            userId,
            sessionId: currentSessionId,
            sender: 'bot',
            message: response
        });

        res.json({
            ok: true,
            data: {
                response,
                sessionId: currentSessionId,
                sessionTitle: session.title
            }
        });
    } catch (error) {
        console.error('Error in chat controller:', error);

        // Save error message if possible
        if (req.user && req.user.id && req.body.sessionId) {
            await ChatHistory.create({
                userId: req.user.id,
                sessionId: req.body.sessionId,
                sender: 'bot',
                message: 'Sorry, I encountered an error. Please try again later.',
                isError: true
            }).catch(err => console.error('Failed to save error message:', err));
        }

        next(error);
    }
};

/**
 * Get chat history for a specific session
 * GET /v1/api/ai/history/:sessionId
 */
const getHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;

        // Validate sessionId
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({
                ok: false,
                message: 'Invalid session ID'
            });
        }

        const history = await ChatHistory.find({ userId, sessionId })
            .sort({ createdAt: 1 });

        res.json({
            ok: true,
            data: history
        });
    } catch (error) {
        console.error('Error getting chat history:', error);
        next(error);
    }
};

/**
 * Get all chat sessions for user
 * GET /v1/api/ai/sessions
 */
const getSessions = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const sessions = await ChatSession.find({ userId })
            .sort({ pinned: -1, updatedAt: -1 }); // Pinned first, then newest first

        // For sessions with truncated titles (ending with "..."), get full title from first message
        const sessionsWithFullTitles = await Promise.all(sessions.map(async (session) => {
            const sessionObj = session.toObject();
            
            // Check if title is truncated (ends with "...")
            if (sessionObj.title && sessionObj.title.endsWith('...')) {
                // Get first user message from this session
                const firstMessage = await ChatHistory.findOne({
                    userId,
                    sessionId: session._id,
                    sender: 'user'
                }).sort({ createdAt: 1 });
                
                // If found, use the full message as title (limit to 500 chars)
                if (firstMessage && firstMessage.message) {
                    sessionObj.title = firstMessage.message.length > 500 
                        ? firstMessage.message.substring(0, 500) 
                        : firstMessage.message;
                }
            }
            
            return sessionObj;
        }));

        res.json({
            ok: true,
            data: sessionsWithFullTitles
        });
    } catch (error) {
        console.error('Error getting chat sessions:', error);
        next(error);
    }
};

/**
 * Create a new session
 * POST /v1/api/ai/sessions
 */
const createSession = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const session = await ChatSession.create({
            userId,
            title: 'New Chat',
            lastMessage: ''
        });

        res.json({
            ok: true,
            data: session
        });
    } catch (error) {
        console.error('Error creating session:', error);
        next(error);
    }
};

/**
 * Delete a chat session
 * DELETE /v1/api/ai/sessions/:sessionId
 */
const deleteSession = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;

        // Validate sessionId
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({
                ok: false,
                message: 'Invalid session ID'
            });
        }

        // Find and verify session ownership
        const session = await ChatSession.findOne({ _id: sessionId, userId });
        if (!session) {
            return res.status(404).json({
                ok: false,
                message: 'Session not found'
            });
        }

        // Delete session and associated history
        await ChatSession.deleteOne({ _id: sessionId });
        await ChatHistory.deleteMany({ sessionId });

        res.json({
            ok: true,
            message: 'Session deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting session:', error);
        next(error);
    }
};

/**
 * Rename a chat session
 * PATCH /v1/api/ai/sessions/:sessionId
 */
const renameSession = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({
                ok: false,
                message: 'Title is required'
            });
        }

        // Validate sessionId
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({
                ok: false,
                message: 'Invalid session ID'
            });
        }

        // Find and update session
        const session = await ChatSession.findOneAndUpdate(
            { _id: sessionId, userId },
            { title },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({
                ok: false,
                message: 'Session not found'
            });
        }

        res.json({
            ok: true,
            message: 'Session renamed successfully',
            data: session
        });
    } catch (error) {
        console.error('Error renaming session:', error);
        next(error);
    }
};

/**
 * Edit a user message and regenerate response
 * PUT /v1/api/ai/message/:messageId
 * This creates a new message at the end (like sending a new message)
 */
const editMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                ok: false,
                message: 'Message is required'
            });
        }

        // 1. Find the original message to get sessionId
        const targetMessage = await ChatHistory.findOne({ _id: messageId, userId });
        if (!targetMessage) {
            return res.status(404).json({
                ok: false,
                message: 'Message not found'
            });
        }

        if (targetMessage.sender !== 'user') {
            return res.status(400).json({
                ok: false,
                message: 'Can only edit user messages'
            });
        }

        const sessionId = targetMessage.sessionId;

        // 2. Create new user message at the end (like sending a new message)
        const newMessage = await ChatHistory.create({
            userId,
            sessionId,
            sender: 'user',
            message: message,
            attachments: [] // New message, no attachments
        });

        // 3. Fetch recent history for context (last 20 messages)
        const recentHistory = await ChatHistory.find({
            userId,
            sessionId
        })
            .sort({ createdAt: -1 })
            .limit(20);

        // Format history for Gemini
        const formattedHistory = recentHistory.reverse().map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.message }]
        }));

        // Remove the last message (the one we just added) to use it as the prompt
        formattedHistory.pop();

        // 4. Generate new AI response
        const response = await aiService.generateResponse(message, [], formattedHistory);

        // 5. Save bot response
        const botMessage = await ChatHistory.create({
            userId,
            sessionId,
            sender: 'bot',
            message: response
        });

        // 6. Update session's last message
        await ChatSession.findByIdAndUpdate(sessionId, {
            lastMessage: message
        });

        res.json({
            ok: true,
            data: {
                response,
                sessionId,
                userMessage: newMessage,
                botMessage
            }
        });

    } catch (error) {
        console.error('Error editing message:', error);
        next(error);
    }
};

/**
 * Search chat sessions and messages
 * GET /v1/api/ai/sessions/search?q=searchTerm
 */
const searchSessions = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { q } = req.query;

        if (!q || q.trim() === '') {
            return res.json({
                ok: true,
                data: []
            });
        }

        const searchTerm = q.trim();
        const searchRegex = new RegExp(searchTerm, 'i'); // Case-insensitive search

        // Search in session titles
        const sessionsByTitle = await ChatSession.find({
            userId,
            title: searchRegex
        }).sort({ updatedAt: -1 });

        // Search in messages
        const messages = await ChatHistory.find({
            userId,
            message: searchRegex
        })
            .select('sessionId message createdAt')
            .sort({ createdAt: -1 });

        // Get unique session IDs from messages
        const messageSessionIds = [...new Set(messages.map(msg => msg.sessionId.toString()))];
        
        // Fetch full session details for messages
        const sessionsFromMessages = await ChatSession.find({
            _id: { $in: messageSessionIds },
            userId
        });

        // Group messages by session and get unique sessions
        const sessionMap = new Map();
        
        // Add sessions found by title
        sessionsByTitle.forEach(session => {
            const sessionObj = session.toObject();
            sessionMap.set(session._id.toString(), {
                session: sessionObj,
                matchType: 'title',
                preview: sessionObj.lastMessage || ''
            });
        });

        // Add sessions found by message content
        sessionsFromMessages.forEach(session => {
            const sessionId = session._id.toString();
            if (!sessionMap.has(sessionId)) {
                // Find the first matching message for preview
                const matchingMsg = messages.find(msg => msg.sessionId.toString() === sessionId);
                const sessionObj = session.toObject();
                sessionMap.set(sessionId, {
                    session: sessionObj,
                    matchType: 'content',
                    preview: matchingMsg ? matchingMsg.message.substring(0, 150) : ''
                });
            }
        });

        // Convert map to array and format response
        const results = Array.from(sessionMap.values()).map(item => {
            const session = item.session;
            // Ensure dates are properly formatted
            const createdAt = session.createdAt instanceof Date 
                ? session.createdAt.toISOString() 
                : (session.createdAt ? new Date(session.createdAt).toISOString() : new Date().toISOString());
            
            const updatedAt = session.updatedAt instanceof Date 
                ? session.updatedAt.toISOString() 
                : (session.updatedAt ? new Date(session.updatedAt).toISOString() : new Date().toISOString());
            
            return {
                _id: session._id,
                title: session.title || 'New Chat',
                lastMessage: session.lastMessage || '',
                createdAt: createdAt,
                updatedAt: updatedAt,
                preview: item.preview,
                matchType: item.matchType
            };
        });

        // Sort by createdAt descending (newest first)
        results.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB - dateA; // Descending order
        });

        res.json({
            ok: true,
            data: results
        });
    } catch (error) {
        console.error('Error searching sessions:', error);
        next(error);
    }
};

/**
 * Toggle pin status of a chat session
 * PATCH /v1/api/ai/sessions/:sessionId/toggle-pin
 */
const togglePinSession = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;

        // Validate sessionId
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({
                ok: false,
                message: 'Invalid session ID'
            });
        }

        // Find and verify session ownership
        const session = await ChatSession.findOne({ _id: sessionId, userId });
        if (!session) {
            return res.status(404).json({
                ok: false,
                message: 'Session not found'
            });
        }

        // Toggle pin status
        session.pinned = !session.pinned;
        await session.save();

        res.json({
            ok: true,
            message: `Session ${session.pinned ? 'pinned' : 'unpinned'} successfully`,
            data: session
        });
    } catch (error) {
        console.error('Error toggling pin session:', error);
        next(error);
    }
};

module.exports = {
    chat,
    getHistory,
    getSessions,
    searchSessions,
    createSession,
    deleteSession,
    renameSession,
    editMessage,
    togglePinSession
};
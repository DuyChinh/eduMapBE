/**
 * Socket.IO Service for real-time notifications
 * Manages socket instance and emits events to specific users
 */

let io = null;
const userSockets = new Map(); // userId -> Set of socket ids

/**
 * Set the Socket.IO server instance
 * @param {Object} ioInstance - Socket.IO server instance
 */
function setIO(ioInstance) {
    io = ioInstance;
}

/**
 * Get the Socket.IO server instance
 * @returns {Object} Socket.IO server instance
 */
function getIO() {
    return io;
}

/**
 * Register a user's socket connection
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
function registerUserSocket(userId, socketId) {
    if (!userId) return;
    
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socketId);
}

/**
 * Unregister a user's socket connection
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
function unregisterUserSocket(userId, socketId) {
    if (!userId || !userSockets.has(userId)) return;
    
    userSockets.get(userId).delete(socketId);
    if (userSockets.get(userId).size === 0) {
        userSockets.delete(userId);
    }
}

/**
 * Emit notification to a specific user
 * @param {string} userId - Target user ID
 * @param {Object} notification - Notification data
 */
function emitNotification(userId, notification) {
    if (!io || !userId) return;
    
    const userIdStr = userId.toString();
    const userSocketIds = userSockets.get(userIdStr);
    
    if (userSocketIds && userSocketIds.size > 0) {
        userSocketIds.forEach(socketId => {
            io.to(socketId).emit('NEW_NOTIFICATION', notification);
        });
    }
}

/**
 * Emit notifications to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Object} notification - Notification data
 */
function emitNotificationToMany(userIds, notification) {
    if (!io || !userIds || !Array.isArray(userIds)) return;
    
    userIds.forEach(userId => {
        emitNotification(userId, notification);
    });
}

/**
 * Broadcast notification to all connected users
 * @param {Object} notification - Notification data
 */
function broadcastNotification(notification) {
    if (!io) return;
    io.emit('NEW_NOTIFICATION', notification);
}

/**
 * Emit feed update to a specific class room
 * @param {string} classId - Class ID
 * @param {Object} data - Feed update data (type: 'NEW_POST' | 'NEW_COMMENT' | 'POST_UPDATED' | 'POST_DELETED')
 */
function emitFeedUpdate(classId, data) {
    if (!io || !classId) return;
    io.to(`class_${classId}`).emit('FEED_UPDATE', data);
}

module.exports = {
    setIO,
    getIO,
    registerUserSocket,
    unregisterUserSocket,
    emitNotification,
    emitNotificationToMany,
    broadcastNotification,
    emitFeedUpdate
};

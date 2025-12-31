// Canvas polyfills for serverless - MUST be first import
require('./utils/canvasPolyfill');

const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const cors = require("cors");
const passport = require('passport');
require('./config/passport');
const authRoutes = require('./routes/auth');
const configureRoutes = require('./routes/index');


// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware setup
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(passport.initialize());

// Root route - Health check
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Server is running successfully!',
        version: 'v1',
        status: 'healthy'
    });
});

// Admin views routes (before API routes to avoid conflicts)
const adminViewRoutes = require('./routes/adminViews');
app.use('/admin', adminViewRoutes);

// Routes version 1
// app.use('/auth', authRoutes);
configureRoutes(app);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
// Only listen if executed directly
if (require.main === module) {
    const http = require('http');
    const { Server } = require('socket.io');
    const ChangeStreamService = require('./services/changeStreamService');
    const socketService = require('./services/socketService');
    const auditLogService = require('./services/auditLogService');
    const jwt = require('jsonwebtoken');

    const PORT = process.env.PORT || 3000;
    const server = http.createServer(app);

    // Initialize Socket.io
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Set io instance in socketService for use in controllers
    socketService.setIO(io);

    // Set io instance in auditLogService for realtime audit logs
    auditLogService.setSocketIO(io);

    // Initialize Change Stream Service for audit logs
    const changeStreamService = new ChangeStreamService(io);

    // Socket.IO connection handling
    io.on('connection', (socket) => {
        // Handle user authentication
        socket.on('authenticate', (data) => {
            try {
                const { token } = data;
                if (!token) {
                    socket.emit('auth_error', { message: 'No token provided' });
                    return;
                }
                
                // Verify JWT token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const userId = decoded.id || decoded.userId;
                
                if (userId) {
                    socket.userId = userId;
                    socketService.registerUserSocket(userId, socket.id);
                    socket.emit('authenticated', { success: true, userId });
                }
            } catch (error) {
                socket.emit('auth_error', { message: 'Invalid token' });
            }
        });
        
        // Handle joining a class room for feed updates
        socket.on('join_class', (data) => {
            const { classId } = data;
            if (classId) {
                socket.join(`class_${classId}`);
            }
        });
        
        // Handle leaving a class room
        socket.on('leave_class', (data) => {
            const { classId } = data;
            if (classId) {
                socket.leave(`class_${classId}`);
            }
        });
        
        // Handle typing event
        socket.on('typing', (data) => {
            const { classId, postId, user } = data;
            if (classId) {
                // Broadcast to everyone in the room except the sender
                socket.to(`class_${classId}`).emit('typing', { classId, postId, user });
            }
        });

        // Handle stop typing event
        socket.on('stop_typing', (data) => {
            const { classId, postId, user } = data;
            if (classId) {
                // Broadcast to everyone in the room except the sender
                socket.to(`class_${classId}`).emit('stop_typing', { classId, postId, user });
            }
        });
        
        // Handle disconnect
        socket.on('disconnect', () => {
            if (socket.userId) {
                socketService.unregisterUserSocket(socket.userId, socket.id);
            }
        });
    });

    // Wait for MongoDB connection before starting change streams
    const mongoose = require('mongoose');
    mongoose.connection.once('open', () => {
        changeStreamService.init();
    });

    // If already connected
    if (mongoose.connection.readyState === 1) {
        changeStreamService.init();
    }

    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
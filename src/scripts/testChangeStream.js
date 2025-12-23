const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to DB - Use the same connection string as server
// We'll just assume standard env var or hardcoded for test
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://chinhdd:210203chinH@cluster0.qt9aarw.mongodb.net/EduMap?retryWrites=true&w=majority&appName=Cluster0';

async function testChangeStreamTrigger() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Create a dummy user to trigger insert event
        const newUser = await User.create({
            email: `test_user_${Date.now()}@example.com`,
            password: 'password123',
            name: 'Test Change Stream User',
            role: 'student'
        });
        console.log('Created User:', newUser._id);

        // Update the user to trigger update event
        await User.findByIdAndUpdate(newUser._id, { name: 'Updated Name' });
        console.log('Updated User:', newUser._id);

        // Delete the user to trigger delete event
        await User.findByIdAndDelete(newUser._id);
        console.log('Deleted User:', newUser._id);

        console.log('Test complete. Check server logs for [DEBUG] output.');
        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('Test Error:', error);
        process.exit(1);
    }
}

testChangeStreamTrigger();

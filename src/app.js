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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
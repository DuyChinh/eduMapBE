const express = require('express');
const app = express();
require('dotenv').config();
const cors = require("cors");
const passport = require('passport');
require('./config/passport');
const authRoutes = require('./routes/auth');
const configureRoutes = require('./routes/index');


// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(passport.initialize());

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
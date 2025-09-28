const express = require('express');
const router = express.Router();
const app = express();
const indexRoutes = require('./routes/index');
const config = require('./config/index');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const cors = require("cors");

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.use('/', indexRoutes);
app.use('/auth', authRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
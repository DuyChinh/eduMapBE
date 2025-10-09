const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');

// Standard auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Google OAuth routes
router.get('/google',
  authController.handleLoginGoogle,
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err) {
      console.error('Google OAuth error:', err);
      if (info) console.error('Google OAuth info:', info);
      return res.status(401).send('Google OAuth error');
    }
    if (!user) {
      console.error('Google OAuth failed. Info:', info);
      return res.status(401).send('Google OAuth failed');
    }
    req.user = user;
    return authController.handleLoginGoogleCallback(req, res);
  })(req, res, next);
});

module.exports = router;
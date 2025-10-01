const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User'); 
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;


if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
  throw new Error(
    'Missing required Google OAuth env vars. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.'
  );
}

passport.use(new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile?._json?.email;
      const name = profile?._json?.name;
      const picture = profile?._json?.picture;

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name,
          email,
          password: 'oauth_google', 
          role: 'student',
          status: 'active',
          profile: { avatar: picture }
        });
      }
      return done(null, { id: user._id, email: user.email, name: user.name, role: user.role });
    } catch (err) {
      return done(err, null);
    }
  }
));
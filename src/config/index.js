module.exports = {
    PORT: process.env.PORT || 3000,
    DATABASE_MG_URL: process.env.DATABASE_MG_URL,
    MIGRATE_MG_URL: process.env.MIGRATE_MG_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES,
    JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES,
    ENV: process.env.NODE_ENV || 'development',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    FE_REDIRECT_URL: process.env.FE_REDIRECT_URL,
};
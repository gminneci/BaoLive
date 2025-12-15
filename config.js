module.exports = {
    port: process.env.PORT || 3000,
    dataDir: process.env.DATA_DIR || '/data',
    sessionSecret: process.env.SESSION_SECRET || 'baolive-secret-change-in-production',
    adminPassword: process.env.ADMIN_PASSWORD,
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production'
};

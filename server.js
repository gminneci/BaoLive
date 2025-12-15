const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const config = require('./config');
const { initDatabase } = require('./database');
const BackupService = require('./services/backupService');

const app = express();
// Trust reverse proxy (e.g., Railway/Heroku) so secure cookies work in prod
app.set('trust proxy', 1);

// Security & Logging
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'"],
            "img-src": ["'self'", "data:", "https:"],
        },
    },
}));
// Minimal, privacy-friendly referrer policy
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));
app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));

// Middleware
app.use(cors());
app.use(express.json());

// Session setup with SQLite store
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: config.dataDir
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction,
        maxAge: 24 * 60 * 60 * 1000
    } // 24 hours
}));

// Initialize database
initDatabase();

// Initialize Services
const backupService = new BackupService(config.dataDir);
const DB_PATH = path.join(config.dataDir, 'camping.db');

// Schedule daily backup at 2 AM UTC
function scheduleDailyBackup() {
    const checkAndBackup = () => {
        const now = new Date();
        const hours = now.getUTCHours();
        const minutes = now.getUTCMinutes();

        // Run at 2:00 AM UTC (within the 2:00-2:01 window)
        if (hours === 2 && minutes === 0) {
            console.log('Running scheduled backup...');
            backupService.createBackup(DB_PATH)
                .then(result => console.log('✅ Scheduled backup created:', result.fileName))
                .catch(err => console.error('Scheduled backup failed:', err));

            // Clean up old backups
            backupService.cleanupOldBackups();
        }
    };

    // Check every minute
    setInterval(checkAndBackup, 60 * 1000);
    console.log('📅 Daily backup scheduled for 2:00 AM UTC');
}

scheduleDailyBackup();

// Protect /admin.html before static serving
app.use((req, res, next) => {
    if (req.path === '/admin.html') {
        if (req.session.isAdmin) return next();
        return res.redirect('/login.html');
    }
    next();
});

// Static files
app.use(express.static('public'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/families', require('./routes/families'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/activity-signups', require('./routes/signups'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/backups', require('./routes/backups'));
app.use('/api/export', require('./routes/export'));
app.use('/api/public', require('./routes/public'));
const { errorHandler } = require('./middleware/error');
app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Data Directory: ${config.dataDir}`);
    console.log(`Environment: ${config.isProduction ? 'production' : 'development'}`);
});
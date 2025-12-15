const express = require('express');
const router = express.Router();
const config = require('../config');

if (!config.adminPassword) {
    console.warn('WARNING: ADMIN_PASSWORD environment variable not set. Admin access will not work.');
}

router.post('/signin', (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password required' });
    }

    // Check password against environment variable
    if (!config.adminPassword || password !== config.adminPassword) {
        return res.status(403).json({ error: 'Invalid password' });
    }

    // Mark session as authenticated
    req.session.isAdmin = true;
    return res.json({ success: true });
});

router.get('/signout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

router.get('/session', (req, res) => {
    if (req.session.isAdmin) {
        return res.json({ authenticated: true });
    }
    return res.json({ authenticated: false });
});

module.exports = router;

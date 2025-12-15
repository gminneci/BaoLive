const express = require('express');
const router = express.Router();
const DataService = require('../services/dataService');
const { dbAll, dbRun } = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// Get activities
router.get('/', asyncHandler(async (req, res) => {
    const { access_key } = req.query;
    if (access_key) {
        // Use subquery to obtain relevant activities
        const rows = await dbAll(`
            SELECT DISTINCT a.* 
            FROM activities a
            LEFT JOIN families f ON f.access_key = ?
            LEFT JOIN activity_signups s ON s.activity_id = a.id AND s.family_id = f.id
            WHERE a.available = 1 OR s.id IS NOT NULL
            ORDER BY a.session_time
        `, [access_key]);
        res.json(rows);
    } else {
        const activities = await DataService.getActivities();
        res.json(activities);
    }
}));

// Admin activity routes
router.get('/all', asyncHandler(async (req, res) => {
    const rows = await DataService.getActivities(true);
    res.json(rows);
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
    const result = await DataService.createActivity(req.body);
    res.json({ success: true, id: result.id });
}));

router.put('/:id/availability', requireAdmin, asyncHandler(async (req, res) => {
    await dbRun('UPDATE activities SET available = ? WHERE id = ?', [req.body.available ? 1 : 0, req.params.id]);
    res.json({ success: true });
}));

router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
    await DataService.updateActivity(req.params.id, req.body);
    res.json({ success: true });
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
    const result = await DataService.deleteActivity(req.params.id);
    res.json({ success: true, deleted: result });
}));

module.exports = router;

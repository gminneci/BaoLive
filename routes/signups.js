const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { asyncHandler } = require('../middleware/error');

// Helper to check activity capacity
async function checkAndUpdateActivityCapacity(activityId) {
    try {
        const activity = await dbGet('SELECT max_participants FROM activities WHERE id = ?', [activityId]);
        if (!activity || activity.max_participants === 0) return;

        const result = await dbGet(`
            SELECT SUM(json_array_length(children)) as total_participants
            FROM activity_signups
            WHERE activity_id = ?
        `, [activityId]);

        const currentParticipants = result.total_participants || 0;

        if (currentParticipants >= activity.max_participants) {
            await dbRun('UPDATE activities SET available = 0 WHERE id = ?', [activityId]);
            console.log(`Activity ${activityId} auto-disabled: ${currentParticipants}/${activity.max_participants} participants`);
        } else {
            await dbRun('UPDATE activities SET available = 1 WHERE id = ?', [activityId]);
            console.log(`Activity ${activityId} auto-enabled: ${currentParticipants}/${activity.max_participants} participants`);
        }
    } catch (err) {
        console.error('Error checking capacity:', err);
    }
}

router.get('/', asyncHandler(async (req, res) => {
    const rows = await dbAll(`
        SELECT 
          acs.*,
          a.name as activity_name,
          a.session_time,
          a.cost,
          f.booking_ref,
          f.access_key
        FROM activity_signups acs
        JOIN activities a ON acs.activity_id = a.id
        JOIN families f ON acs.family_id = f.id
        ORDER BY a.session_time, acs.created_at
    `);

    const signups = rows.map(row => ({
        ...row,
        children: JSON.parse(row.children)
    }));
    res.json(signups);
}));

router.get('/family/:accessKey', asyncHandler(async (req, res) => {
    const rows = await dbAll(`
        SELECT 
          acs.*,
          a.name as activity_name,
          a.session_time,
          a.cost
        FROM activity_signups acs
        JOIN activities a ON acs.activity_id = a.id
        JOIN families f ON acs.family_id = f.id
        WHERE f.access_key = ?
        ORDER BY a.session_time
    `, [req.params.accessKey]);

    const signups = rows.map(row => ({
        ...row,
        children: JSON.parse(row.children)
    }));
    res.json(signups);
}));

router.post('/', asyncHandler(async (req, res) => {
    const { activity_id, access_key, children } = req.body;
    const family = await dbGet('SELECT id FROM families WHERE access_key = ?', [access_key]);
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const existing = await dbGet('SELECT id FROM activity_signups WHERE activity_id = ? AND family_id = ?', [activity_id, family.id]);

    if (existing) {
        if (!children || children.length === 0) {
            // Delete
            await dbRun('DELETE FROM activity_signups WHERE id = ?', [existing.id]);
            await checkAndUpdateActivityCapacity(activity_id);
            res.json({ success: true, deleted: true });
        } else {
            // Update
            await dbRun('UPDATE activity_signups SET children = ? WHERE id = ?', [JSON.stringify(children), existing.id]);
            await checkAndUpdateActivityCapacity(activity_id);
            res.json({ success: true, id: existing.id });
        }
    } else {
        if (!children || children.length === 0) return res.json({ success: true, skipped: true });

        // Create
        const result = await dbRun(
            `INSERT INTO activity_signups (activity_id, family_id, children) VALUES (?, ?, ?)`,
            [activity_id, family.id, JSON.stringify(children)]
        );
        await checkAndUpdateActivityCapacity(activity_id);
        res.json({ success: true, id: result.lastID });
    }
}));

module.exports = router;

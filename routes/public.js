const express = require('express');
const router = express.Router();
const { dbAll } = require('../database');
const { asyncHandler } = require('../middleware/error');

// Public endpoint to see who is doing what
router.get('/participants', asyncHandler(async (req, res) => {
    // Get all activities
    const activities = await dbAll('SELECT * FROM activities WHERE available = 1 ORDER BY session_time, name');

    // Get all signups
    const signups = await dbAll(`
        SELECT 
            activity_id,
            children as participants
        FROM activity_signups
    `);

    // Combine them
    const results = activities.map(activity => {
        const activitySignups = signups.filter(s => s.activity_id === activity.id);
        // Flatten all participant arrays into one list
        const allParticipants = activitySignups.reduce((all, s) => {
            const names = JSON.parse(s.participants);
            return all.concat(names);
        }, []);

        return {
            id: activity.id,
            name: activity.name,
            session_time: activity.session_time,
            description: activity.description,
            max_participants: activity.max_participants,
            participants: allParticipants.sort()
        };
    });

    res.json(results);
}));

module.exports = router;

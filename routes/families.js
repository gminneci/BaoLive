const express = require('express');
const router = express.Router();
const DataService = require('../services/dataService');
const { dbGet, db } = require('../database');
const { asyncHandler } = require('../middleware/error');

// Get all families (admin)
router.get('/', asyncHandler(async (req, res) => {
    const families = await DataService.getFamiliesWithFinancials();
    res.json(families);
}));

// Get family by access key
router.get('/access/:accessKey', asyncHandler(async (req, res) => {
    const families = await DataService.getFamiliesWithFinancials('access_key', req.params.accessKey);
    if (families.length === 0) {
        return res.status(404).json({ error: 'Family not found' });
    }
    res.json(families[0]);
}));

// Get family by booking reference
router.get('/booking/:bookingRef', asyncHandler(async (req, res) => {
    const families = await DataService.getFamiliesWithFinancials('booking_ref', req.params.bookingRef);
    if (families.length === 0) {
        return res.status(404).json({ error: 'Family not found' });
    }
    res.json(families[0]);
}));

// Check if booking reference exists
router.get('/check/:bookingRef', asyncHandler(async (req, res) => {
    const row = await dbGet('SELECT id FROM families WHERE booking_ref = ?', [req.params.bookingRef]);
    res.json({ exists: !!row });
}));

// Create or update family
router.post('/', asyncHandler(async (req, res) => {
    const { booking_ref, members, camping_type, nights } = req.body;
    const exists = await dbGet('SELECT id FROM families WHERE booking_ref = ?', [booking_ref]);

    if (exists) {
        await DataService.updateFamily(exists.id, req.body);
        const { dbRun } = require('../database');
        await dbRun('DELETE FROM family_members WHERE family_id = ?', [exists.id]);

        // Insert Members
        const stmt = db.prepare(`
            INSERT INTO family_members (family_id, name, is_child, class)
            VALUES (?, ?, ?, ?)
        `);

        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                members.forEach(member => {
                    stmt.run(
                        exists.id,
                        member.name,
                        member.is_child ? 1 : 0,
                        member.class || null
                    );
                });
                stmt.finalize();
                db.run("COMMIT", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        // Return access_key (parity with old API behavior)
        const row = await dbGet('SELECT access_key FROM families WHERE id = ?', [exists.id]);
        res.json({ success: true, family_id: exists.id, access_key: row ? row.access_key : undefined });

    } else {
        const result = await DataService.createFamily(req.body);
        const stmt = db.prepare(`
            INSERT INTO family_members (family_id, name, is_child, class)
            VALUES (?, ?, ?, ?)
        `);

        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                members.forEach(member => {
                    stmt.run(
                        result.id,
                        member.name,
                        member.is_child ? 1 : 0,
                        member.class || null
                    );
                });
                stmt.finalize();
                db.run("COMMIT", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
        res.json({ success: true, family_id: result.id, access_key: result.access_key });
    }
}));

// Delete family (admin)
router.delete('/:id', asyncHandler(async (req, res) => {
    await DataService.deleteFamily(req.params.id);
    res.json({ success: true });
}));

module.exports = router;

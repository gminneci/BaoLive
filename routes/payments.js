const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

router.get('/family/:accessKey', asyncHandler(async (req, res) => {
    const family = await dbGet('SELECT id FROM families WHERE access_key = ?', [req.params.accessKey]);
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const payments = await dbAll('SELECT * FROM payments WHERE family_id = ? ORDER BY payment_date DESC', [family.id]);
    res.json(payments);
}));

router.get('/', requireAdmin, asyncHandler(async (req, res) => {
    const payments = await dbAll(`
        SELECT p.*, f.booking_ref
        FROM payments p
        JOIN families f ON p.family_id = f.id
        ORDER BY p.payment_date DESC
    `);
    res.json(payments);
}));

router.post('/', asyncHandler(async (req, res) => {
    const { access_key, amount, notes } = req.body;
    if (!access_key || amount === undefined) {
        return res.status(400).json({ error: 'access_key and amount required' });
    }

    const family = await dbGet('SELECT id FROM families WHERE access_key = ?', [access_key]);
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const result = await dbRun(
        'INSERT INTO payments (family_id, amount, notes) VALUES (?, ?, ?)',
        [family.id, amount, notes || null]
    );
    res.json({ success: true, id: result.lastID });
}));

// Admin payment overrides
router.post('/:id/void', requireAdmin, asyncHandler(async (req, res) => {
    await dbRun('UPDATE payments SET cancelled = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

router.post('/:id/reinstate', requireAdmin, asyncHandler(async (req, res) => {
    await dbRun('UPDATE payments SET cancelled = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
    await dbRun('DELETE FROM payments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
    const { payment_date, amount, notes } = req.body;
    await dbRun(
        'UPDATE payments SET payment_date = ?, amount = ?, notes = ? WHERE id = ?',
        [payment_date, amount, notes || null, req.params.id]
    );
    res.json({ success: true });
}));

module.exports = router;

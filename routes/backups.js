const express = require('express');
const router = express.Router();
const BackupService = require('../services/backupService');
const { DATA_DIR } = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const backupService = new BackupService(DATA_DIR);

// List all backups (admin only)
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
    const backups = backupService.listBackups();
    res.json(backups);
}));

// Create a backup manually (admin only)
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
    const result = await backupService.createBackup(require('path').join(DATA_DIR, 'camping.db'));
    res.json(result);
}));

// Download a backup (admin only)
router.get('/:fileName', requireAdmin, asyncHandler(async (req, res) => {
    const { fileName } = req.params;
    const backupPath = backupService.getBackupPath(fileName);

    // Ensure file exists and is within backup directory (getBackupPath handles minimal check but let's be safe)
    if (!require('fs').existsSync(backupPath)) {
        return res.status(404).json({ error: 'Backup not found' });
    }

    res.download(backupPath, fileName);
}));

// Delete a backup (admin only)
router.delete('/:fileName', requireAdmin, asyncHandler(async (req, res) => {
    const { fileName } = req.params;
    const success = backupService.deleteBackup(fileName);

    if (success) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Backup not found' });
    }
}));

module.exports = router;

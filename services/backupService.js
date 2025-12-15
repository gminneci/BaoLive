const fs = require('fs');
const path = require('path');
const { dbRun } = require('../database');

class BackupService {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.backupDir = dataDir;

        // Ensure backup directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    // Create a backup of the database
    async createBackup(dbPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupName = `camping_${timestamp}.db`;
        const backupPath = path.join(this.backupDir, backupName);

        // Use SQLite's online backup API if possible, or just copy the file
        // For simplicity with sqlite3/connect-sqlite3, we'll use file copy 
        // but ensuring the DB is in a safe state would be better with VACUUM INTO
        // However, standard file copy is usually fine for WAL mode or low traffic

        // Better approach for SQLite: use the VACUUM INTO command
        try {
            await dbRun(`VACUUM INTO ?`, [backupPath]);
            return {
                success: true,
                fileName: backupName,
                path: backupPath,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Backup failed:', error);
            // Fallback to file copy if VACUUM INTO fails (e.g. older sqlite versions)
            try {
                fs.copyFileSync(dbPath, backupPath);
                return {
                    success: true,
                    fileName: backupName,
                    path: backupPath,
                    timestamp: new Date()
                };
            } catch (copyError) {
                console.error('Backup fallback failed:', copyError);
                throw copyError;
            }
        }
    }

    // List all backups
    listBackups() {
        if (!fs.existsSync(this.backupDir)) return [];

        const files = fs.readdirSync(this.backupDir)
            .filter(file => file.startsWith('camping_') && file.endsWith('.db'));

        return files.map(file => {
            const filePath = path.join(this.backupDir, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime,
                path: filePath
            };
        }).sort((a, b) => b.created - a.created);
    }

    // Get a specific backup file path
    getBackupPath(filename) {
        // Prevent directory traversal
        const safeFilename = path.basename(filename);
        return path.join(this.backupDir, safeFilename);
    }

    // Delete a backup
    deleteBackup(filename) {
        const filePath = this.getBackupPath(filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    }

    // Keep only recent backups
    cleanupOldBackups(retentionDays = 7) {
        const backups = this.listBackups();
        const now = new Date();
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

        let deletedCount = 0;
        backups.forEach(backup => {
            if (now - backup.created > retentionMs) {
                this.deleteBackup(backup.name);
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            console.log(`Cleaned up ${deletedCount} old backups`);
        }
    }
}

module.exports = BackupService;

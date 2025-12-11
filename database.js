const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'camping.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
function initDatabase() {
  db.serialize(() => {
    // Families table
    db.run(`
      CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_ref TEXT UNIQUE NOT NULL,
        access_key TEXT NOT NULL,
        camping_type TEXT NOT NULL,
        nights TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Family members table
    db.run(`
      CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        is_child INTEGER NOT NULL,
        in_sefton_park INTEGER DEFAULT 0,
        year TEXT,
        class TEXT,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
      )
    `);

    // Activities table
    db.run(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        session_time TEXT,
        cost REAL DEFAULT 0,
        description TEXT,
        max_participants INTEGER DEFAULT 0,
        available INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add max_participants column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE activities ADD COLUMN max_participants INTEGER DEFAULT 0`, (err) => {
      // Ignore error if column already exists
    });

    // Activity signups table
    db.run(`
      CREATE TABLE IF NOT EXISTS activity_signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL,
        family_id INTEGER NOT NULL,
        children TEXT NOT NULL,
        paid INTEGER DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
      )
    `);

    // Insert sample activity (only Tobogganing)
    db.run(`
      INSERT OR IGNORE INTO activities (id, name, session_time, cost, description, available)
      VALUES 
        (1, 'Tobogganing', 'Saturday 10:00 AM', 5.00, 'Fun tobogganing session on the slopes', 1)
    `);

    console.log('Database initialized successfully');
  });
}

module.exports = { db, initDatabase };

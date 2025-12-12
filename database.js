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

    // Family members table - Simplified Schema
    db.run(`
      CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        is_child INTEGER NOT NULL,
        class TEXT, -- Only for children: Baobab, Olive, or Other
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
        allowed_ages TEXT DEFAULT 'both', -- 'child', 'adult', 'both'
        available INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (!err) {
        // Migration: Check if allowed_ages column exists, if not add it
        db.all("PRAGMA table_info(activities)", (err, columns) => {
          if (!err) {
            const hasColumn = columns.some(c => c.name === 'allowed_ages');
            if (!hasColumn) {
              console.log("Migrating: Adding allowed_ages column to activities");
              db.run("ALTER TABLE activities ADD COLUMN allowed_ages TEXT DEFAULT 'both'");
            }
          }
        });
      }
    });

    // Activity signups table
    db.run(`
      CREATE TABLE IF NOT EXISTS activity_signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL,
        family_id INTEGER NOT NULL,
        children TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
      )
    `);

    // Payments table
    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        cancelled INTEGER DEFAULT 0,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
      )
    `);

    // Insert sample activities if empty
    db.get('SELECT count(*) as count FROM activities', (err, row) => {
      if (!err && row.count === 0) {
        db.run(`
              INSERT INTO activities (name, session_time, cost, description, available)
              VALUES 
                ('Tobogganing', 'Saturday 10:00 AM', 5.00, 'Fun tobogganing session on the slopes', 1),
                ('Archery', 'Saturday 2:00 PM', 8.00, 'Learn to shoot arrows like a pro', 1),
                ('Nature Walk', 'Friday 4:00 PM', 0.00, 'Guided walk through the woods', 1),
                ('Campfire Stories', 'Friday 7:00 PM', 0.00, 'Stories and marshmallows by the fire', 1)
            `);
      }
    });

    console.log('Database initialized successfully');
  });
}

module.exports = { db, initDatabase };

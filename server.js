const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Admin password from environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
    console.warn('WARNING: ADMIN_PASSWORD environment variable not set. Admin access will not work.');
}

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'baolive-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Protect /admin.html before static serving
app.use((req, res, next) => {
    if (req.path === '/admin.html') {
        if (req.session.isAdmin) return next();
        return res.redirect('/login.html');
    }
    next();
});

// Static files
app.use(express.static('public'));

// Auth routes
app.post('/api/auth/signin', (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password required' });
    }
    
    // Check password against environment variable
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Invalid password' });
    }
    
    // Mark session as authenticated
    req.session.isAdmin = true;
    return res.json({ success: true });
});

app.get('/api/auth/signout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/api/auth/session', (req, res) => {
    if (req.session.isAdmin) {
        return res.json({ authenticated: true });
    }
    return res.json({ authenticated: false });
});

// Initialize database
initDatabase();

// Helper function to generate access key from child names
function generateAccessKey(childNames) {
    return childNames.map(name => name.toLowerCase().trim()).sort().join('-');
}

// Helper function for family query with members (reusable)
const FAMILY_QUERY = `
    SELECT f.*, 
           GROUP_CONCAT(
             json_object(
               'id', fm.id,
               'name', fm.name,
               'is_child', fm.is_child,
               'in_sefton_park', fm.in_sefton_park,
               'year', fm.year,
               'class', fm.class
             )
           ) as members
    FROM families f
    LEFT JOIN family_members fm ON f.id = fm.family_id`;

function transformFamilyRow(row) {
    return {
        ...row,
        nights: JSON.parse(row.nights),
        members: row.members ? JSON.parse(`[${row.members}]`) : []
    };
}

// Helper function to check activity capacity and auto-disable if full
function checkAndUpdateActivityCapacity(activityId) {
    // Get activity details
    db.get('SELECT max_participants FROM activities WHERE id = ?', [activityId], (err, activity) => {
        if (err || !activity || activity.max_participants === 0) {
            return; // No capacity limit or error
        }

        // Count current participants
        const query = `
            SELECT SUM(json_array_length(children)) as total_participants
            FROM activity_signups
            WHERE activity_id = ?
        `;

        db.get(query, [activityId], (err, result) => {
            if (err) return;

            const currentParticipants = result.total_participants || 0;

            // Auto-disable if at or over capacity
            if (currentParticipants >= activity.max_participants) {
                db.run('UPDATE activities SET available = 0 WHERE id = ?', [activityId], (err) => {
                    if (!err) {
                        console.log(`Activity ${activityId} auto-disabled: ${currentParticipants}/${activity.max_participants} participants`);
                    }
                });
            } else {
                // Re-enable if was full but now has space (e.g., someone cancelled)
                db.run('UPDATE activities SET available = 1 WHERE id = ?', [activityId], (err) => {
                    if (!err) {
                        console.log(`Activity ${activityId} auto-enabled: ${currentParticipants}/${activity.max_participants} participants`);
                    }
                });
            }
        });
    });
}

// API Routes

// Get all families (admin)
app.get('/api/families', (req, res) => {
    const query = `${FAMILY_QUERY}
    GROUP BY f.id
    ORDER BY f.created_at DESC`;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows.map(transformFamilyRow));
    });
});

// Get family by access key
app.get('/api/families/access/:accessKey', (req, res) => {
    const { accessKey } = req.params;
    const query = `${FAMILY_QUERY}
    WHERE f.access_key = ?
    GROUP BY f.id`;

    db.get(query, [accessKey], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Family not found' });
        }
        res.json(transformFamilyRow(row));
    });
});

// Get family by booking reference
app.get('/api/families/booking/:bookingRef', (req, res) => {
    const { bookingRef } = req.params;
    const query = `${FAMILY_QUERY}
    WHERE f.booking_ref = ?
    GROUP BY f.id`;

    db.get(query, [bookingRef], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Family not found' });
        }
        res.json(transformFamilyRow(row));
    });
});

// Check if booking reference exists
app.get('/api/families/check/:bookingRef', (req, res) => {
    const { bookingRef } = req.params;
    db.get('SELECT id, booking_ref FROM families WHERE booking_ref = ?', [bookingRef], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ exists: !!row });
    });
});

// Create or update family
app.post('/api/families', (req, res) => {
    const { booking_ref, members, camping_type, nights } = req.body;

    // Generate access key from child names
    const childNames = members.filter(m => m.is_child).map(m => m.name);
    const access_key = generateAccessKey(childNames);

    // Check if family already exists
    db.get('SELECT id FROM families WHERE booking_ref = ?', [booking_ref], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (existing) {
            // Update existing family
            db.run(
                `UPDATE families SET camping_type = ?, nights = ?, access_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [camping_type, JSON.stringify(nights), access_key, existing.id],
                function (err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    // Delete old members and insert new ones
                    db.run('DELETE FROM family_members WHERE family_id = ?', [existing.id], (err) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }

                        insertMembers(existing.id, members, res, access_key);
                    });
                }
            );
        } else {
            // Create new family
            db.run(
                `INSERT INTO families (booking_ref, access_key, camping_type, nights) VALUES (?, ?, ?, ?)`,
                [booking_ref, access_key, camping_type, JSON.stringify(nights)],
                function (err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    insertMembers(this.lastID, members, res, access_key);
                }
            );
        }
    });
});

function insertMembers(familyId, members, res, access_key) {
    const stmt = db.prepare(`
    INSERT INTO family_members (family_id, name, is_child, in_sefton_park, year, class)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    members.forEach(member => {
        stmt.run(
            familyId,
            member.name,
            member.is_child ? 1 : 0,
            member.in_sefton_park ? 1 : 0,
            member.year || null,
            member.class || null
        );
    });

    stmt.finalize((err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, family_id: familyId, access_key });
    });
}

// Delete family (admin)
app.delete('/api/families/:id', (req, res) => {
    const { id } = req.params;

    // Delete family members first (cascade should handle this, but being explicit)
    db.run('DELETE FROM family_members WHERE family_id = ?', [id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Delete activity signups
        db.run('DELETE FROM activity_signups WHERE family_id = ?', [id], (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Delete the family
            db.run('DELETE FROM families WHERE id = ?', [id], function (err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, deleted: this.changes });
            });
        });
    });
});

// Get activities (for parents - only available ones)
app.get('/api/activities', (req, res) => {
    db.all('SELECT * FROM activities WHERE available = 1 ORDER BY session_time', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get all activities including unavailable (admin only)
app.get('/api/activities/all', (req, res) => {
    db.all('SELECT * FROM activities ORDER BY session_time', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Create activity (admin)
const requireAdmin = (req, res, next) => {
    if (req.session.isAdmin) return next();
    return res.status(401).json({ error: 'Unauthorized' });
};

app.post('/api/activities', requireAdmin, (req, res) => {
    const { name, session_time, cost, description, max_participants, available } = req.body;

    db.run(
        `INSERT INTO activities (name, session_time, cost, description, max_participants, available) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, session_time, cost || 0, description || '', max_participants || 0, available !== undefined ? available : 1],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Toggle activity availability (admin)
app.put('/api/activities/:id/availability', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { available } = req.body;

    db.run(
        'UPDATE activities SET available = ? WHERE id = ?',
        [available ? 1 : 0, id],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

// Update activity details (admin)
app.put('/api/activities/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, session_time, cost, description, max_participants } = req.body;

    db.run(
        'UPDATE activities SET name = ?, session_time = ?, cost = ?, description = ?, max_participants = ? WHERE id = ?',
        [name, session_time, cost || 0, description || '', max_participants || 0, id],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

// Delete activity (admin)
app.delete('/api/activities/:id', requireAdmin, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM activities WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, deleted: this.changes });
    });
});

// Get all activity signups (admin)
app.get('/api/activity-signups', (req, res) => {
    const query = `
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
  `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const signups = rows.map(row => ({
            ...row,
            children: JSON.parse(row.children)
        }));

        res.json(signups);
    });
});

// Get activity signups for a family
app.get('/api/activity-signups/family/:accessKey', (req, res) => {
    const { accessKey } = req.params;

    const query = `
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
  `;

    db.all(query, [accessKey], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const signups = rows.map(row => ({
            ...row,
            children: JSON.parse(row.children)
        }));

        res.json(signups);
    });
});

// Sign up for activity
app.post('/api/activity-signups', (req, res) => {
    const { activity_id, access_key, children } = req.body;

    // Get family ID from access key
    db.get('SELECT id FROM families WHERE access_key = ?', [access_key], (err, family) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!family) {
            return res.status(404).json({ error: 'Family not found' });
        }

        // Check if already signed up
        db.get(
            'SELECT id FROM activity_signups WHERE activity_id = ? AND family_id = ?',
            [activity_id, family.id],
            (err, existing) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                if (existing) {
                    // Update existing signup
                    db.run(
                        'UPDATE activity_signups SET children = ? WHERE id = ?',
                        [JSON.stringify(children), existing.id],
                        function (err) {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }
                            // Check capacity and auto-disable if full
                            checkAndUpdateActivityCapacity(activity_id);
                            res.json({ success: true, id: existing.id });
                        }
                    );
                } else {
                    // Create new signup
                    db.run(
                        `INSERT INTO activity_signups (activity_id, family_id, children) VALUES (?, ?, ?)`,
                        [activity_id, family.id, JSON.stringify(children)],
                        function (err) {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }
                            // Check capacity and auto-disable if full
                            checkAndUpdateActivityCapacity(activity_id);
                            res.json({ success: true, id: this.lastID });
                        }
                    );
                }
            }
        );
    });
});

// Update payment status
app.put('/api/activity-signups/:id/payment', (req, res) => {
    const { id } = req.params;
    const { paid, amount_paid } = req.body;

    db.run(
        'UPDATE activity_signups SET paid = ?, amount_paid = ? WHERE id = ?',
        [paid ? 1 : 0, amount_paid || 0, id],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

// Export families to CSV format
app.get('/api/export/families', (req, res) => {
    const query = `
    SELECT 
      f.booking_ref,
      f.camping_type,
      f.nights,
      fm.name,
      CASE WHEN fm.is_child = 1 THEN 'Child' ELSE 'Adult' END as person_type,
      CASE WHEN fm.in_sefton_park = 1 THEN 'Yes' ELSE 'No' END as in_sefton_park,
      fm.year,
      fm.class
    FROM families f
    LEFT JOIN family_members fm ON f.id = fm.family_id
    ORDER BY f.booking_ref, fm.is_child DESC, fm.name
  `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const csvRows = rows.map(row => ({
            ...row,
            nights: JSON.parse(row.nights).join(', ')
        }));

        res.json(csvRows);
    });
});

// Export activity signups to CSV format
app.get('/api/export/activities', (req, res) => {
    const query = `
    SELECT 
      a.name as activity_name,
      a.session_time,
      a.cost,
      f.booking_ref,
      acs.children,
      CASE WHEN acs.paid = 1 THEN 'Yes' ELSE 'No' END as paid,
      acs.amount_paid
    FROM activity_signups acs
    JOIN activities a ON acs.activity_id = a.id
    JOIN families f ON acs.family_id = f.id
    ORDER BY a.session_time, f.booking_ref
  `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const csvRows = rows.map(row => ({
            ...row,
            children: JSON.parse(row.children).join(', ')
        }));

        res.json(csvRows);
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

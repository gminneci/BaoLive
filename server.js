const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
initDatabase();

// Helper function to generate access key from child names
function generateAccessKey(childNames) {
    return childNames.map(name => name.toLowerCase().trim()).sort().join('-');
}

// API Routes

// Get all families (admin)
app.get('/api/families', (req, res) => {
    const query = `
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
    LEFT JOIN family_members fm ON f.id = fm.family_id
    GROUP BY f.id
    ORDER BY f.created_at DESC
  `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const families = rows.map(row => ({
            ...row,
            nights: JSON.parse(row.nights),
            members: row.members ? JSON.parse(`[${row.members}]`) : []
        }));

        res.json(families);
    });
});

// Get family by access key
app.get('/api/families/access/:accessKey', (req, res) => {
    const { accessKey } = req.params;

    const query = `
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
    LEFT JOIN family_members fm ON f.id = fm.family_id
    WHERE f.access_key = ?
    GROUP BY f.id
  `;

    db.get(query, [accessKey], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Family not found' });
        }

        const family = {
            ...row,
            nights: JSON.parse(row.nights),
            members: row.members ? JSON.parse(`[${row.members}]`) : []
        };

        res.json(family);
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
app.post('/api/activities', (req, res) => {
    const { name, session_time, cost, description, available } = req.body;

    db.run(
        `INSERT INTO activities (name, session_time, cost, description, available) VALUES (?, ?, ?, ?, ?)`,
        [name, session_time, cost || 0, description || '', available !== undefined ? available : 1],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Toggle activity availability (admin)
app.put('/api/activities/:id/availability', (req, res) => {
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
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

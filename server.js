const express = require('express');
const cors = require('cors');
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

// DB Promisify Helpers
const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

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

// --- HELPERS ---

function generateAccessKey(childNames) {
    return childNames.map(name => name.toLowerCase().trim()).sort().join('-');
}

function transformFamilyRow(row) {
    return {
        ...row,
        nights: JSON.parse(row.nights),
        members: row.members ? JSON.parse(`[${row.members}]`) : []
    };
}

// Unified helper to get family with financials
// Can filter by 'id', 'access_key', or 'booking_ref'
async function getFamiliesWithFinancials(filterType = null, filterValue = null) {
    let whereClause = '';
    const params = [];

    if (filterType && filterValue) {
        if (filterType === 'id') whereClause = 'WHERE f.id = ?';
        else if (filterType === 'access_key') whereClause = 'WHERE f.access_key = ?';
        else if (filterType === 'booking_ref') whereClause = 'WHERE f.booking_ref = ?';

        params.push(filterValue);
    }

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
        ${whereClause}
        GROUP BY f.id
        ORDER BY f.created_at DESC
    `;

    const rows = await dbAll(query, params);
    if (!rows || rows.length === 0) return [];

    const families = rows.map(transformFamilyRow);

    // Populate financials for each family
    // Note: We could do this in a single complex SQL query, but for simplicity/maintainability (SQLite),
    // we'll fetch totals in parallel.
    for (const family of families) {
        // Total Owed
        const owedRow = await dbGet(`
            SELECT COALESCE(SUM(a.cost * json_array_length(acs.children)), 0) as total_owed
            FROM activity_signups acs
            JOIN activities a ON acs.activity_id = a.id
            WHERE acs.family_id = ?
        `, [family.id]);

        family.total_owed = owedRow ? owedRow.total_owed : 0;

        // Total Paid
        const paidRow = await dbGet(`
            SELECT COALESCE(SUM(amount), 0) as total_paid
            FROM payments
            WHERE family_id = ? AND cancelled = 0
        `, [family.id]);

        family.total_paid = paidRow ? paidRow.total_paid : 0;
        family.outstanding = family.total_owed - family.total_paid;
    }

    return families;
}

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


// --- API ROUTES ---

// Get all families (admin)
app.get('/api/families', async (req, res) => {
    try {
        const families = await getFamiliesWithFinancials();
        res.json(families);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get family by access key
app.get('/api/families/access/:accessKey', async (req, res) => {
    try {
        const families = await getFamiliesWithFinancials('access_key', req.params.accessKey);
        if (families.length === 0) {
            return res.status(404).json({ error: 'Family not found' });
        }
        res.json(families[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get family by booking reference
app.get('/api/families/booking/:bookingRef', async (req, res) => {
    try {
        const families = await getFamiliesWithFinancials('booking_ref', req.params.bookingRef);
        if (families.length === 0) {
            return res.status(404).json({ error: 'Family not found' });
        }
        res.json(families[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check if booking reference exists
app.get('/api/families/check/:bookingRef', async (req, res) => {
    try {
        const row = await dbGet('SELECT id FROM families WHERE booking_ref = ?', [req.params.bookingRef]);
        res.json({ exists: !!row });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create or update family
app.post('/api/families', async (req, res) => {
    const { booking_ref, members, camping_type, nights } = req.body;

    try {
        const childNames = members.filter(m => m.is_child).map(m => m.name);
        const access_key = generateAccessKey(childNames);
        const existing = await dbGet('SELECT id FROM families WHERE booking_ref = ?', [booking_ref]);

        let familyId;
        if (existing) {
            // Update existing
            await dbRun(
                `UPDATE families SET camping_type = ?, nights = ?, access_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [camping_type, JSON.stringify(nights), access_key, existing.id]
            );

            // Re-insert members
            await dbRun('DELETE FROM family_members WHERE family_id = ?', [existing.id]);
            familyId = existing.id;
        } else {
            // Create new
            const result = await dbRun(
                `INSERT INTO families (booking_ref, access_key, camping_type, nights) VALUES (?, ?, ?, ?)`,
                [booking_ref, access_key, camping_type, JSON.stringify(nights)]
            );
            familyId = result.lastID;
        }

        // Insert Members
        // Note: Prepared statements for multiple inserts
        const stmt = db.prepare(`
            INSERT INTO family_members (family_id, name, is_child, in_sefton_park, year, class)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        // We wrap bulk insert in a promise manually as statement execution is synchronous-like in loop but finalized async
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
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
                stmt.finalize();
                db.run("COMMIT", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        res.json({ success: true, family_id: familyId, access_key });

    } catch (err) {
        await dbRun("ROLLBACK"); // Attempt rollback if error
        res.status(500).json({ error: err.message });
    }
});

// Delete family (admin)
app.delete('/api/families/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM family_members WHERE family_id = ?', [req.params.id]);
        await dbRun('DELETE FROM activity_signups WHERE family_id = ?', [req.params.id]);
        await dbRun('DELETE FROM payments WHERE family_id = ?', [req.params.id]); // Also delete payments
        const result = await dbRun('DELETE FROM families WHERE id = ?', [req.params.id]);

        res.json({ success: true, deleted: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get activities
app.get('/api/activities', async (req, res) => {
    const { access_key } = req.query;
    try {
        if (access_key) {
            // Use subquery to avoid complex outer joins if possible, but this is fine
            // We want available activities, OR activities this family is already signed up for (even if unavailable)
            const rows = await dbAll(`
                SELECT DISTINCT a.* 
                FROM activities a
                LEFT JOIN families f ON f.access_key = ?
                LEFT JOIN activity_signups s ON s.activity_id = a.id AND s.family_id = f.id
                WHERE a.available = 1 OR s.id IS NOT NULL
                ORDER BY a.session_time
            `, [access_key]);
            res.json(rows);
        } else {
            const rows = await dbAll('SELECT * FROM activities WHERE available = 1 ORDER BY session_time');
            res.json(rows);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin activity routes
const requireAdmin = (req, res, next) => {
    if (req.session.isAdmin) return next();
    return res.status(401).json({ error: 'Unauthorized' });
};

app.get('/api/activities/all', async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM activities ORDER BY session_time');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/activities', requireAdmin, async (req, res) => {
    const { name, session_time, cost, description, max_participants, available } = req.body;
    try {
        const result = await dbRun(
            `INSERT INTO activities (name, session_time, cost, description, max_participants, available) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, session_time, cost || 0, description || '', max_participants || 0, available !== undefined ? available : 1]
        );
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/activities/:id/availability', requireAdmin, async (req, res) => {
    try {
        await dbRun('UPDATE activities SET available = ? WHERE id = ?', [req.body.available ? 1 : 0, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/activities/:id', requireAdmin, async (req, res) => {
    const { name, session_time, cost, description, max_participants } = req.body;
    try {
        await dbRun(
            'UPDATE activities SET name = ?, session_time = ?, cost = ?, description = ?, max_participants = ? WHERE id = ?',
            [name, session_time, cost || 0, description || '', max_participants || 0, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/activities/:id', requireAdmin, async (req, res) => {
    try {
        const result = await dbRun('DELETE FROM activities WHERE id = ?', [req.params.id]);
        res.json({ success: true, deleted: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Activity Signups
app.get('/api/activity-signups', async (req, res) => {
    try {
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/activity-signups/family/:accessKey', async (req, res) => {
    try {
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/activity-signups', async (req, res) => {
    const { activity_id, access_key, children } = req.body;
    try {
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Payments
app.get('/api/payments/family/:accessKey', async (req, res) => {
    try {
        const family = await dbGet('SELECT id FROM families WHERE access_key = ?', [req.params.accessKey]);
        if (!family) return res.status(404).json({ error: 'Family not found' });

        const payments = await dbAll('SELECT * FROM payments WHERE family_id = ? ORDER BY payment_date DESC', [family.id]);
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/payments', requireAdmin, async (req, res) => {
    try {
        const payments = await dbAll(`
            SELECT p.*, f.booking_ref
            FROM payments p
            JOIN families f ON p.family_id = f.id
            ORDER BY p.payment_date DESC
        `);
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/payments', async (req, res) => {
    const { access_key, amount, notes } = req.body;
    if (!access_key || amount === undefined) {
        return res.status(400).json({ error: 'access_key and amount required' });
    }

    try {
        const family = await dbGet('SELECT id FROM families WHERE access_key = ?', [access_key]);
        if (!family) return res.status(404).json({ error: 'Family not found' });

        const result = await dbRun(
            'INSERT INTO payments (family_id, amount, notes) VALUES (?, ?, ?)',
            [family.id, amount, notes || null]
        );
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin payment overrides
app.post('/api/payments/:id/void', requireAdmin, async (req, res) => {
    try {
        await dbRun('UPDATE payments SET cancelled = 1 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/payments/:id/reinstate', requireAdmin, async (req, res) => {
    try {
        await dbRun('UPDATE payments SET cancelled = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/payments/:id', requireAdmin, async (req, res) => {
    try {
        await dbRun('DELETE FROM payments WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/payments/:id', requireAdmin, async (req, res) => {
    const { payment_date, amount, notes } = req.body;
    try {
        await dbRun(
            'UPDATE payments SET payment_date = ?, amount = ?, notes = ? WHERE id = ?',
            [payment_date, amount, notes || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export
app.get('/api/export/families', async (req, res) => {
    try {
        const rows = await dbAll(`
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
        `);

        const csvRows = rows.map(row => ({
            ...row,
            nights: JSON.parse(row.nights).join(', ')
        }));
        res.json(csvRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

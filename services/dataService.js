const { dbGet, dbAll, dbRun } = require('../database');
const crypto = require('crypto');

class DataService {
    // Families
    static async getFamiliesWithFinancials(filterType = null, filterValue = null) {
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

        const families = rows.map(row => ({
            ...row,
            nights: JSON.parse(row.nights),
            members: row.members ? JSON.parse(`[${row.members}]`) : []
        }));

        // Populate financials for each family
        for (const family of families) {
            const owedRow = await dbGet(`
                SELECT COALESCE(SUM(a.cost * json_array_length(acs.children)), 0) as total_owed
                FROM activity_signups acs
                JOIN activities a ON acs.activity_id = a.id
                WHERE acs.family_id = ?
            `, [family.id]);

            family.total_owed = owedRow ? owedRow.total_owed : 0;

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

    static async createFamily(familyData) {
        const { booking_ref, camping_type, nights } = familyData;
        const access_key = crypto.randomBytes(16).toString('hex');

        const result = await dbRun(
            'INSERT INTO families (booking_ref, camping_type, nights, access_key) VALUES (?, ?, ?, ?)',
            [booking_ref, camping_type, JSON.stringify(nights), access_key]
        );

        return { id: result.lastID, access_key };
    }

    static async updateFamily(id, familyData) {
        const { booking_ref, camping_type, nights } = familyData;

        await dbRun(
            'UPDATE families SET booking_ref = ?, camping_type = ?, nights = ? WHERE id = ?',
            [booking_ref, camping_type, JSON.stringify(nights), id]
        );

        return { id };
    }

    static async deleteFamily(id) {
        await dbRun('DELETE FROM family_members WHERE family_id = ?', [id]);
        await dbRun('DELETE FROM activity_signups WHERE family_id = ?', [id]);
        await dbRun('DELETE FROM payments WHERE family_id = ?', [id]);
        await dbRun('DELETE FROM families WHERE id = ?', [id]);
        return true;
    }

    // Activities
    static async getActivities(includeUnavailable = false) {
        let sql = 'SELECT * FROM activities';
        if (!includeUnavailable) {
            sql += ' WHERE available = 1';
        }
        sql += ' ORDER BY session_time';
        return await dbAll(sql);
    }

    static async createActivity(activityData) {
        const { name, session_time, cost, description, max_participants, allowed_ages } = activityData;
        const result = await dbRun(
            'INSERT INTO activities (name, session_time, cost, description, max_participants, allowed_ages) VALUES (?, ?, ?, ?, ?, ?)',
            [name, session_time, cost, description, max_participants, allowed_ages]
        );
        return { id: result.lastID };
    }

    static async updateActivity(id, activityData) {
        const fields = [];
        const values = [];

        Object.keys(activityData).forEach(key => {
            fields.push(`${key} = ?`);
            values.push(activityData[key]);
        });

        if (fields.length === 0) return { id };

        values.push(id);
        const sql = `UPDATE activities SET ${fields.join(', ')} WHERE id = ?`;

        await dbRun(sql, values);
        return { id };
    }

    static async deleteActivity(id) {
        await dbRun('DELETE FROM activity_signups WHERE activity_id = ?', [id]);
        await dbRun('DELETE FROM activities WHERE id = ?', [id]);
        return true;
    }
}

module.exports = DataService;

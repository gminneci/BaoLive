# 🏕️ Sefton Park Camping Trip Organizer

A web application to organize a school camping trip for Year 3 classes (Baobab and Olive) to Mendip Basecamp.

## Features

- **Family Registration**: Register with Mendip Basecamp booking reference
- **Activity Sign-ups**: Real-time updates as you tick/untick children
- **Family-level Payments**: Record payments per family (not per activity)
- **Payment Status**: Live totals (owed/paid/outstanding) based on signups and payments
- **Admin Dashboard**: Manage families, activities, sign-ups and payments
- **Audit Trail**: Void/reinstate payments (soft delete, no hard deletion)
- **CSV Export**: Copy data for Google Sheets
- **Family Access**: View/edit registration using child names

## Tech Stack

- **Backend**: Node.js + Express + SQLite
- **Frontend**: HTML + CSS + Vanilla JavaScript
- **Database**: SQLite (file-based, easy to deploy)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation (Local)

1. Install dependencies:
```bash
npm install
```

2. Set a session secret (recommended):
```bash
export SESSION_SECRET="$(openssl rand -hex 32)"
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3001
```

## Usage

### For Parents

1. **First Time**: Book your spot at [mendipbasecamp.com](https://mendipbasecamp.com)
2. **Register**: Click "New Family Registration" and enter:
   - Your booking reference
   - Family members (children and adults)
   - Camping type (tent or campervan)
   - Which nights you're staying
3. **Access Later**: Use "Access My Registration" with your child's name(s)
4. **Activities**: Sign up for activities; totals and payment button update instantly

### For Organizers

1. **Admin Dashboard**: View all registrations and activity sign-ups
2. **Payment Tracking**: Record family payments; void or reinstate as needed
3. **Export Data**: Click "Copy CSV" to export data for Google Sheets
4. **Add Activities**: Create new activities from the admin panel

## Database

SQLite schema (simplified):

- **families**: booking_ref, camping_type, nights, access_key
- **family_members**: name, is_child, in_sefton_park, year, class, family_id
- **activities**: name, session_time, cost, description, max_participants, available
- **activity_signups**: activity_id, family_id, children (JSON array)
- **payments**: id, family_id, amount, payment_date, notes, cancelled (INTEGER 0/1)

Notes:
- Payments are recorded at the family level.
- Voiding a payment sets `cancelled = 1` (kept for audit). Reinstate sets `cancelled = 0`.
- Activity signups are removed when all children are unchecked (no empty signups).

Sample activities are pre-loaded:
- Tobogganing (Saturday 10:00 AM, £5.00)
- Archery (Saturday 2:00 PM, £8.00)
- Nature Walk (Friday 4:00 PM, Free)
- Campfire Stories (Friday 7:00 PM, Free)

## Deployment to Railway

Railway automatically builds and runs this Node.js app and persists the SQLite database.

### 1) Create & connect
- Create a project at https://railway.app
- Deploy from your GitHub repo

### 2) Ensure public networking
- The server binds to `0.0.0.0` and uses `PORT` (already configured)
- Railway will provide a public URL like `https://<app>.up.railway.app`

### 3) Environment variables
Add these in Railway → Service → Variables:
- `ADMIN_PASSWORD`: Set a secure password for admin access
- `SESSION_SECRET`: Long random string for session cookies (e.g. `openssl rand -hex 32`)

### 4) Production API base URL
The frontend uses [public/common.js](public/common.js). It auto-selects:
- Local: `http://localhost:3001/api`
- Railway: `https://<your-app>.up.railway.app/api`

### 5) Admin protection
- Admin endpoints require authentication (password via `ADMIN_PASSWORD`)
- Sessions are backed by `express-session` and `SESSION_SECRET`
- Family registration and activity signup endpoints remain public

### Troubleshooting
- If Railway build fails with `npm ci` lock mismatch, run locally:
```bash
npm install
git add package-lock.json
git commit -m "Update lockfile"
git push
```
- Ensure `ADMIN_PASSWORD` environment variable is set in Railway
- Check logs in Railway Deployments for runtime errors

## Security Notes

- **Minimal PII**: No emails; access via child names and booking ref
- **Family-level Payments**: Audit-friendly with void/reinstate (no hard delete)
- **Sessions**: Signed cookies with `SESSION_SECRET`
- **Availability**: Families still see full activities they are signed up for (to un-register)
- **Caching**: Client fetches use `cache: 'no-store'` to avoid stale totals

## Future Enhancements

- Email notifications
- Integrated payment processing (if secure solution found)
- Automated reminders
- Weather updates
- Packing list generator

## Support

For questions or issues, contact the trip organizers.

---

Made with ❤️ for Sefton Park School

## Trip Details
- Dates: 10–12 July 2025
- Classes: Baobab & Olive (Year 3)
- Year options include Reception through Year 6

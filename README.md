# 🏕️ Sefton Park Camping Trip Organizer

A web application to organize a school camping trip for Year 3 classes (Baobab and Olive) to Mendip Basecamp.

## Features

- **Family Registration**: Parents register with their Mendip Basecamp booking reference
- **Activity Sign-ups**: Sign up children for optional activities (tobogganing, archery, etc.)
- **Payment Tracking**: Track which families have paid for activities
- **Admin Dashboard**: View all registrations and activity sign-ups
- **CSV Export**: Export data to paste into Google Sheets
- **Family Access**: Parents can view/edit their registration using child names

## Tech Stack

- **Backend**: Node.js + Express + SQLite
- **Frontend**: HTML + CSS + Vanilla JavaScript
- **Database**: SQLite (file-based, easy to deploy)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
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
4. **Activities**: Sign up for activities and track payment status

### For Organizers

1. **Admin Dashboard**: View all registrations and activity sign-ups
2. **Payment Tracking**: Mark activities as paid when payment is received
3. **Export Data**: Click "Copy CSV" to export data for Google Sheets
4. **Add Activities**: Create new activities from the admin panel

## Database

The app uses SQLite with the following structure:

- **families**: Booking reference, camping details, access key
- **family_members**: Names, child/adult status, school details
- **activities**: Activity name, time, cost, description
- **activity_signups**: Links families to activities, payment status

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

### 3) Environment variables (for Admin auth)
Add these in Railway → Service → Variables:
- `GOOGLE_CLIENT_ID`: From Google Cloud OAuth credentials
- `GOOGLE_CLIENT_SECRET`: From Google Cloud
- `GOOGLE_CALLBACK_URL`: `https://<your-app>.up.railway.app/auth/google/callback`
- `SESSION_SECRET`: Any long random string
- `ADMIN_EMAILS` (optional): Comma-separated allowlist; if omitted, any `@gmail.com` can access admin

### 4) Google OAuth setup
In Google Cloud Console:
- Create OAuth 2.0 Client ID (Web application)
- Authorized redirect URI: `https://<your-app>.up.railway.app/auth/google/callback`
- Copy Client ID and Secret into Railway variables above

### 5) Production API base URL
The frontend uses [public/common.js](public/common.js). In production it points to `https://<your-app>.up.railway.app/api`.

### 6) Admin protection
- Visiting [public/admin.html](public/admin.html) without auth redirects to Google sign-in
- Admin-only APIs (create/update/delete activities) require auth
- Family registration and activity signup endpoints remain public

### Troubleshooting
- If Railway build fails with `npm ci` lock mismatch, run locally:
```bash
npm install
git add package-lock.json
git commit -m "Update lockfile"
git push
```
- Confirm your public URL and `GOOGLE_CALLBACK_URL` match exactly
- Check logs in Railway Deployments for runtime errors

## Security Notes

- **No Email Storage**: Parents access their data using child names (no email required)
- **No Sensitive Data**: Only camping trip information is stored
- **Payment Links**: Currently using dummy links - configure external payment provider as needed
- **Access Control**: Simple family-based access (suitable for low-sensitivity data)
   - Admin is protected via Google OAuth in production

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

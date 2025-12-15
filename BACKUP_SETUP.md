# Database Backup Setup for Railway

This guide explains how to set up automatic database backups for your BaoLive application on Railway.

## Features

- ✅ **Automatic Daily Backups**: Runs at 2:00 AM UTC every day
- ✅ **Manual Backups**: Create backups on-demand from the admin panel
- ✅ **Backup Management**: View, download, and delete backups via web interface
- ✅ **Automatic Cleanup**: Keeps only the last 30 backups
- ✅ **Secure**: Admin-only access with password protection

## Railway Volume Setup

### Step 1: Create a Volume in Railway

1. Go to your Railway project dashboard
2. Click on your service (BaoLive)
3. Go to the **"Variables"** tab
4. Click on **"New Volume"** (or similar option in your Railway dashboard)
5. Configure the volume:
   - **Mount Path**: `/data`
   - **Size**: 2 GB (stores the live database and 30 daily backups)

Alternatively, you can create the volume using the Railway CLI:

```bash
railway volume create --name bao-data --mount /data
```

### Step 2: Set Environment Variables

In your Railway dashboard, add the following environment variable:

- `DATA_DIR=/data`

This tells the app to store the live database and backups at `/data/camping.db` and `/data/camping_*.db`.

### Step 3: Deploy the Changes

Once deployed to Railway, the backup system will automatically:

1. Create the `/data` directory if it doesn't exist
2. Initialize the database at `/data/camping.db`
3. Start the daily backup scheduler (2:00 AM UTC)
4. Enable the Backups tab in the admin panel

### Step 4: Verify Setup

After deployment:

1. Log in to the admin panel
2. Click on the **💾 Backups** tab
3. Click **"Create Backup Now"** to test the system
4. You should see your first backup appear in the list

## Using the Backup System

### Admin Panel (Recommended)

Access the Backups tab in your admin panel at `https://your-app.railway.app/admin.html`

**Features:**
- View all available backups with dates and file sizes
- Download any backup to your local computer
- Delete old backups manually if needed
- Create manual backups on-demand

### Manual Download via Railway CLI

If you prefer command-line access:

```bash
# Navigate to your project
cd /Users/gminneci/Code/BaoLive

# Download a specific backup
railway run cat /data/camping_2025-12-15T02-00-00.db > local-backup.db

# List all backups
railway run ls -lh /data
```

## Backup Schedule

- **Automatic**: Daily at 2:00 AM UTC
- **Retention**: Last 30 backups (older ones are auto-deleted)
- **Manual**: Create anytime via admin panel

## Troubleshooting

### Backups not appearing?

1. Check that the Railway volume is properly mounted at `/data`
2. Check Railway logs for any errors: `railway logs`
3. Verify the backup directory exists: `railway run ls -la /data`

### Manual backup failed?

- Ensure you're logged in as admin
- Check that the volume has enough space
- Check Railway logs for error messages

### Can't download backups?

- Verify your admin session is active
- Try creating a manual backup first to test the system
- Check browser console for any errors

## Environment Variables

The following environment variable configures the database and backup system:

- `DATA_DIR`: Directory for both the live database and backups (default: `/data`)

**For Railway**, set `DATA_DIR=/data` to use the persistent volume.

## File Naming Convention

Backups are named: `camping_YYYY-MM-DDTHH-MM-SS.db`

Example: `camping_2025-12-15T02-00-00.db`

## Security

- All backup endpoints require admin authentication
- Backup filenames are validated to prevent directory traversal attacks
- Only files matching the pattern `camping_*.db` can be accessed

## Support

If you encounter any issues, check the Railway logs:

```bash
railway logs
```

Or contact your development team.

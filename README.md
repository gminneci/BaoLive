# 🏕️ Sefton Park Camping Trip Organizer

A web application to organize a school camping trip for Year 3 classes (Baobab and Olive) to Mendip Basecamp.

## Features

-   **Family Registration**: Register with Mendip Basecamp booking reference (secure lookup).
-   **Identity Confirmation**: Popup shows your child name(s) before editing.
-   **Activity Sign-ups**: Real-time updates as you tick/untick children.
-   **Age Restrictions**: Administrator can limit events to "Children Only", "Adults Only", or "Both".
-   **Family-level Payments**: Record payments per family (not per activity).
-   **Payment Status**: Live totals (owed/paid/outstanding) based on signups and payments.
-   **Admin Dashboard**: Manage families, activities, sign-ups and payments.
-   **Audit Trail**: Void/reinstate payments (soft delete, no hard deletion).
-   **Backups**: Automatic daily database backups and manual backup creation.
-   **CSV Export**: Copy data for Google Sheets.
-   **Family Access**: Securely access/edit registration using Booking Reference lookup.

## Tech Stack

-   **Backend**: Node.js + Express + SQLite
-   **Frontend**: HTML + CSS + Vanilla JavaScript
-   **Database**: SQLite (file-based, easy to deploy)
-   **Hosting**: Railway (recommended)

## Getting Started

### Prerequisites

-   Node.js (v14 or higher)
-   npm

### Installation (Local)

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Set a session secret (recommended):
    ```bash
    export SESSION_SECRET="your-secret-key"
    export ADMIN_PASSWORD="your-admin-password"
    ```

3.  Start the server:
    ```bash
    npm start
    ```

4.  Open your browser and navigate to:
    ```
    http://localhost:3001
    ```

## Usage

### For Parents

1.  **First Time**: Book your spot at [mendipbasecamp.com](https://mendipbasecamp.com)
2.  **Start Registration**: Enter your **Booking Reference** on the home page.
    - If found, you'll see a confirmation popup with your child name(s). Confirm to continue.
    - If not found, you'll be prompted to start a new registration.
3.  **Create Profile**: Enter family members (children and adults), camping type, and nights.
4.  **Activities**: Sign up for activities!
    -   Some activities may be age-restricted (e.g., "Child Only").
    -   Totals and payment instructions update instantly.
5.  **Edit**: You can return anytime by entering your Booking Reference again.

Notes:
-   At least one child from Baobab or Olive is required to proceed.
-   Please avoid sensitive data — first names or nicknames only.

### For Organizers

1.  **Admin Dashboard**: Access via `/admin.html` (requires password).
2.  **Manage Activities**:
    -   Add/Edit activities.
    -   Set max participants (auto-locks when full).
    -   Set age restrictions (Child/Adult/Both).
3.  **Payment Tracking**: Record family payments; void or reinstate as needed.
4.  **Backups**: Manage database backups from the "Backups" tab.
5.  **Export Data**: Click "Copy CSV" to export data for spreadsheets.

## Database

SQLite schema highlights:

-   **families**: `booking_ref` (unique), `access_key` (derived), `camping_type`, `nights`
-   **family_members**: `name`, `is_child`, `class` (Baobab/Olive/Other), `family_id`
-   **activities**: `name`, `session_time`, `cost`, `max_participants`, `available`, `allowed_ages`
-   **activity_signups**: `activity_id`, `family_id`, `children` (JSON array of names)
-   **payments**: `amount`, `payment_date`, `notes`, `cancelled` (0/1)

### Notes
-   **Payments**: Recorded at the family level.
-   **Voiding**: Sets `cancelled = 1` (kept for audit).
-   **Age Filtering**: `allowed_ages` column ('child', 'adult', 'both') controls who can sign up.

## Admin Config

Set the following environment variables:
-   `ADMIN_PASSWORD`: For accessing `/admin.html`.
-   `SESSION_SECRET`: For signing session cookies.
-   `DATA_DIR`: Directory for database and backups (default: `/data`).

### Railway Deployment

For production on Railway:
1. Create a persistent volume mounted at `/data` (2 GB recommended).
2. Set environment variable: `DATA_DIR=/data`
3. The live database will be stored at `/data/camping.db`.
4. Backups will be created in the same `/data` directory.

See [BACKUP_SETUP.md](BACKUP_SETUP.md) for step‑by‑step instructions, schedule (02:00 UTC), and retention (30 days).

## Support

For questions or issues, contact the Sefton Park School trip organizers.

---

Made with ❤️ for Sefton Park School

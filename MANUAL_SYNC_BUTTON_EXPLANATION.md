# Manual Sync Button - What It Does

## Overview

The **Manual Sync** button appears in the Calendar Integrations settings page when you have a **Calendly calendar connected**. It allows you to manually trigger a sync of your Calendly meetings to the Advicly database.

## Location

**File:** `src/components/CalendarSettings.js` (Lines 498-517)

**UI Location:** Calendar Integrations → Current Connection → Calendly card → "Manual Sync" button

## What It Does

When you click the **Manual Sync** button:

1. **Calls the backend endpoint:** `POST /api/calendly/sync`
2. **Triggers a sync operation** that:
   - Fetches all your Calendly meetings from the Calendly API
   - Compares them with meetings already in the Advicly database
   - Adds new meetings to the database
   - Updates existing meetings if details changed
   - Removes meetings that were deleted from Calendly

3. **Shows feedback:**
   - Button shows "Syncing..." with a spinner while running
   - Success message: "Calendly sync started. Meetings will be updated shortly."
   - Error message if sync fails

4. **Auto-refreshes:** Reloads the connections list after 2 seconds to show updated sync status

## Why You Need It

### Automatic Sync Already Exists
- **Scheduled sync:** Runs automatically every 15 minutes in the background
- **Webhook sync:** Real-time updates when meetings are created/cancelled in Calendly

### When to Use Manual Sync
- **Just connected Calendly:** Fetch all existing meetings immediately (don't wait 15 minutes)
- **Meetings not appearing:** Force a sync to check for missing meetings
- **After bulk changes:** If you made many changes in Calendly, sync immediately
- **Testing:** Verify the sync is working correctly

## Backend Implementation

**File:** `backend/src/routes/calendly.js` (Lines 71-120)

**What happens:**
```javascript
POST /api/calendly/sync
Authorization: Bearer <jwt_token>

// Returns:
{
  "success": true,
  "message": "Sync completed",
  "synced": 5,        // New meetings added
  "updated": 2,       // Existing meetings updated
  "deleted": 0,       // Meetings removed
  "errors": 0         // Sync errors
}
```

## How It Works

1. **Get Calendly connection** - Retrieves your stored Calendly API token
2. **Fetch from Calendly API** - Gets all your meetings from Calendly
3. **Compare with database** - Checks which meetings are new/updated/deleted
4. **Update database** - Adds/updates/removes meetings as needed
5. **Return results** - Shows how many meetings were synced

## Related Features

### Other Sync Methods

| Method | Trigger | Frequency | Real-time |
|--------|---------|-----------|-----------|
| **Manual Sync** | Click button | On-demand | No |
| **Scheduled Sync** | Automatic | Every 15 min | No |
| **Webhook Sync** | Calendly event | Instant | Yes |

### Other Buttons on Calendly Card

- **Reconnect** - Re-authenticate with Calendly (if token expires)
- **Disable Sync** - Turn off automatic syncing
- **Disconnect** - Remove Calendly connection entirely

## Current Status

✅ **Working correctly** - Manual sync is fully functional and integrated with:
- Automatic 15-minute scheduled sync
- Real-time webhook updates from Calendly
- Database sync status tracking

## Recommendation

**Keep it as is.** The Manual Sync button is useful for:
- Users who want immediate sync after connecting
- Troubleshooting sync issues
- Testing the integration

The combination of:
- Manual sync (on-demand)
- Scheduled sync (every 15 min)
- Webhook sync (real-time)

...provides a robust, multi-layered approach to keeping Calendly meetings in sync with Advicly.

## Future Improvements (Optional)

1. **Show last sync time** - Display when the last sync occurred
2. **Sync status indicator** - Show if sync is currently running
3. **Sync history** - Show recent sync results (meetings added/updated)
4. **Selective sync** - Allow syncing only specific date ranges
5. **Conflict resolution** - Handle cases where meetings differ between systems


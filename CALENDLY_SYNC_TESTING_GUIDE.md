# Calendly Sync Testing Guide - Mike Simpson Case

## Issues Fixed in This Deployment

### 1. ✅ Client Extraction Error
**Error**: `clientExtractionService.extractClientsFromMeetings is not a function`

**Fix**: Changed to correct method name `linkMeetingsToClients`

### 2. ✅ Canceled Meetings Not Being Detected
**Problem**: 
- 0 deleted meetings in sync results
- 150 restored (suspicious - likely false positives)
- All canceled events showing "never synced"

**Root Cause**: 
- Only checking by `googleeventid` which might not match
- Not using `calendly_event_uuid` for matching

**Fix**: 
- Added UUID-based matching as fallback
- Improved query to use `.or()` for both googleeventid and UUID
- Better logging to show what's being deleted

## Testing the Fix

### Immediate Test (After Deployment)

**Wait 2-3 minutes for Render deployment to complete**, then:

#### Option 1: Manual Sync (Immediate)
```bash
curl -X POST https://your-backend-url.com/api/calendly/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Option 2: Wait for Automatic Sync
- Next automatic sync will run within 15 minutes
- Check Render logs for sync activity

### Expected Results

Look for these in the Render logs:

```
📅 Found X active and Y canceled Calendly events
💾 Found Z existing Calendly meetings in database

🔄 Processing X active events...
✅ Created new meeting: [New Wednesday Meeting]
🔄 Updated active meeting: [Other Meeting]

🗑️  Processing Y canceled events...
🗑️  Marked as canceled: [Old Friday Meeting] (UUID: abc123)

🎉 Calendly sync complete: X new, Y updated, Z deleted, W restored, 0 errors
```

**Key Indicators of Success**:
- ✅ `deleted` count > 0 (not 0 like before)
- ✅ `restored` count should be lower (not 150)
- ✅ Specific log: `🗑️  Marked as canceled: [Meeting Name]`

## Debugging Mike Simpson's Meetings

### New Debug Endpoint

Check Mike Simpson's meetings specifically:

```bash
curl https://your-backend-url.com/api/calendly/debug/client/msimpson2@parthenon.ey.com \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response**:
```json
{
  "client_email": "msimpson2@parthenon.ey.com",
  "total_meetings": 2,
  "meetings": [
    {
      "id": 123,
      "title": "Meeting Title",
      "starttime": "2025-10-22T...",  // Wednesday (new)
      "is_deleted": false,
      "sync_status": "active",
      "calendly_event_uuid": "xyz789"
    },
    {
      "id": 122,
      "title": "Meeting Title",
      "starttime": "2025-10-17T...",  // Friday (old)
      "is_deleted": true,              // ✅ Should be true
      "sync_status": "canceled",       // ✅ Should be canceled
      "calendly_event_uuid": "abc123"
    }
  ]
}
```

### What to Look For

**✅ Success Indicators**:
1. Old Friday meeting: `is_deleted: true, sync_status: 'canceled'`
2. New Wednesday meeting: `is_deleted: false, sync_status: 'active'`
3. Only the Wednesday meeting shows in UI

**❌ Failure Indicators**:
1. Both meetings have `is_deleted: false`
2. Friday meeting still shows in UI
3. Sync logs show `0 deleted`

## Frontend UI Check

### Before Fix
```
Meetings for Mike Simpson:
- Friday, Oct 17 (OLD - should be gone) ❌
- Wednesday, Oct 22 (NEW - should show) ✅
```

### After Fix
```
Meetings for Mike Simpson:
- Wednesday, Oct 22 (NEW - should show) ✅
```

The Friday meeting should **completely disappear** from the UI.

## Database Query (Direct Check)

If you have database access:

```sql
SELECT 
  id,
  title,
  starttime,
  is_deleted,
  sync_status,
  calendly_event_uuid,
  client_email
FROM meetings
WHERE client_email ILIKE '%msimpson2@parthenon.ey.com%'
  AND meeting_source = 'calendly'
ORDER BY starttime DESC;
```

**Expected Results**:
- Friday meeting: `is_deleted = true`
- Wednesday meeting: `is_deleted = false`

## Troubleshooting

### If Canceled Meetings Still Show

1. **Check Render Logs**:
   - Look for `🗑️  Marked as canceled:` messages
   - If you see `⏭️  Skipping canceled event (never synced):` for Mike's meeting, that's the problem

2. **Check UUID Matching**:
   - The canceled event UUID from Calendly must match the `calendly_event_uuid` in database
   - Use debug endpoint to verify UUIDs

3. **Manual Database Update** (Last Resort):
   ```sql
   UPDATE meetings
   SET is_deleted = true, sync_status = 'canceled'
   WHERE client_email ILIKE '%msimpson2@parthenon.ey.com%'
     AND starttime::date = '2025-10-17'
     AND meeting_source = 'calendly';
   ```

### If New Wednesday Meeting Doesn't Show

1. **Check if it was created**:
   - Use debug endpoint
   - Look for `✅ Created new meeting:` in logs

2. **Check Calendly API**:
   - Verify the Wednesday meeting exists in Calendly
   - Verify it has status `active`

3. **Check time range**:
   - Sync fetches 2 years back, 1 year forward
   - Wednesday Oct 22 should be within range

## Understanding the Sync Logic

### How Rescheduled Meetings Work

When you reschedule a meeting in Calendly:

1. **Old meeting** → Status changes to `canceled` in Calendly
2. **New meeting** → Created with new UUID in Calendly

Our sync:
1. Fetches both `active` and `canceled` events
2. Marks old UUID as `is_deleted: true`
3. Creates new UUID as `is_deleted: false`

### Why UUID Matching Matters

Calendly uses UUIDs to identify events:
- `uri`: `https://api.calendly.com/scheduled_events/abc123`
- `uuid`: `abc123`

We store:
- `googleeventid`: `calendly_abc123` (for compatibility)
- `calendly_event_uuid`: `abc123` (for matching)

The fix now checks **both** fields when marking canceled meetings.

## Automatic Sync Behavior

### Frequency
- Every 15 minutes automatically
- No manual button click needed

### What It Does
1. Fetches active events from Calendly
2. Fetches canceled events from Calendly
3. Creates/updates active meetings in database
4. Marks canceled meetings as deleted in database
5. Extracts and links clients

### Monitoring
Check Render logs every 15 minutes for:
```
🔄 [Scheduled Sync] Starting automatic Calendly sync...
📅 Found X active and Y canceled Calendly events
🎉 Calendly sync complete: ...
```

## Next Steps After Deployment

1. **Wait 2-3 minutes** for Render to deploy
2. **Check Render logs** for successful deployment
3. **Trigger manual sync** OR **wait 15 minutes** for automatic sync
4. **Use debug endpoint** to check Mike Simpson's meetings
5. **Verify in UI** that Friday meeting is gone, Wednesday shows
6. **Monitor logs** for next automatic sync

## Success Criteria

✅ **Fix is working if**:
1. Render logs show `deleted` count > 0
2. Debug endpoint shows Friday meeting with `is_deleted: true`
3. UI only shows Wednesday meeting for Mike Simpson
4. No more `clientExtractionService.extractClientsFromMeetings is not a function` errors

❌ **Fix needs more work if**:
1. Sync still shows `0 deleted`
2. Friday meeting still has `is_deleted: false`
3. Both meetings show in UI
4. Errors in Render logs

## Contact Points

If the fix doesn't work:
1. Share Render logs from the next sync
2. Share output from debug endpoint for Mike Simpson
3. Share screenshot of UI showing meetings
4. I'll investigate further and provide additional fixes

---

**Deployment Status**: ✅ Deployed to Render  
**Next Sync**: Within 15 minutes  
**Debug Endpoint**: `GET /api/calendly/debug/client/msimpson2@parthenon.ey.com`


# Code Changes Summary

## Commit: ce6f534

### Files Modified:
1. `src/components/CalendarSettings.js` - Frontend UI and logic
2. `backend/src/routes/calendar-settings.js` - Backend sync logic

---

## Frontend Changes: `src/components/CalendarSettings.js`

### New Function: `handleSwitchCalendar()`

```javascript
const handleSwitchCalendar = async (connectionId, provider) => {
  try {
    setError('');
    setSuccess('');
    const token = await getAccessToken();

    // Activate this connection
    await axios.patch(
      `${API_BASE_URL}/api/calendar-connections/${connectionId}/toggle-sync`,
      { sync_enabled: true },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setSuccess(`Switched to ${getProviderName(provider)}`);

    // If switching to Google Calendar, trigger a sync
    if (provider === 'google') {
      try {
        console.log('🔄 Triggering Google Calendar sync...');
        await axios.post(
          `${API_BASE_URL}/api/calendar/sync-google`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess(`Switched to ${getProviderName(provider)} and synced meetings`);
      } catch (syncErr) {
        console.warn('⚠️ Sync failed but calendar was switched:', syncErr);
        // Don't fail the switch if sync fails
      }
    }

    loadConnections();
  } catch (err) {
    console.error('Error switching calendar:', err);
    setError(err.response?.data?.error || 'Failed to switch calendar');
  }
};
```

### New UI Section: "Switch Calendar"

```jsx
{/* Switch Calendar Section - Show all connected calendars */}
{connections.length > 1 && (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold text-foreground">Switch Calendar</h3>
    <p className="text-sm text-muted-foreground">
      Click a calendar below to switch to it. Only one calendar can be active at a time.
    </p>

    <div className="space-y-3">
      {connections.map((connection) => (
        <Card
          key={connection.id}
          className={`border-2 transition-all ${
            connection.is_active
              ? 'border-primary bg-primary/5'
              : 'border-border/50 hover:border-primary/50 cursor-pointer'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="text-3xl">{getProviderIcon(connection.provider)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground">
                      {getProviderName(connection.provider)}
                    </h4>
                    {connection.is_active && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-600 text-xs font-medium rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </div>
                  {connection.provider_account_email && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {connection.provider_account_email}
                    </p>
                  )}
                </div>
              </div>

              {!connection.is_active && (
                <Button
                  size="sm"
                  onClick={() => handleSwitchCalendar(connection.id, connection.provider)}
                  className="bg-primary hover:bg-primary/90"
                >
                  Switch
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
)}
```

### Updated "Add Calendar" Section

Changed from:
```jsx
{!connections.some(c => c.provider === 'calendly' && c.is_active) && (
  // Show Calendly card
)}
```

To:
```jsx
{!connections.some(c => c.provider === 'calendly') && (
  // Show Calendly card only if NOT connected at all
)}
```

---

## Backend Changes: `backend/src/routes/calendar-settings.js`

### Enhanced: `PATCH /api/calendar-connections/:id/toggle-sync`

**Key additions:**

1. **Deactivate other connections:**
```javascript
if (sync_enabled) {
  console.log(`🔄 Deactivating other active calendar connections...`);
  const { error: deactivateError } = await req.supabase
    .from('calendar_connections')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .neq('id', connectionId);
}
```

2. **Trigger Google Calendar sync:**
```javascript
if (sync_enabled && data.provider === 'google') {
  try {
    console.log('🔄 Triggering Google Calendar sync in background...');
    const CalendarSyncService = require('../services/calendarSync');
    const syncService = new CalendarSyncService();
    
    // Don't await - let it run in background
    syncService.syncUserCalendar(userId, {
      timeRange: 'extended',
      includeDeleted: true
    }).then(syncResult => {
      console.log('✅ Google Calendar sync completed:', syncResult);
    }).catch(syncErr => {
      console.warn('⚠️ Google Calendar sync failed (non-fatal):', syncErr.message);
    });
  } catch (syncErr) {
    console.warn('⚠️ Failed to start background sync:', syncErr.message);
  }
}
```

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **UI** | Confusing "Add Calendar" buttons | Clear "Switch Calendar" section |
| **Visibility** | Calendly hidden if active | All calendars always visible |
| **Switching** | Required OAuth popup | One-click switch |
| **Sync** | Manual "Sync" button | Automatic on switch |
| **Status** | No clear indication | "Active" badge |
| **UX** | 7 steps | 3 steps |

---

## Testing

See `IMPLEMENTATION_COMPLETE.md` for testing steps.

---

**Commit:** ce6f534  
**Date:** 2025-10-24  
**Status:** ✅ Deployed


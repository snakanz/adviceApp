# 🧪 Verification Guide: Transcript & Action Items Fix

## Step 1: Verify Render Deployment

1. Go to https://dashboard.render.com
2. Select your Advicly backend service
3. Check "Deployments" tab
4. Verify latest deployment (commit `390f965`) is **Live**
5. Check logs for any errors

---

## Step 2: Test PRIMARY Path - Recall.ai Webhook

### Scenario: Meeting with Recall.ai Bot Recording

1. **Find a meeting with Recall bot:**
   - Go to Meetings page
   - Look for meeting with "Test Take 2 Recall Meeting" or similar
   - Should have `recall_bot_id` in database

2. **Check if transcript was fetched:**
   - Open browser DevTools (F12)
   - Go to Meetings page
   - Look for console logs:
     ```
     ✅ Raw meetings data from API: (5) [{…}, {…}, {…}, {…}, {…}]
     ```

3. **Verify summaries exist:**
   - Click on meeting detail
   - Check "Summary" tab
   - Should see:
     - ✅ Quick Summary (single sentence)
     - ✅ Detailed Summary (structured format)
     - ✅ Email Summary Draft

4. **Check pending action items:**
   - Click "Transcript" tab
   - Scroll down to "Pending Action Items"
   - Should see list of extracted action items
   - Each item should have:
     - Checkbox to select
     - Priority dropdown (Urgent/High/Medium/Low)
     - Action text

5. **Approve action items:**
   - Select one or more pending items
   - Click "Approve Selected"
   - Items should move to "Approved Action Items" section

6. **Verify on Action Items page:**
   - Go to "Action Items" in sidebar
   - Should see approved items grouped by client
   - Should NOT see "Failed to load action items" error

---

## Step 3: Test FALLBACK Path - Manual Transcript Upload

### Scenario: Meeting without Recall Bot

1. **Find a meeting without transcript:**
   - Go to Meetings page
   - Find "Test Take 2 Recall Meeting" (the one showing error)
   - Click on it

2. **Upload transcript manually:**
   - Click "Transcript" tab
   - Click "Add Transcript" button
   - Paste this test transcript:
     ```
     This is a test and I need the client to send me a figure of his earnings. 
     LOA requested and refer to martyn for protection. 800k that he wants to invest 
     into multi index fund.
     ```
   - Click "Upload & Generate Summaries"

3. **Monitor upload:**
   - Should see "Processing transcript..." message
   - Then "Generating AI summaries..."
   - Should complete in 10-30 seconds

4. **Verify summaries generated:**
   - After upload completes:
     - ✅ Quick Summary should appear
     - ✅ Detailed Summary should appear
     - ✅ Email Summary Draft should appear
     - ✅ Pending Action Items should appear

5. **Check browser console for errors:**
   - Should NOT see:
     ```
     POST https://adviceapp-9rgw.onrender.com/api/calendar/meetings/471/transcript 500
     ```
   - Should see:
     ```
     ✅ Transcript upload response: {...}
     ```

---

## Step 4: Test Delete Transcript

1. **Delete the transcript:**
   - On meeting detail, click "Transcript" tab
   - Click "Delete Transcript" button
   - Confirm deletion

2. **Verify deletion:**
   - Should NOT see error (500)
   - Transcript should be cleared
   - All summaries should be cleared
   - Pending action items should be cleared

3. **Check console:**
   - Should see successful response
   - Should NOT see:
     ```
     DELETE https://adviceapp-9rgw.onrender.com/api/calendar/meetings/477/transcript 500
     ```

---

## Step 5: Database Verification

### Check Schema in Supabase

1. Go to https://supabase.com/dashboard
2. Select your Advicly project
3. Go to SQL Editor
4. Run this query:

```sql
-- Check pending_transcript_action_items schema
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'pending_transcript_action_items'
ORDER BY ordinal_position;
```

**Expected output:**
- `advisor_id` should be `uuid` (NOT `integer`)
- `priority` should exist with type `integer`

4. Run this query:

```sql
-- Check transcript_action_items schema
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'transcript_action_items'
ORDER BY ordinal_position;
```

**Expected output:**
- `advisor_id` should be `uuid` (NOT `integer`)
- `priority` should exist with type `integer`

5. Check RLS policies:

```sql
-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename IN ('pending_transcript_action_items', 'transcript_action_items')
ORDER BY tablename;
```

**Expected output:**
- Both tables should have RLS enabled
- Policies should check `advisor_id = auth.uid()`

---

## ✅ Success Criteria

- [ ] Recall.ai webhook generates summaries automatically
- [ ] Manual transcript upload works without 500 error
- [ ] Delete transcript endpoint works
- [ ] Pending action items appear after upload
- [ ] Approve action items moves them to approved table
- [ ] Action Items page displays items without error
- [ ] Database schema has UUID advisor_id (not INTEGER)
- [ ] RLS policies prevent cross-user access

---

## 🐛 Troubleshooting

### Issue: Still seeing 500 error on transcript upload

**Check:**
1. Render deployment is live (check dashboard)
2. Backend logs for errors:
   ```
   Error updating meeting transcript: ...
   ```
3. Meeting exists in database with correct user_id

### Issue: Pending action items not appearing

**Check:**
1. Transcript was successfully uploaded
2. Database has pending_transcript_action_items table
3. Check Render logs for:
   ```
   Error saving pending action items: ...
   ```

### Issue: Action Items page shows "Failed to load"

**Check:**
1. Browser console for API error
2. Render logs for endpoint errors
3. RLS policy is allowing access:
   ```sql
   SELECT * FROM pending_transcript_action_items 
   WHERE advisor_id = auth.uid();
   ```

---

## 📞 Support

If issues persist:
1. Check Render deployment logs
2. Check Supabase database logs
3. Verify RLS policies are correct
4. Verify schema matches expected types


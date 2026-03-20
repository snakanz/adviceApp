# AI Prompts Update - October 15, 2025

## Summary
Updated AI prompts for action items extraction and email summary generation to improve quality and reduce noise.

---

## Changes Made

### 1. Action Items Extraction Prompt

**Problem:**
- Extracting too many items including advisor prep work
- Including discussion topics instead of concrete actions
- Generating malformed JSON items (e.g., `"json`, `[`, `]`, `"""`)
- Including vague items like "Research and prepare information on..."

**Solution:**
New prompt focuses ONLY on concrete, client-facing actions:

✅ **Include:**
- Specific, actionable tasks with clear deliverables
- Client-facing actions (things to DO, not discuss)
- Follow-up meetings to schedule
- Documents to send, sign, or complete
- Account setups or administrative tasks

❌ **Exclude:**
- Advisor preparation work (e.g., "Research...", "Prepare information...")
- Discussion topics (e.g., "Discuss...", "Review options...")
- General notes or meeting agenda items
- Vague or exploratory items

**Result:**
- Limit to 5-7 most important action items only
- Clean JSON array format
- No broken or malformed items

---

### 2. Email Summary Template

**Problem:**
- Using markdown formatting (`##`, `**`, `*`) that looks messy in emails
- Too long and verbose
- Not suitable for direct email sending

**Solution:**
New prompt generates clean, plain-text emails:

✅ **New Format:**
- NO markdown symbols
- Maximum 200 words total
- Plain text with simple numbered lists
- Professional but warm tone
- Specific numbers/dates from transcript
- Focus on what matters most

**Example Output:**
```
Hi Sam,

It was great speaking with you this morning about your pension transfer.

We discussed transferring your Aviva pension to an SJP plan with regular 
contributions of £2,400 monthly. Once the necessary documents are finalized, 
we'll proceed with the transfer and set up your online account access.

Next Steps:
1. Complete internal BA check and send written advice documents
2. Set up your online wealth account logins
3. Schedule follow-up meeting after the budget announcement

Please let me know if you have any questions.

Best regards,
Nelson Greenwood
Financial Advisor
```

---

## Files Updated

1. **`backend/src/routes/calendar.js`**
   - Lines 438-472: Email summary template
   - Lines 491-513: Action items prompt

2. **`backend/src/index.js`**
   - Lines 682-717: Email summary template
   - Lines 736-758: Action items prompt

---

## Testing

After deployment completes (~5-10 minutes):

1. **Upload a new transcript** for any meeting
2. **Click "Auto-Generate Summaries"**
3. **Verify:**
   - Action items are concrete and actionable (no "Research..." or "Discuss..." items)
   - Email summary is clean plain text (no `**` or `##` symbols)
   - Email is concise (under 200 words)
   - Only 5-7 action items maximum

---

## Deployment

- **Commit:** `ce91723`
- **Pushed:** October 15, 2025
- **Backend (Render):** Auto-deploying now
- **Frontend (Cloudflare Pages):** No changes needed

---

## Expected Improvements

### Before:
**Action Items:**
```
❌ "json
❌ [
✅ "Complete the internal 'BA check'..."
✅ "Set up Sam's online wealth account logins"
❌ "Research and prepare information on Stocks & Shares ISAs..."
❌ "Prepare to discuss Unit Trusts and VCTs..."
❌ ]
```

**Email:**
```
## Key Discussion Points

**1. Pension Transfer**
* Sam will transfer Aviva pension to SJP
* Regular contributions of £2,400 monthly
...
```

### After:
**Action Items:**
```
✅ "Complete internal BA check and send written advice documents"
✅ "Set up Sam's online wealth account logins"
✅ "Schedule follow-up meeting with Sam after budget announcement"
```

**Email:**
```
Hi Sam,

It was great speaking with you this morning about your pension transfer.

We discussed transferring your Aviva pension to an SJP plan...
```

---

## Notes

- The AI will now be much more selective about what qualifies as an "action item"
- Email summaries will be ready to send directly to clients without editing
- Both prompts maintain focus on specific numbers and dates from transcripts
- Changes apply to both manual transcript uploads and auto-generated summaries

---

**Status:** ✅ DEPLOYED
**Next Test:** Upload transcript and verify improved output quality


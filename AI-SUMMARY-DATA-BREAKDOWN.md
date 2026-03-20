# AI "Next Steps to Close" - Complete Data Breakdown

## What Data the AI Uses to Generate Summaries

The AI summary generation happens in `backend/src/routes/clients.js` in the `/clients/:clientId/generate-pipeline-summary` endpoint.

### Complete Data Context (in order of importance):

```javascript
// 1. CLIENT INFORMATION
Client Name: [e.g., "Alaa Salha"]
Total Expected Fees (IAF): £[e.g., 5,000]

// 2. BUSINESS TYPES (Primary context)
Business Types:
- [Type]: £[Amount] (IAF: £[IAF Amount])
  Expected Close: [Date - e.g., "2026-08-15"]
  Notes: [Business type specific notes]

// 3. RECENT MEETING ACTION POINTS (Last 3 meetings)
Recent Action Points:
[Concatenated action points from up to 3 most recent meetings]

// 4. PIPELINE NOTES (The one you're trying to add)
Pipeline Notes:
[Free-form text notes about the client - e.g., "Client wants to sign in August"]
```

## Exact AI Prompt Structure

Here's the EXACT prompt sent to OpenAI GPT-4o-mini:

```javascript
`You are a financial advisor's assistant. Generate a brief, actionable summary (2-3 sentences maximum) explaining what needs to happen to finalize this business deal.

Client: ${client.name}
Total Expected Fees (IAF): £${client.iaf_expected?.toLocaleString() || 0}

Business Types:
${businessContext.map(bt => `- ${bt.type}: £${bt.amount?.toLocaleString() || 0} (IAF: £${bt.iaf?.toLocaleString() || 0})
  Expected Close: ${bt.expectedClose || 'Not set'}
  ${bt.notes ? 'Notes: ' + bt.notes : ''}`).join('\n')}

Recent Action Points:
${actionPoints}

Pipeline Notes:
${client.pipeline_notes || 'None'}

Generate a concise, actionable summary that explains:
1. What specific actions or documents are needed to close this deal
2. Any blockers or pending items that need attention
3. The immediate next step the advisor should take

Be specific and actionable. Focus on what needs to happen NOW to move this forward. Maximum 3 sentences.`
```

## Data Sources and Where They Come From

### 1. **Client Basic Info**
- **Source**: `clients` table
- **Fields**:
  - `name` - Client name
  - `iaf_expected` - Total expected fees across all business types
- **Retrieved**: Direct query in the endpoint

### 2. **Business Types** (Most Important)
- **Source**: `client_business_types` table
- **Fields**:
  - `business_type` - Type of business (e.g., "Investment", "Pension")
  - `business_amount` - Amount for this business type
  - `iaf_expected` - Expected IAF for this business type
  - `expected_close_date` - When this is expected to close
  - `notes` - Notes specific to this business type
- **Retrieved**: Queried separately by `client_id`

### 3. **Meeting Action Points**
- **Source**: `meetings` table
- **Fields**:
  - `action_points` - Text field with action items from meeting
- **Limit**: Last 3 meetings ordered by `starttime` descending
- **Concatenation**: All `action_points` joined with newlines
- **Retrieved**: Query with `.limit(3)` and `.order('starttime', { ascending: false })`

### 4. **Pipeline Notes** (THE ONE FAILING)
- **Source**: `clients` table
- **Field**: `pipeline_notes` (NOT `notes`)
- **Current Issue**: Column doesn't exist in your database yet
- **Retrieved**: Already fetched with the client query

## Current Error Explained

```
Error saving notes: Error: HTTP error! status: 500
```

**Root Cause**: The `pipeline_notes` column doesn't exist in your database yet.

**Why**: You haven't run Migration 034 in Supabase.

**What's Happening**:
1. Frontend tries to save notes to `/clients/:id/notes`
2. Backend tries to update `pipeline_notes` column
3. Database returns error: "column pipeline_notes does not exist"
4. Backend returns 500 error to frontend

**Fix**: I just added fallback logic that will use the `notes` column temporarily, but you MUST run Migration 034.

## Smart Caching Logic

The AI decides whether to regenerate or use cache based on:

```javascript
if (client.pipeline_data_updated_at > client.pipeline_next_steps_generated_at) {
  // Data changed since last generation → REGENERATE (costs ~150 tokens)
} else {
  // No data changes → USE CACHE (costs 0 tokens)
}
```

### What Triggers `pipeline_data_updated_at` to Update?

Database triggers (from migrations 032 & 033) update this timestamp when:

1. **Business types change** (INSERT/UPDATE on `client_business_types` table)
2. **Meetings change** (INSERT/UPDATE on `meetings.transcript`, `.action_points`, `.quick_summary`)
3. **Pipeline notes change** (UPDATE on `clients.pipeline_notes`) ← **REQUIRES MIGRATION 033 & 034**

## Token Cost Breakdown

### First Generation (No Cache):
- **Input tokens**: ~150 tokens
  - Prompt template: ~100 tokens
  - Client data: ~50 tokens (varies by complexity)
- **Output tokens**: ~50 tokens
  - Summary response: ~50 tokens (2-3 sentences)
- **Total**: ~200 tokens per generation
- **Cost**: ~$0.0001 per generation (GPT-4o-mini rates)

### Cached Response:
- **Input tokens**: 0 (returns from database)
- **Output tokens**: 0 (returns from database)
- **Total**: 0 tokens
- **Cost**: $0

### Real-World Usage:
- **Without caching**: 10 clients × 3 views per day × 30 days × 200 tokens = 180,000 tokens/month (~$0.36)
- **With smart caching**: 10 clients × 1 generation + 1 change per week × 4 weeks × 200 tokens = 8,000 tokens/month (~$0.016)
- **Savings**: 95% reduction

## Complete Data Flow Diagram

```
1. USER SAVES PIPELINE NOTES
   ↓
2. Frontend → POST /clients/:id/notes
   Body: { notes: "Client wants to sign in August" }
   ↓
3. Backend → Update clients table
   SET pipeline_notes = "Client wants to sign in August"
   ↓
4. Database Trigger (Migration 033) fires
   SET pipeline_data_updated_at = NOW()
   ↓
5. Backend returns success
   ↓
6. Frontend → POST /clients/:id/generate-pipeline-summary
   ↓
7. Backend checks cache:
   IF pipeline_data_updated_at > pipeline_next_steps_generated_at
   THEN regenerate (data changed)
   ELSE use cache (no changes)
   ↓
8. Backend generates AI summary with ALL context:
   - Client name & total fees
   - Business types with amounts & dates
   - Recent meeting action points
   - Pipeline notes ← "Client wants to sign in August"
   ↓
9. OpenAI GPT-4o-mini processes and returns:
   "To finalize the investment deal for Alaa Salha, ensure that the
   DocuSign documents are sent and signed without delay, as the client
   has indicated they want to proceed in August. Confirm there are no
   additional charges before proceeding, and follow up promptly to
   secure the signature."
   ↓
10. Backend saves to database:
    SET pipeline_next_steps = [AI response]
    SET pipeline_next_steps_generated_at = NOW()
    ↓
11. Frontend displays AI summary
```

## Why Your Notes Aren't Appearing

### Current State:
```
✅ Frontend sends notes correctly
✅ Backend tries to save to pipeline_notes
❌ Database: pipeline_notes column doesn't exist
❌ Backend returns 500 error
❌ Frontend shows error
❌ AI never sees the notes
```

### After Running Migration 034:
```
✅ Frontend sends notes correctly
✅ Backend saves to pipeline_notes column
✅ Database trigger updates pipeline_data_updated_at
✅ Frontend calls generate-pipeline-summary
✅ Backend sees data changed (pipeline_data_updated_at > generated_at)
✅ Backend regenerates with pipeline notes included
✅ AI summary mentions "August" or "sign in August"
```

## What You Need to Do RIGHT NOW

### Step 1: Run Migration 034 in Supabase SQL Editor

```sql
-- This creates the missing pipeline_notes column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pipeline_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_pipeline_notes
ON clients(pipeline_notes) WHERE pipeline_notes IS NOT NULL;

-- Migrate existing notes to pipeline_notes
UPDATE clients
SET pipeline_notes = notes
WHERE pipeline_notes IS NULL AND notes IS NOT NULL;

COMMENT ON COLUMN clients.pipeline_notes IS 'Pipeline-specific notes used in AI summary generation. Tracked by pipeline_data_updated_at trigger for smart caching.';
```

### Step 2: Redeploy Backend (Already Deploying)

The backend with fallback logic is deploying now. Once deployed:
- If migration 034 is run: Uses `pipeline_notes` column ✅
- If migration 034 NOT run: Falls back to `notes` column (temporary)

### Step 3: Test the Complete Flow

1. Save pipeline notes: "Client wants to sign in August"
2. Should save successfully (no 500 error)
3. Close and reopen client
4. AI summary should include "August" context

## Summary Table

| Data Type | Table | Column | When Updated | Used in AI? |
|-----------|-------|--------|--------------|-------------|
| Client Name | clients | name | On client creation | ✅ Yes |
| Total Fees | clients | iaf_expected | Calculated from business types | ✅ Yes |
| Business Types | client_business_types | business_type, business_amount, iaf_expected, expected_close_date, notes | When user edits pipeline | ✅ Yes (Primary) |
| Meeting Action Points | meetings | action_points | After meeting transcription | ✅ Yes (Last 3) |
| Pipeline Notes | clients | pipeline_notes | When user saves notes | ✅ Yes (MISSING COLUMN) |
| Cache Timestamp | clients | pipeline_data_updated_at | Via triggers on above changes | ⚙️ For cache logic |
| Summary | clients | pipeline_next_steps | After AI generation | 📦 Output |
| Summary Generated At | clients | pipeline_next_steps_generated_at | After AI generation | ⚙️ For cache logic |

## Debugging Commands

Check if column exists:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'pipeline_notes';
```

Check current client data:
```sql
SELECT id, name, notes, pipeline_notes, pipeline_data_updated_at, pipeline_next_steps_generated_at
FROM clients
WHERE id = 'YOUR_CLIENT_ID';
```

Check if trigger exists:
```sql
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_pipeline_data_on_notes_change';
```

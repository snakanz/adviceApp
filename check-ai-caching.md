# AI Summary Caching Status Check

## How to Verify Smart Caching is Working

### 1. Check Database Migration Status

Run this in your Supabase SQL Editor:

```sql
-- Check if pipeline_data_updated_at column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'clients'
AND column_name = 'pipeline_data_updated_at';

-- Check current status of your clients
SELECT
  name,
  pipeline_next_steps IS NOT NULL as has_summary,
  pipeline_next_steps_generated_at,
  pipeline_data_updated_at,
  CASE
    WHEN pipeline_data_updated_at IS NULL THEN 'NO TRIGGER (migration not run)'
    WHEN pipeline_data_updated_at <= pipeline_next_steps_generated_at THEN 'CACHED (no regeneration needed)'
    ELSE 'STALE (will regenerate)'
  END as cache_status
FROM clients
WHERE pipeline_next_steps IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
```

### 2. Check Backend Logs

When you click into a client in Pipeline, watch your backend logs for:

**✅ Good (0 tokens used):**
```
📊 Pipeline summary check: { needsRegeneration: false }
✅ Using cached pipeline summary - no data changes detected
```

**❌ Bad (150 tokens used):**
```
📊 Pipeline summary check: { needsRegeneration: true }
🤖 Generating new pipeline summary - data has changed or no cache exists
```

### 3. Expected Behavior

| Action | Should Generate? | Token Cost |
|--------|-----------------|------------|
| Click client (first time ever) | Yes | ~150 tokens |
| Click same client again | No | 0 tokens ✅ |
| Add new meeting transcript | Yes (on next click) | ~150 tokens |
| Update business type | Yes (on next click) | ~150 tokens |
| Change stage dropdown | No | 0 tokens ✅ |
| Just viewing client | No | 0 tokens ✅ |

### 4. Token Usage Estimate

Assuming you have 10 clients and click into each one once per day:

**WITH Smart Caching (migration run):**
- Day 1: 10 clients × 150 tokens = 1,500 tokens
- Day 2: 10 clients × 0 tokens = 0 tokens (cached)
- Day 3: 2 clients changed × 150 tokens = 300 tokens
- **Monthly**: ~5,000 tokens ($0.01 at GPT-4o-mini rates)

**WITHOUT Smart Caching (migration not run):**
- Day 1: 10 clients × 150 tokens = 1,500 tokens
- Day 2: 10 clients × 150 tokens = 1,500 tokens (regenerates!)
- Day 3: 10 clients × 150 tokens = 1,500 tokens
- **Monthly**: ~45,000 tokens ($0.09)

### 5. Quick Test

1. Open Pipeline page
2. Click into any client with meetings/business types
3. Check browser console for: `📊 AI Summary Response: { cached: true/false }`
4. Close and re-open same client
5. Second time should show `cached: true`

If you see `cached: false` both times, the migration didn't run properly.

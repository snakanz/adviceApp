# Request 2: Database Schema Audit & Redesign
## Part 2: Clean Schema Design

---

## Clean, Minimal Schema

### Design Principles
1. **Simplicity** - Only essential tables and columns
2. **Consistency** - All user_id columns are UUID
3. **Normalization** - Data properly split across tables
4. **Clarity** - Intuitive naming and structure
5. **Performance** - Proper indexes and constraints

---

## Proposed Clean Schema

### 1. **users** (Core)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    provider TEXT NOT NULL, -- 'google', 'microsoft', 'email'
    providerid TEXT,
    profilepicture TEXT,
    business_name TEXT,
    timezone TEXT DEFAULT 'UTC',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose:** User accounts and authentication
**Columns:** 12 (clean, minimal)
**Status:** ✅ Keep as-is

---

### 2. **calendar_connections** (Core)
```sql
CREATE TABLE calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'google', 'microsoft', 'calendly'
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose:** OAuth tokens for calendar integrations
**Columns:** 9 (clean)
**Status:** ✅ Keep as-is

---

### 3. **meetings** (Simplified)
```sql
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    starttime TIMESTAMP WITH TIME ZONE NOT NULL,
    endtime TIMESTAMP WITH TIME ZONE,
    location TEXT,
    attendees JSONB,
    
    -- Meeting content
    transcript TEXT,
    quick_summary TEXT,
    detailed_summary TEXT,
    action_points TEXT,
    
    -- Metadata
    meeting_source TEXT NOT NULL DEFAULT 'google', -- 'google', 'calendly', 'manual'
    external_id TEXT, -- googleeventid, calendly_uuid, etc.
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, external_id)
);
```
**Purpose:** Meeting records from all sources
**Columns:** 18 (down from 30+)
**Changes:**
- ✅ userid → user_id (UUID)
- ✅ Removed redundant columns (summary, notes, etc.)
- ✅ Consolidated sync columns
- ✅ Renamed googleeventid → external_id (works for all sources)

---

### 4. **clients** (Simplified)
```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    
    -- Pipeline
    pipeline_stage TEXT DEFAULT 'prospect', -- prospect, qualified, proposal, closed_won, closed_lost
    priority_level INTEGER DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
    
    -- Contact tracking
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_follow_up_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    notes TEXT,
    tags TEXT[],
    source TEXT, -- How client was acquired
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, email)
);
```
**Purpose:** Client relationship management
**Columns:** 14 (down from 25+)
**Changes:**
- ✅ advisor_id → user_id (UUID)
- ✅ Removed business data (moved to client_business_types)
- ✅ Removed pipeline data (moved to pipeline_activities)
- ✅ Removed redundant columns

---

### 5. **client_business_types** (Unchanged)
```sql
CREATE TABLE client_business_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    business_type TEXT NOT NULL, -- 'pension', 'isa', 'bond', 'investment', 'insurance', 'mortgage'
    business_amount NUMERIC,
    regular_contribution NUMERIC,
    contribution_method TEXT, -- 'transfer', 'regular_monthly', 'lump_sum', 'both'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose:** Business type details for clients
**Status:** ✅ Keep as-is

---

### 6. **pipeline_activities** (Simplified)
```sql
CREATE TABLE pipeline_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'call', 'email', 'meeting', 'note', 'stage_change'
    title TEXT NOT NULL,
    description TEXT,
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose:** Track client interactions and pipeline changes
**Changes:**
- ✅ advisor_id → user_id (UUID)
- ✅ Removed redundant columns

---

### 7. **client_todos** (Simplified)
```sql
CREATE TABLE client_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
    category TEXT DEFAULT 'general', -- 'general', 'follow_up', 'meeting', 'document', 'research', 'proposal'
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose:** Task management per client
**Changes:**
- ✅ advisor_id → user_id (UUID)
- ✅ Merged with advisor_tasks (no separate table)

---

### 8. **client_documents** (Simplified)
```sql
CREATE TABLE client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
    
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    file_url TEXT NOT NULL,
    upload_source TEXT DEFAULT 'manual', -- 'meetings_page', 'clients_page', 'manual'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose:** Document storage for clients
**Changes:**
- ✅ advisor_id → user_id (UUID)
- ✅ Merged with meeting_documents (no separate table)

---

### 9. **ask_threads** (Simplified)
```sql
CREATE TABLE ask_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose:** AI chat conversation threads
**Changes:**
- ✅ advisor_id → user_id (UUID)

---

### 10. **ask_messages** (Unchanged)
```sql
CREATE TABLE ask_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES ask_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose:** Individual messages in chat threads
**Status:** ✅ Keep as-is

---

### 11. **transcript_action_items** (Simplified)
```sql
CREATE TABLE transcript_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    action_item_text TEXT NOT NULL,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose:** Action items extracted from meeting transcripts
**Changes:**
- ✅ advisor_id → user_id (UUID)
- ✅ Merged with pending_action_items (no separate table)

---

## Tables to DROP

```sql
DROP TABLE IF EXISTS calendartoken CASCADE;
DROP TABLE IF EXISTS meeting_documents CASCADE;
DROP TABLE IF EXISTS pending_action_items CASCADE;
DROP TABLE IF EXISTS advisor_tasks CASCADE;
DROP TABLE IF EXISTS calendar_watch_channels CASCADE;
DROP TABLE IF EXISTS _backup_users CASCADE;
DROP TABLE IF EXISTS _backup_meetings CASCADE;
DROP TABLE IF EXISTS _backup_clients CASCADE;
```

---

## Summary

### Before
- 20+ tables (many deprecated/redundant)
- Mixed UUID and INTEGER user_id
- 30+ columns in some tables
- Inconsistent naming
- Foreign key errors

### After
- 11 essential tables
- All UUID user_id (consistent)
- 10-18 columns per table (clean)
- Consistent naming (user_id everywhere)
- Proper foreign keys with CASCADE DELETE

---

## Next Steps

See **REQUEST_2_DATABASE_AUDIT_PART3.md** for:
1. Migration SQL scripts
2. Data migration procedures
3. Rollback plan
4. ERD diagram
5. Testing checklist


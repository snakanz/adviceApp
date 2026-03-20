# Request 2: Database Schema Audit & Redesign
## Part 4: ERD, Documentation & Implementation

---

## Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADVICLY CLEAN SCHEMA                            │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │    users     │
                              ├──────────────┤
                              │ id (UUID) PK │
                              │ email        │
                              │ name         │
                              │ provider     │
                              │ timezone     │
                              │ created_at   │
                              └──────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │ calendar_        │  │    meetings      │  │     clients      │
        │ connections      │  ├──────────────────┤  ├──────────────────┤
        ├──────────────────┤  │ id (SERIAL) PK   │  │ id (UUID) PK     │
        │ id (UUID) PK     │  │ user_id (UUID) FK│  │ user_id (UUID) FK│
        │ user_id (UUID) FK│  │ client_id (UUID) │  │ email            │
        │ provider         │  │ title            │  │ name             │
        │ access_token     │  │ description      │  │ pipeline_stage   │
        │ refresh_token    │  │ starttime        │  │ priority_level   │
        │ is_active        │  │ endtime          │  │ last_contact_date│
        │ last_sync_at     │  │ transcript       │  │ notes            │
        │ created_at       │  │ quick_summary    │  │ tags             │
        └──────────────────┘  │ detailed_summary │  │ created_at       │
                              │ action_points    │  └──────────────────┘
                              │ meeting_source   │         │
                              │ external_id      │         │
                              │ is_deleted       │         │
                              │ created_at       │         │
                              └──────────────────┘         │
                                     │                     │
                                     │                     ▼
                                     │          ┌──────────────────────┐
                                     │          │ client_business_types│
                                     │          ├──────────────────────┤
                                     │          │ id (UUID) PK         │
                                     │          │ client_id (UUID) FK  │
                                     │          │ business_type        │
                                     │          │ business_amount      │
                                     │          │ regular_contribution │
                                     │          │ contribution_method  │
                                     │          └──────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │ client_documents │  │ pipeline_        │  │ client_todos     │
        ├──────────────────┤  │ activities       │  ├──────────────────┤
        │ id (UUID) PK     │  ├──────────────────┤  │ id (UUID) PK     │
        │ user_id (UUID) FK│  │ id (UUID) PK     │  │ user_id (UUID) FK│
        │ client_id (UUID) │  │ user_id (UUID) FK│  │ client_id (UUID) │
        │ meeting_id (INT) │  │ client_id (UUID) │  │ title            │
        │ file_name        │  │ activity_type    │  │ description      │
        │ file_url         │  │ title            │  │ priority         │
        │ upload_source    │  │ description      │  │ status           │
        │ created_at       │  │ activity_date    │  │ category         │
        └──────────────────┘  │ metadata (JSONB) │  │ due_date         │
                              │ created_at       │  │ completed_at     │
                              └──────────────────┘  │ created_at       │
                                                    └──────────────────┘

        ┌──────────────────┐  ┌──────────────────┐
        │ ask_threads      │  │ transcript_      │
        ├──────────────────┤  │ action_items     │
        │ id (UUID) PK     │  ├──────────────────┤
        │ user_id (UUID) FK│  │ id (UUID) PK     │
        │ client_id (UUID) │  │ user_id (UUID) FK│
        │ title            │  │ meeting_id (INT) │
        │ is_archived      │  │ action_item_text │
        │ created_at       │  │ priority         │
        └──────────────────┘  │ status           │
                 │            │ due_date         │
                 │            │ created_at       │
                 ▼            └──────────────────┘
        ┌──────────────────┐
        │ ask_messages     │
        ├──────────────────┤
        │ id (UUID) PK     │
        │ thread_id (UUID) │
        │ role             │
        │ content          │
        │ metadata (JSONB) │
        │ created_at       │
        └──────────────────┘
```

---

## Table Documentation

### users
**Purpose:** User accounts and authentication
**Multi-tenant:** Yes (one user per advisor)
**RLS:** `user_id = auth.uid()`
**Indexes:** email, provider

### calendar_connections
**Purpose:** OAuth tokens for calendar integrations
**Multi-tenant:** Yes (one connection per user)
**RLS:** `user_id = auth.uid()`
**Indexes:** user_id (unique), provider

### meetings
**Purpose:** Meeting records from all sources (Google, Calendly, manual)
**Multi-tenant:** Yes (filtered by user_id)
**RLS:** `user_id = auth.uid()`
**Indexes:** user_id, client_id, external_id, meeting_source
**Key Fields:**
- `external_id`: Unique ID from source (googleeventid, calendly_uuid, etc.)
- `meeting_source`: 'google', 'calendly', 'manual'
- `quick_summary`: One-sentence summary for Clients page
- `detailed_summary`: Structured summary for Meetings page
- `action_points`: Extracted action items

### clients
**Purpose:** Client relationship management
**Multi-tenant:** Yes (filtered by user_id)
**RLS:** `user_id = auth.uid()`
**Indexes:** user_id, email, pipeline_stage
**Key Fields:**
- `pipeline_stage`: prospect, qualified, proposal, closed_won, closed_lost
- `priority_level`: 1-5 (1=highest)
- `tags`: Array of categorization tags

### client_business_types
**Purpose:** Business type details for clients
**Multi-tenant:** Yes (via client_id)
**RLS:** Via client_id → clients.user_id
**Indexes:** client_id
**Key Fields:**
- `business_type`: pension, isa, bond, investment, insurance, mortgage
- `contribution_method`: transfer, regular_monthly, lump_sum, both

### pipeline_activities
**Purpose:** Track client interactions and pipeline changes
**Multi-tenant:** Yes (filtered by user_id)
**RLS:** `user_id = auth.uid()`
**Indexes:** user_id, client_id, activity_type
**Key Fields:**
- `activity_type`: call, email, meeting, note, stage_change
- `metadata`: JSONB for activity-specific data

### client_todos
**Purpose:** Task management per client
**Multi-tenant:** Yes (filtered by user_id)
**RLS:** `user_id = auth.uid()`
**Indexes:** user_id, client_id, status
**Key Fields:**
- `status`: pending, in_progress, completed, cancelled
- `category`: general, follow_up, meeting, document, research, proposal

### client_documents
**Purpose:** Document storage for clients
**Multi-tenant:** Yes (filtered by user_id)
**RLS:** `user_id = auth.uid()`
**Indexes:** user_id, client_id, meeting_id
**Key Fields:**
- `upload_source`: meetings_page, clients_page, manual
- `meeting_id`: Optional link to meeting

### ask_threads
**Purpose:** AI chat conversation threads
**Multi-tenant:** Yes (filtered by user_id)
**RLS:** `user_id = auth.uid()`
**Indexes:** user_id, client_id
**Key Fields:**
- `client_id`: Optional link to specific client

### ask_messages
**Purpose:** Individual messages in chat threads
**Multi-tenant:** Yes (via thread_id)
**RLS:** Via thread_id → ask_threads.user_id
**Indexes:** thread_id, created_at
**Key Fields:**
- `role`: user, assistant, system
- `metadata`: JSONB for message-specific data

### transcript_action_items
**Purpose:** Action items extracted from meeting transcripts
**Multi-tenant:** Yes (filtered by user_id)
**RLS:** `user_id = auth.uid()`
**Indexes:** user_id, meeting_id, status
**Key Fields:**
- `status`: pending, in_progress, completed, cancelled

---

## Naming Conventions

### Column Names
- **Primary Keys:** `id` (UUID or SERIAL)
- **Foreign Keys:** `{table_name}_id` (e.g., `user_id`, `client_id`, `meeting_id`)
- **Timestamps:** `created_at`, `updated_at`
- **Booleans:** `is_{adjective}` (e.g., `is_active`, `is_deleted`, `is_archived`)
- **Status Fields:** `status`, `stage`, `type` (with CHECK constraints)

### Table Names
- **Singular:** `users`, `clients`, `meetings` (not `user`, `client`, `meeting`)
- **Descriptive:** `client_documents`, `pipeline_activities`, `ask_threads`
- **Avoid Abbreviations:** `transcript_action_items` (not `txn_action_items`)

### Enum Values
- **Lowercase:** `'pending'`, `'in_progress'`, `'completed'`
- **Underscores for Multi-word:** `'in_progress'`, `'closed_won'`
- **Consistent Across Tables:** Same status values used everywhere

---

## Backend Code Updates Required

### 1. Update All Queries
```javascript
// OLD
const { data } = await supabase
    .from('meetings')
    .select('*')
    .eq('userid', userId);

// NEW
const { data } = await supabase
    .from('meetings')
    .select('*')
    .eq('user_id', userId);
```

### 2. Update RLS Policies
```javascript
// OLD
.eq('advisor_id', userId)

// NEW
.eq('user_id', userId)
```

### 3. Update Foreign Key References
```javascript
// OLD
.eq('userid', userId)
.eq('advisor_id', userId)

// NEW
.eq('user_id', userId)
```

### 4. Update Insert Statements
```javascript
// OLD
const { error } = await supabase
    .from('meetings')
    .insert({ userid: userId, ... });

// NEW
const { error } = await supabase
    .from('meetings')
    .insert({ user_id: userId, ... });
```

---

## Testing Checklist

- [ ] All data migrated successfully
- [ ] No NULL user_id values
- [ ] Foreign keys working correctly
- [ ] RLS policies enforced
- [ ] Indexes created and working
- [ ] Backend queries updated
- [ ] No orphaned records
- [ ] Deprecated tables dropped
- [ ] Performance tests passed
- [ ] Rollback tested (on staging)

---

## Implementation Timeline

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Backup & Preparation | 30 min | Ready |
| 2 | Schema Migration | 1-2 hrs | Ready |
| 3 | Cleanup | 30 min | Ready |
| 4 | Verification | 30 min | Ready |
| 5 | Backend Updates | 2-4 hrs | Pending |
| 6 | Testing | 2-3 hrs | Pending |
| 7 | Deployment | 1 hr | Pending |

**Total:** 8-12 hours (1-2 days of focused work)

---

## Success Criteria

✅ All data migrated with 100% integrity
✅ All user_id columns are UUID type
✅ All foreign keys working correctly
✅ RLS policies enforced
✅ No deprecated tables remaining
✅ Backend code updated and tested
✅ Performance metrics maintained or improved
✅ Zero data loss
✅ Rollback tested and documented

---

## Conclusion

This clean schema design provides:
- **Simplicity:** 11 essential tables (down from 20+)
- **Consistency:** All UUID user_id columns
- **Clarity:** Intuitive naming and structure
- **Performance:** Proper indexes and constraints
- **Maintainability:** Easy to understand and extend
- **Scalability:** Ready for thousands of advisors

The schema is now "vibe code" friendly - intuitive, pleasant to work with, and error-resistant.


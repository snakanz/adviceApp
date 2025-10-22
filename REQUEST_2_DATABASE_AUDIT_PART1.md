# Request 2: Database Schema Audit & Redesign
## Part 1: Current Schema Audit

---

## Executive Summary

The Advicly database has **significant technical debt** with:
- ❌ Mixed UUID and INTEGER user_id columns causing foreign key errors
- ❌ Deprecated tables from old implementations (calendartoken, old calendar_integrations)
- ❌ Inconsistent naming conventions (userid vs advisor_id)
- ❌ Redundant columns and overly complex structure
- ❌ Multiple failed migration attempts creating confusion

**Goal:** Create a clean, minimal, well-architected schema that's intuitive and maintainable.

---

## Current Tables Inventory

### CORE TABLES (Active)

#### 1. **users** (UUID Primary Key)
- **Purpose:** User accounts and authentication
- **Status:** ✅ Active (recently migrated to UUID)
- **Columns:** id (UUID), email, name, provider, providerid, profilepicture, onboarding_completed, onboarding_step, business_name, timezone, created_at, updated_at
- **Issues:** None - well designed

#### 2. **meetings** (INTEGER Primary Key)
- **Purpose:** Meeting records from all sources
- **Status:** ⚠️ Active but problematic
- **Columns:** id (SERIAL), userid (TEXT/UUID mismatch), googleeventid, title, starttime, endtime, summary, transcript, notes, attendees (JSONB), client_id (UUID), meeting_source, is_deleted, sync_status, created_at, updated_at, + 15 more columns
- **Issues:**
  - ❌ userid is TEXT but should be UUID
  - ❌ Too many columns (30+) - bloated
  - ❌ Redundant columns: summary, description, notes
  - ❌ Sync tracking columns scattered (is_deleted, sync_status, last_calendar_sync, synced_via_webhook)

#### 3. **clients** (UUID Primary Key)
- **Purpose:** Client relationship management
- **Status:** ⚠️ Active but complex
- **Columns:** id (UUID), advisor_id (TEXT/UUID mismatch), email, name, business_type, likely_value, likely_close_month, pipeline_stage, priority_level, last_contact_date, next_follow_up_date, notes, tags, source, + 10 more columns
- **Issues:**
  - ❌ advisor_id is TEXT but should be UUID
  - ❌ Too many columns (25+) - should be split
  - ❌ Business data mixed with client data (should be separate table)
  - ❌ Pipeline data mixed with client data (should be separate table)

#### 4. **calendar_connections** (UUID Primary Key)
- **Purpose:** OAuth tokens for calendar integrations
- **Status:** ✅ Active and well-designed
- **Columns:** id (UUID), user_id (UUID), provider, access_token, refresh_token, token_expires_at, is_active, last_sync_at, created_at, updated_at
- **Issues:** None - good design

#### 5. **client_documents** (UUID Primary Key)
- **Purpose:** Document storage for clients
- **Status:** ✅ Active
- **Columns:** id (UUID), advisor_id (INTEGER), client_id (UUID), file_name, file_size, file_type, file_url, upload_source, meeting_id, created_at, updated_at
- **Issues:**
  - ⚠️ advisor_id is INTEGER (should be UUID)
  - ⚠️ Redundant with meeting_documents table

#### 6. **ask_threads** (UUID Primary Key)
- **Purpose:** AI chat conversation threads
- **Status:** ✅ Active
- **Columns:** id (UUID), advisor_id (INTEGER), client_id (UUID), title, created_at, updated_at, is_archived
- **Issues:**
  - ⚠️ advisor_id is INTEGER (should be UUID)

#### 7. **ask_messages** (UUID Primary Key)
- **Purpose:** Individual messages in chat threads
- **Status:** ✅ Active
- **Columns:** id (UUID), thread_id (UUID), role, content, metadata (JSONB), created_at
- **Issues:** None - well designed

#### 8. **transcript_action_items** (UUID Primary Key)
- **Purpose:** Action items extracted from meeting transcripts
- **Status:** ✅ Active
- **Columns:** id (UUID), advisor_id (INTEGER), meeting_id (INTEGER), action_item_text, priority, status, due_date, created_at, updated_at
- **Issues:**
  - ⚠️ advisor_id is INTEGER (should be UUID)
  - ⚠️ Redundant with pending_action_items table

#### 9. **client_business_types** (UUID Primary Key)
- **Purpose:** Business type details for clients
- **Status:** ✅ Active
- **Columns:** id (UUID), client_id (UUID), business_type, business_amount, regular_contribution, contribution_method, created_at, updated_at
- **Issues:** None - well designed

#### 10. **pipeline_activities** (UUID Primary Key)
- **Purpose:** Track client interactions and pipeline changes
- **Status:** ✅ Active
- **Columns:** id (UUID), client_id (UUID), advisor_id (INTEGER), activity_type, title, description, activity_date, metadata (JSONB), created_at
- **Issues:**
  - ⚠️ advisor_id is INTEGER (should be UUID)

#### 11. **client_todos** (UUID Primary Key)
- **Purpose:** Task management per client
- **Status:** ✅ Active
- **Columns:** id (UUID), client_id (UUID), advisor_id (INTEGER), title, description, priority, status, due_date, completed_at, created_at, updated_at, category
- **Issues:**
  - ⚠️ advisor_id is INTEGER (should be UUID)

#### 12. **pipeline_templates** (UUID Primary Key)
- **Purpose:** Reusable todo templates for pipeline stages
- **Status:** ✅ Active
- **Columns:** id (UUID), advisor_id (INTEGER), name, description, stage, todos (JSONB), is_active, created_at, updated_at
- **Issues:**
  - ⚠️ advisor_id is INTEGER (should be UUID)

---

## DEPRECATED/LEGACY TABLES (Should Be Removed)

#### ❌ **calendartoken** (OLD)
- **Purpose:** Old OAuth token storage (replaced by calendar_connections)
- **Status:** DEPRECATED - Do not use
- **Action:** DROP TABLE

#### ❌ **meeting_documents** (OLD)
- **Purpose:** Old document storage (replaced by client_documents)
- **Status:** DEPRECATED - Consolidated into client_documents
- **Action:** DROP TABLE (after data migration)

#### ❌ **pending_action_items** (OLD)
- **Purpose:** Old action items (replaced by transcript_action_items)
- **Status:** DEPRECATED - Redundant
- **Action:** DROP TABLE (after data migration)

#### ❌ **advisor_tasks** (OLD)
- **Purpose:** Ad-hoc tasks (should be merged with client_todos)
- **Status:** DEPRECATED - Redundant
- **Action:** DROP TABLE (after data migration)

#### ❌ **calendar_watch_channels** (OLD)
- **Purpose:** Google Calendar webhook tracking
- **Status:** DEPRECATED - Functionality moved to calendar_connections
- **Action:** DROP TABLE

---

## Schema Inconsistencies

### Issue 1: Mixed User ID Types
| Table | Column | Type | Should Be |
|-------|--------|------|-----------|
| users | id | UUID | ✅ Correct |
| meetings | userid | TEXT | ❌ Should be UUID |
| clients | advisor_id | TEXT | ❌ Should be UUID |
| ask_threads | advisor_id | INTEGER | ❌ Should be UUID |
| client_documents | advisor_id | INTEGER | ❌ Should be UUID |
| transcript_action_items | advisor_id | INTEGER | ❌ Should be UUID |
| client_todos | advisor_id | INTEGER | ❌ Should be UUID |
| pipeline_activities | advisor_id | INTEGER | ❌ Should be UUID |
| pipeline_templates | advisor_id | INTEGER | ❌ Should be UUID |

### Issue 2: Redundant Columns
- **meetings.summary** vs **meetings.description** vs **meetings.notes** - Pick one
- **clients.likely_value** vs **client_business_types.business_amount** - Redundant
- **transcript_action_items** vs **pending_action_items** - Duplicate tables
- **meeting_documents** vs **client_documents** - Duplicate tables

### Issue 3: Overly Complex Tables
- **meetings:** 30+ columns (should be 15-20)
- **clients:** 25+ columns (should be 10-15, split business data)

---

## Foreign Key Issues

### Missing or Broken Foreign Keys
- ❌ meetings.userid → users.id (type mismatch: TEXT vs UUID)
- ❌ clients.advisor_id → users.id (type mismatch: TEXT vs UUID)
- ❌ ask_threads.advisor_id → users.id (type mismatch: INTEGER vs UUID)
- ⚠️ No CASCADE DELETE on some relationships

### Correct Foreign Keys
- ✅ calendar_connections.user_id → users.id (UUID)
- ✅ client_documents.client_id → clients.id (UUID)
- ✅ ask_messages.thread_id → ask_threads.id (UUID)

---

## RLS Policy Issues

### Current State
- ⚠️ Inconsistent RLS policies across tables
- ⚠️ Some tables use `advisor_id = auth.uid()`, others use `userid = auth.uid()`
- ⚠️ Type mismatches prevent RLS from working correctly

### Required Fixes
- Standardize all RLS policies to use `advisor_id = auth.uid()`
- Ensure all advisor_id columns are UUID type
- Test RLS policies after migration

---

## Summary of Issues

| Issue | Severity | Count | Impact |
|-------|----------|-------|--------|
| Mixed UUID/INTEGER user_id | 🔴 Critical | 9 tables | Foreign key errors, RLS failures |
| Redundant tables | 🟠 High | 4 tables | Confusion, data inconsistency |
| Redundant columns | 🟠 High | 5+ columns | Confusion, maintenance burden |
| Overly complex tables | 🟡 Medium | 2 tables | Hard to understand, error-prone |
| Missing CASCADE DELETE | 🟡 Medium | 3+ relationships | Orphaned data |
| Inconsistent naming | 🟡 Medium | Throughout | Confusion, bugs |

---

## Next Steps

See **REQUEST_2_DATABASE_AUDIT_PART2.md** for:
1. Clean schema design
2. Migration plan
3. SQL scripts
4. ERD diagram
5. Documentation


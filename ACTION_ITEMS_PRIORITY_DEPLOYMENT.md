# 🚀 Action Items Priority System - Deployment Guide

## ✅ What's Been Implemented

I've successfully implemented **Issue 2: Action Items - Inline Editing and AI Priority System** with the following features:

### **Backend Implementation (COMPLETE)**

#### 1. **Database Schema**
- ✅ Created migration `017_add_action_items_priority.sql`
- ✅ Adds `priority` INTEGER column to `transcript_action_items` table
- ✅ Priority scale: 1 (Urgent) to 4 (Low)
- ✅ Default value: 3 (Medium)
- ✅ Includes validation constraint and index

#### 2. **New API Endpoints**

**Inline Editing:**
- ✅ `PATCH /api/transcript-action-items/action-items/:actionItemId/text`
  - Update action item text
  - Request body: `{ "actionText": "Updated text" }`
  - Returns updated action item

**AI Priority Assignment:**
- ✅ `POST /api/transcript-action-items/action-items/assign-priorities`
  - Uses OpenAI GPT-4o-mini to analyze and assign priorities
  - Request body: `{ "actionItemIds": ["uuid1", "uuid2"] }` (optional - if omitted, processes all items)
  - Considers keywords, urgency, client context, meeting details
  - Returns updated action items with assigned priorities

**Enhanced Fetching with Filtering/Sorting:**
- ✅ `GET /api/transcript-action-items/action-items/by-client?priorityFilter=1&sortBy=priority`
  - Query params:
    - `priorityFilter`: Filter by priority level (1-4 or "all")
    - `sortBy`: Sort by "priority" or default (creation date)
  - Returns action items grouped by client

- ✅ `GET /api/transcript-action-items/action-items/all?priorityFilter=2&sortBy=priority`
  - Query params: same as above
  - Returns all action items (not grouped) sorted by priority

#### 3. **AI Priority Logic**
The AI analyzes each action item considering:
- **Keywords**: "urgent", "ASAP", "deadline", "today", "tomorrow", "this week"
- **Time-sensitive language**: Dates, deadlines, time references
- **Client importance**: Client name and context
- **Meeting context**: Meeting title and date
- **Regulatory/compliance**: Higher priority for compliance-related items

**Priority Levels:**
- **1 = Urgent**: Time-sensitive, critical, requires immediate attention
- **2 = High**: Important but not immediately urgent, should be done soon
- **3 = Medium**: Standard priority, can be scheduled normally
- **4 = Low**: Nice to have, can be done when time permits

---

## 🔧 Required: Run Database Migration

**⚠️ IMPORTANT:** You need to run the migration to add the `priority` column to the database.

### **Option 1: Supabase SQL Editor (Recommended)**

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your Advicly project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste This SQL:**

```sql
-- Add Priority Column to Action Items
-- This migration adds a priority field to transcript_action_items for AI-powered prioritization

-- Add priority column to transcript_action_items table
ALTER TABLE transcript_action_items 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4);

-- Add comment for documentation
COMMENT ON COLUMN transcript_action_items.priority IS 'AI-assigned priority level: 1=Urgent, 2=High, 3=Medium, 4=Low';

-- Create index for faster filtering by priority
CREATE INDEX IF NOT EXISTS idx_transcript_action_items_priority ON transcript_action_items(priority);
```

4. **Click "Run"**

5. **Verify Success**
   - You should see "Success. No rows returned"
   - The `priority` column is now added to the `transcript_action_items` table

---

## 📋 Next Steps: Frontend Implementation

The backend is complete and deployed. Now we need to implement the frontend features:

### **Part A: Inline Editing for Action Items**
- [ ] Add click-to-edit functionality for action item text
- [ ] Show edit mode with input field when clicked
- [ ] Save on blur or Enter key
- [ ] Show loading state during save
- [ ] Update UI with new text after save

### **Part B: AI Priority Display**
- [ ] Display priority badge/indicator for each action item
- [ ] Color-code priorities:
  - Priority 1 (Urgent): Red
  - Priority 2 (High): Orange
  - Priority 3 (Medium): Yellow
  - Priority 4 (Low): Green
- [ ] Add "Assign Priorities" button to trigger AI analysis
- [ ] Show loading state during AI processing

### **Part C: Filtering and Sorting**
- [ ] Add priority filter dropdown (All, Urgent, High, Medium, Low)
- [ ] Add sort toggle (Priority / Date)
- [ ] Update API calls to include filter/sort params
- [ ] Refresh action items list when filters change

### **Part D: Grouping Views**
- [ ] Add view toggle: "By Client" vs "All Items"
- [ ] "By Client" view: Group action items by client name
- [ ] "All Items" view: Show all action items in a single list
- [ ] Both views should support priority sorting

---

## 🧪 Testing the Backend

Once the migration is run, you can test the backend endpoints:

### **1. Test Inline Editing**
```bash
curl -X PATCH https://your-backend.onrender.com/api/transcript-action-items/action-items/{actionItemId}/text \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"actionText": "Updated action item text"}'
```

### **2. Test AI Priority Assignment**
```bash
curl -X POST https://your-backend.onrender.com/api/transcript-action-items/action-items/assign-priorities \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"actionItemIds": []}'  # Empty array = process all items
```

### **3. Test Filtering by Priority**
```bash
curl -X GET "https://your-backend.onrender.com/api/transcript-action-items/action-items/all?priorityFilter=1&sortBy=priority" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📊 Summary

| Feature | Status |
|---------|--------|
| ✅ Database migration created | **COMPLETE** |
| ⏳ Database migration run | **PENDING** (manual step required) |
| ✅ Backend API endpoints | **COMPLETE** |
| ✅ AI priority logic | **COMPLETE** |
| ✅ Inline editing endpoint | **COMPLETE** |
| ✅ Filtering/sorting endpoints | **COMPLETE** |
| ⏳ Frontend implementation | **PENDING** |

---

## 🎯 What to Do Next

1. **Run the database migration** (see instructions above)
2. **Let me know when the migration is complete** so I can implement the frontend
3. **Test the backend endpoints** to verify everything works

Once you confirm the migration is complete, I'll implement the frontend features for inline editing, AI priority display, filtering, and grouping views!


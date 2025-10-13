# Pipeline Data Synchronization Analysis

## 🔍 Current State Analysis

### **Data Model - TWO Sources of Truth (PROBLEM!)**

#### **Source 1: `clients` table columns**
```sql
- pipeline_stage TEXT
- business_type TEXT (single value)
- business_amount NUMERIC
- iaf_expected NUMERIC
- regular_contribution_type TEXT
- regular_contribution_amount TEXT
- likely_close_month TEXT
- notes TEXT
```

#### **Source 2: `client_business_types` table (separate table)**
```sql
CREATE TABLE client_business_types (
    id UUID PRIMARY KEY,
    client_id UUID REFERENCES clients(id),
    business_type TEXT,
    business_amount NUMERIC,
    contribution_method TEXT,
    regular_contribution_amount TEXT,
    iaf_expected NUMERIC,
    notes TEXT
)
```

### **🚨 THE PROBLEM: Data Redundancy**

The same pipeline data exists in TWO places:
1. **`clients.business_amount`** vs **`client_business_types.business_amount`**
2. **`clients.iaf_expected`** vs **`client_business_types.iaf_expected`**
3. **`clients.business_type`** (single) vs **`client_business_types.business_type`** (multiple)

This causes:
- ❌ Data inconsistency between views
- ❌ Different values shown on Clients page vs Pipeline page
- ❌ Updates in one place don't reflect in the other
- ❌ Confusion about which is the "real" value

---

## 📊 Current Read Operations

### **Backend Endpoints Reading Pipeline Data:**

1. **`GET /api/clients`** (Clients.js page)
   - Reads from: `clients` table only
   - Returns: `business_type`, `iaf_expected`, `business_amount`, `pipeline_stage`
   - **Does NOT join with `client_business_types`**

2. **`GET /api/pipeline`** (Pipeline.js page)
   - Reads from: `clients` table only
   - Returns: `business_type`, `likely_value`, `pipeline_stage`
   - **Does NOT join with `client_business_types`**

3. **`GET /api/clients/:clientId`** (Client detail view)
   - Reads from: `clients` table only
   - Returns: All client fields including pipeline data
   - **Does NOT join with `client_business_types`**

4. **`GET /api/clients/:clientId/business-types`** (Business Types Manager)
   - Reads from: `client_business_types` table ONLY
   - Returns: Array of business types with amounts
   - **Completely separate from clients table data**

### **Frontend Components Reading Pipeline Data:**

1. **Clients.js**
   - Displays: `client.business_type`, `client.iaf_expected`, `client.business_amount`
   - Source: `clients` table via `/api/clients`

2. **Pipeline.js**
   - Displays: `client.business_type`, `client.likely_value`
   - Source: `clients` table via `/api/pipeline`

3. **Client Detail Panel** (in Clients.js)
   - Displays: `client.business_type`, `client.iaf_expected`, `client.business_amount`
   - Source: `clients` table

4. **BusinessTypeManager.js**
   - Displays: Array of business types from `client_business_types`
   - Source: `client_business_types` table via `/api/clients/:clientId/business-types`

---

## ✍️ Current Write Operations

### **Backend Endpoints Writing Pipeline Data:**

1. **`POST /api/clients/:clientId/pipeline-entry`** (PipelineEntryForm)
   - Writes to: `clients` table ONLY
   - Updates: `pipeline_stage`, `business_type`, `business_amount`, `iaf_expected`, etc.
   - **Does NOT update `client_business_types`**

2. **`POST /api/clients/update-name`** (Edit Client modal)
   - Writes to: `clients` table ONLY
   - Updates: `business_type`, `iaf_expected`, `business_amount`, etc.
   - **Does NOT update `client_business_types`**

3. **`PUT /api/clients/:clientId/business-types`** (BusinessTypeManager)
   - Writes to: `client_business_types` table ONLY
   - Deletes all existing, inserts new business types
   - **Does NOT update `clients` table**

4. **`POST /api/clients/create`** (CreateClientForm)
   - Writes to: BOTH tables
   - Creates client in `clients` table
   - Creates business types in `client_business_types` table
   - **This is the ONLY endpoint that writes to both!**

5. **`PUT /api/pipeline/:clientId`** (Pipeline page updates)
   - Writes to: `clients` table ONLY
   - Updates: `pipeline_stage`, `likely_close_month`, `priority_level`
   - **Does NOT update `client_business_types`**

---

## 🎯 Root Cause of Synchronization Issues

### **Scenario 1: User adds pipeline entry**
1. User clicks "Pipeline" button on client
2. Fills out PipelineEntryForm with:
   - Business Type: "Pension"
   - IAF Expected: £5,000
   - Business Amount: £250,000
3. Form submits to `POST /api/clients/:clientId/pipeline-entry`
4. **Updates `clients` table** with these values
5. **Does NOT update `client_business_types` table**
6. Result: `clients` table has data, `client_business_types` is empty

### **Scenario 2: User manages business types**
1. User clicks "Business Types" button on client
2. Adds multiple business types in BusinessTypeManager:
   - Pension: £100,000, IAF £3,000
   - ISA: £50,000, IAF £1,500
3. Form submits to `PUT /api/clients/:clientId/business-types`
4. **Updates `client_business_types` table** with these values
5. **Does NOT update `clients` table**
6. Result: `client_business_types` has data, `clients` table has old/different data

### **Scenario 3: User views client in different places**
1. On Clients page: Shows `clients.iaf_expected` = £5,000
2. On Pipeline page: Shows `clients.likely_value` = £5,000
3. In Business Types manager: Shows sum of `client_business_types.iaf_expected` = £4,500
4. **All three show different values!**

---

## ✅ Recommended Solution

### **Option A: Use `client_business_types` as Single Source of Truth (RECOMMENDED)**

**Rationale:**
- Supports multiple business types per client (more flexible)
- Already has contribution methods (Transfer, Regular, Lump Sum)
- More detailed and structured data model
- Future-proof for complex scenarios

**Changes Required:**

1. **Deprecate pipeline columns in `clients` table**
   - Keep `pipeline_stage` and `likely_close_month` (these are client-level, not business-type-level)
   - Remove/ignore: `business_type`, `business_amount`, `iaf_expected`, `regular_contribution_type`, `regular_contribution_amount`

2. **Update ALL read operations to join with `client_business_types`**
   - `/api/clients` - Join and aggregate business types
   - `/api/pipeline` - Join and aggregate business types
   - `/api/clients/:clientId` - Join and include business types array

3. **Update ALL write operations to use `client_business_types`**
   - `POST /api/clients/:clientId/pipeline-entry` - Write to `client_business_types`
   - `POST /api/clients/update-name` - Write to `client_business_types`
   - Keep `PUT /api/clients/:clientId/business-types` as-is

4. **Frontend changes**
   - Update all components to use aggregated business type data
   - Display total amounts (sum of all business types)
   - Show business type badges/list

### **Option B: Use `clients` table as Single Source of Truth**

**Rationale:**
- Simpler data model
- Faster queries (no joins needed)
- Works if clients only have ONE business type

**Changes Required:**

1. **Drop `client_business_types` table**
   - Migrate any existing data to `clients` table
   - Remove all references to the table

2. **Keep all current read/write operations**
   - They already use `clients` table

3. **Remove BusinessTypeManager component**
   - Use simple edit form instead

**Downside:** Cannot support multiple business types per client

---

## 🎯 Recommended Approach: **Option A**

Use `client_business_types` as the single source of truth because:
1. ✅ Supports multiple business types (more flexible)
2. ✅ More detailed data model
3. ✅ Already implemented and working
4. ✅ Future-proof

---

## 📝 Implementation Plan

### **Phase 1: Backend Changes**

1. Update `GET /api/clients` to join with `client_business_types`
2. Update `GET /api/pipeline` to join with `client_business_types`
3. Update `GET /api/clients/:clientId` to join with `client_business_types`
4. Update `POST /api/clients/:clientId/pipeline-entry` to write to `client_business_types`
5. Update `POST /api/clients/update-name` to write to `client_business_types`
6. Add aggregation logic to calculate totals

### **Phase 2: Frontend Changes**

1. Update Clients.js to display aggregated business type data
2. Update Pipeline.js to display aggregated business type data
3. Update PipelineEntryForm to work with business types array
4. Update client detail panel to show business types list
5. Add total amount calculations

### **Phase 3: Data Migration**

1. Migrate existing `clients` table data to `client_business_types`
2. Verify data integrity
3. (Optional) Remove deprecated columns from `clients` table

### **Phase 4: Testing**

1. Test pipeline entry creation
2. Test business type management
3. Test data consistency across all views
4. Test aggregation calculations

---

## 🔧 Next Steps

1. **Confirm approach** with user
2. **Implement backend changes** (Phase 1)
3. **Implement frontend changes** (Phase 2)
4. **Run data migration** (Phase 3)
5. **Test thoroughly** (Phase 4)


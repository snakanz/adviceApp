# Database Schema

This document describes the Supabase PostgreSQL database schema for the Advicly platform.

## Tables Overview

The database consists of the following main tables:
- `users` - User accounts and authentication
- `calendartoken` - OAuth tokens for calendar integration
- `meetings` - Meeting records and metadata
- `clients` - Client relationship management
- `actionitems` - Meeting action items (future)
- `recordings` - Meeting recordings (future)

## Table Definitions

### users
Stores user account information and OAuth data.

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    provider TEXT NOT NULL, -- 'google'
    providerid TEXT NOT NULL, -- OAuth provider user ID
    googleaccesstoken TEXT,
    googlerefreshtoken TEXT,
    profilepicture TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### calendartoken
Stores OAuth tokens for calendar access.

```sql
CREATE TABLE calendartoken (
    id TEXT PRIMARY KEY,
    userid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    accesstoken TEXT NOT NULL,
    refreshtoken TEXT,
    expiresat TIMESTAMP WITH TIME ZONE NOT NULL,
    provider TEXT NOT NULL, -- 'google'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(userid)
);
```

### meetings
Stores meeting information from calendar integration.

```sql
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    userid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    googleeventid TEXT NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    starttime TIMESTAMP WITH TIME ZONE NOT NULL,
    endtime TIMESTAMP WITH TIME ZONE,
    summary TEXT, -- Meeting description
    transcript TEXT,
    notes TEXT,
    attendees JSONB, -- Array of attendee objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(googleeventid, userid)
);

CREATE INDEX meetings_userid_idx ON meetings(userid);
CREATE INDEX meetings_googleeventid_idx ON meetings(googleeventid);
CREATE INDEX meetings_client_id_idx ON meetings(client_id);
```

### clients
Stores client information and pipeline data.

```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    business_type TEXT,
    likely_value NUMERIC,
    likely_close_month DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(advisor_id, email)
);

CREATE INDEX clients_advisor_id_idx ON clients(advisor_id);
```

## Relationships

- `users` → `calendartoken` (1:1) - Each user has one set of calendar tokens
- `users` → `meetings` (1:many) - Users can have multiple meetings
- `users` → `clients` (1:many) - Advisors can have multiple clients
- `clients` → `meetings` (1:many) - Clients can have multiple meetings

## Row Level Security (RLS)

Enable RLS on all tables for production:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendartoken ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own data" ON users FOR ALL USING (id = auth.uid()::text);
CREATE POLICY "Calendar tokens for own user" ON calendartoken FOR ALL USING (userid = auth.uid()::text);
CREATE POLICY "Meetings for own user" ON meetings FOR ALL USING (userid = auth.uid()::text);
CREATE POLICY "Clients for own advisor" ON clients FOR ALL USING (advisor_id = auth.uid()::text);
```

## Indexes

Key indexes for performance:
- `users.email` (unique)
- `calendartoken.userid` (unique)
- `meetings.userid`
- `meetings.googleeventid`
- `meetings.client_id`
- `clients.advisor_id`

## Migration Notes

When migrating from legacy systems:
1. Ensure all foreign key relationships are maintained
2. Convert any SQLite-specific syntax to PostgreSQL
3. Update timestamp columns to use `TIMESTAMP WITH TIME ZONE`
4. Enable RLS policies for security
5. Create appropriate indexes for query performance

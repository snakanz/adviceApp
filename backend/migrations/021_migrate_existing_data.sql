-- ============================================================================
-- MIGRATE EXISTING DATA TO MULTI-TENANT ARCHITECTURE
-- ============================================================================
-- This script migrates existing users and their data to the new multi-tenant
-- architecture. Run this AFTER running 020_multi_tenant_onboarding.sql
--
-- What this does:
-- 1. Creates a tenant for each existing user
-- 2. Links users to their tenants as owners
-- 3. Updates all user data with tenant_id
-- 4. Migrates calendar tokens to calendar_connections table
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE TENANTS FOR EXISTING USERS
-- ============================================================================

DO $$
DECLARE
    user_record RECORD;
    new_tenant_id UUID;
    migrated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Starting data migration to multi-tenant architecture...';
    
    -- Loop through all users who don't have a tenant yet
    FOR user_record IN 
        SELECT id, email, name, business_name, timezone 
        FROM users 
        WHERE tenant_id IS NULL
    LOOP
        -- Create tenant for this user
        INSERT INTO tenants (
            name, 
            owner_id, 
            business_type,
            timezone
        )
        VALUES (
            COALESCE(user_record.business_name, user_record.name || '''s Business', 'My Business'),
            user_record.id,
            'Financial Advisor',
            COALESCE(user_record.timezone, 'UTC')
        )
        RETURNING id INTO new_tenant_id;
        
        -- Add user as tenant owner in tenant_members
        INSERT INTO tenant_members (tenant_id, user_id, role)
        VALUES (new_tenant_id, user_record.id, 'owner');
        
        -- Update user with tenant_id
        UPDATE users 
        SET tenant_id = new_tenant_id 
        WHERE id = user_record.id;
        
        -- Update all user's meetings with tenant_id
        UPDATE meetings
        SET tenant_id = new_tenant_id
        WHERE userid = user_record.id
        AND tenant_id IS NULL;

        -- Update all user's clients with tenant_id
        UPDATE clients
        SET tenant_id = new_tenant_id
        WHERE advisor_id = user_record.id
        AND tenant_id IS NULL;
        
        -- Update advisor_tasks if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advisor_tasks') THEN
            EXECUTE format('UPDATE advisor_tasks SET tenant_id = %L WHERE advisor_id = %L AND tenant_id IS NULL', 
                new_tenant_id, user_record.id);
        END IF;
        
        -- Update client_documents if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_documents') THEN
            EXECUTE format('UPDATE client_documents SET tenant_id = %L WHERE advisor_id = %L AND tenant_id IS NULL', 
                new_tenant_id, user_record.id);
        END IF;
        
        -- Update ask_threads if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads') THEN
            EXECUTE format('UPDATE ask_threads SET tenant_id = %L WHERE advisor_id = %L AND tenant_id IS NULL', 
                new_tenant_id, user_record.id);
        END IF;
        
        -- Update transcript_action_items if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_action_items') THEN
            EXECUTE format('UPDATE transcript_action_items SET tenant_id = %L WHERE advisor_id = %L AND tenant_id IS NULL', 
                new_tenant_id, user_record.id);
        END IF;
        
        migrated_count := migrated_count + 1;
        RAISE NOTICE '✅ Created tenant % for user % (%)', new_tenant_id, user_record.email, user_record.name;
    END LOOP;
    
    RAISE NOTICE '✅ Migration complete! Migrated % users to multi-tenant architecture', migrated_count;
END $$;

-- ============================================================================
-- STEP 2: MIGRATE CALENDAR TOKENS TO CALENDAR_CONNECTIONS
-- ============================================================================

DO $$
DECLARE
    token_record RECORD;
    migrated_tokens INTEGER := 0;
    user_tenant_id UUID;
BEGIN
    RAISE NOTICE '🔄 Migrating calendar tokens to calendar_connections...';
    
    -- Check if calendartoken table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendartoken') THEN
        RAISE NOTICE '⚠️  calendartoken table does not exist, skipping token migration';
        RETURN;
    END IF;
    
    -- Loop through all calendar tokens
    FOR token_record IN 
        SELECT 
            userid,
            accesstoken,
            refreshtoken,
            expiresat,
            provider,
            updatedat
        FROM calendartoken
    LOOP
        -- Get the user's tenant_id
        SELECT tenant_id INTO user_tenant_id
        FROM users
        WHERE id = token_record.userid;
        
        -- Skip if user doesn't have a tenant (shouldn't happen after step 1)
        IF user_tenant_id IS NULL THEN
            RAISE WARNING '⚠️  User % has no tenant, skipping calendar token migration', token_record.userid;
            CONTINUE;
        END IF;
        
        -- Insert into calendar_connections (skip if already exists)
        INSERT INTO calendar_connections (
            user_id,
            tenant_id,
            provider,
            provider_account_email,
            access_token,
            refresh_token,
            token_expires_at,
            is_primary,
            is_active,
            sync_enabled,
            created_at,
            updated_at
        )
        SELECT
            u.id,
            user_tenant_id,
            token_record.provider,
            u.email, -- Use user's email as provider account email
            token_record.accesstoken,
            token_record.refreshtoken,
            token_record.expiresat,
            true, -- Set as primary
            true, -- Set as active
            true, -- Enable sync
            COALESCE(token_record.updatedat, NOW()),
            NOW()
        FROM users u
        WHERE u.id = token_record.userid
        ON CONFLICT (user_id, provider, provider_account_email) DO NOTHING;
        
        IF FOUND THEN
            migrated_tokens := migrated_tokens + 1;
            RAISE NOTICE '✅ Migrated % calendar token for user %', token_record.provider, token_record.userid;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Calendar token migration complete! Migrated % tokens', migrated_tokens;
END $$;

-- ============================================================================
-- STEP 3: LINK MEETINGS TO CALENDAR CONNECTIONS
-- ============================================================================

DO $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Linking meetings to calendar connections...';
    
    -- Update meetings to link to their calendar connection
    -- This links based on user and meeting source (google/calendly)
    UPDATE meetings m
    SET calendar_connection_id = (
        SELECT cc.id
        FROM calendar_connections cc
        WHERE cc.user_id = m.userid
        AND cc.provider = COALESCE(m.meeting_source, 'google')
        AND cc.is_active = true
        LIMIT 1
    )
    WHERE calendar_connection_id IS NULL
    AND EXISTS (
        SELECT 1
        FROM calendar_connections cc
        WHERE cc.user_id = m.userid
        AND cc.provider = COALESCE(m.meeting_source, 'google')
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE '✅ Linked % meetings to calendar connections', updated_count;
END $$;

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

DO $$
DECLARE
    tenant_count INTEGER;
    user_count INTEGER;
    users_without_tenant INTEGER;
    meetings_without_tenant INTEGER;
    clients_without_tenant INTEGER;
    calendar_connections_count INTEGER;
BEGIN
    RAISE NOTICE '📊 Running verification checks...';
    
    -- Count tenants
    SELECT COUNT(*) INTO tenant_count FROM tenants;
    RAISE NOTICE '   Tenants created: %', tenant_count;
    
    -- Count users
    SELECT COUNT(*) INTO user_count FROM users;
    RAISE NOTICE '   Total users: %', user_count;
    
    -- Count users without tenant
    SELECT COUNT(*) INTO users_without_tenant FROM users WHERE tenant_id IS NULL;
    IF users_without_tenant > 0 THEN
        RAISE WARNING '   ⚠️  Users without tenant: %', users_without_tenant;
    ELSE
        RAISE NOTICE '   ✅ All users have tenants';
    END IF;
    
    -- Count meetings without tenant
    SELECT COUNT(*) INTO meetings_without_tenant FROM meetings WHERE tenant_id IS NULL;
    IF meetings_without_tenant > 0 THEN
        RAISE WARNING '   ⚠️  Meetings without tenant: %', meetings_without_tenant;
    ELSE
        RAISE NOTICE '   ✅ All meetings have tenants';
    END IF;
    
    -- Count clients without tenant
    SELECT COUNT(*) INTO clients_without_tenant FROM clients WHERE tenant_id IS NULL;
    IF clients_without_tenant > 0 THEN
        RAISE WARNING '   ⚠️  Clients without tenant: %', clients_without_tenant;
    ELSE
        RAISE NOTICE '   ✅ All clients have tenants';
    END IF;
    
    -- Count calendar connections
    SELECT COUNT(*) INTO calendar_connections_count FROM calendar_connections;
    RAISE NOTICE '   Calendar connections: %', calendar_connections_count;
    
    RAISE NOTICE '✅ Verification complete!';
END $$;

-- ============================================================================
-- STEP 5: OPTIONAL - BACKUP OLD CALENDARTOKEN TABLE
-- ============================================================================

-- Rename the old calendartoken table to keep as backup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendartoken') THEN
        ALTER TABLE calendartoken RENAME TO _backup_calendartoken;
        RAISE NOTICE '✅ Renamed calendartoken table to _backup_calendartoken';
        RAISE NOTICE '   You can drop this table later with: DROP TABLE _backup_calendartoken;';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ DATA MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify all data migrated correctly';
    RAISE NOTICE '2. Test logging in with existing users';
    RAISE NOTICE '3. Update backend code to use new tables';
    RAISE NOTICE '4. Deploy backend changes';
    RAISE NOTICE '5. Test onboarding flow with new users';
    RAISE NOTICE '';
END $$;


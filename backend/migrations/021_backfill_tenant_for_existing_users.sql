-- Migration: Backfill tenant_id for existing users who don't have one
-- This creates a tenant for each user who signed up before the multi-tenant migration

-- Create a function to auto-create tenant for existing users
CREATE OR REPLACE FUNCTION backfill_tenant_for_user(user_id_param UUID)
RETURNS UUID AS $$
DECLARE
    new_tenant_id UUID;
    user_email TEXT;
    user_name TEXT;
BEGIN
    -- Get user details
    SELECT email, name INTO user_email, user_name
    FROM users
    WHERE id = user_id_param;

    -- Create a new tenant for this user
    INSERT INTO tenants (name, owner_id, created_at)
    VALUES (
        COALESCE(user_name, user_email, 'My Business'),
        user_id_param,
        NOW()
    )
    RETURNING id INTO new_tenant_id;

    -- Update the user's tenant_id
    UPDATE users
    SET tenant_id = new_tenant_id
    WHERE id = user_id_param;

    -- Return the new tenant_id
    RETURN new_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Backfill tenant_id for all users who don't have one
DO $$
DECLARE
    user_record RECORD;
    new_tenant_id UUID;
BEGIN
    FOR user_record IN 
        SELECT id, email, name 
        FROM users 
        WHERE tenant_id IS NULL
    LOOP
        -- Create tenant for this user
        new_tenant_id := backfill_tenant_for_user(user_record.id);
        
        RAISE NOTICE 'Created tenant % for user % (%)', 
            new_tenant_id, user_record.email, user_record.id;
    END LOOP;
END $$;

-- Update calendar_connections to set tenant_id where it's null
UPDATE calendar_connections cc
SET tenant_id = u.tenant_id
FROM users u
WHERE cc.user_id = u.id
  AND cc.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL;

-- Verify the migration
DO $$
DECLARE
    users_without_tenant INTEGER;
    connections_without_tenant INTEGER;
BEGIN
    SELECT COUNT(*) INTO users_without_tenant
    FROM users
    WHERE tenant_id IS NULL;

    SELECT COUNT(*) INTO connections_without_tenant
    FROM calendar_connections
    WHERE tenant_id IS NULL;

    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  - Users without tenant_id: %', users_without_tenant;
    RAISE NOTICE '  - Calendar connections without tenant_id: %', connections_without_tenant;
END $$;


-- =====================================================
-- DELETE TEST USER AND ALL RELATED DATA
-- =====================================================
-- This script safely removes a test user and all their data
-- Replace 'test@example.com' with your actual test email
-- =====================================================

-- Step 1: Get the user ID and delete all related data
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'test@example.com';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found: test@example.com';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found user: % with ID: %', 'test@example.com', v_user_id;
    
    -- Step 2: Delete all related data (CASCADE will handle most, but be explicit)
    
    -- Delete ask messages (depends on ask_threads)
    DELETE FROM ask_messages 
    WHERE thread_id IN (SELECT id FROM ask_threads WHERE user_id = v_user_id);
    RAISE NOTICE 'Deleted ask_messages';
    
    -- Delete ask threads
    DELETE FROM ask_threads WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted ask_threads';
    
    -- Delete client todos
    DELETE FROM client_todos WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted client_todos';
    
    -- Delete client documents
    DELETE FROM client_documents WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted client_documents';
    
    -- Delete client business types (depends on clients)
    DELETE FROM client_business_types 
    WHERE client_id IN (SELECT id FROM clients WHERE user_id = v_user_id);
    RAISE NOTICE 'Deleted client_business_types';
    
    -- Delete transcript action items
    DELETE FROM transcript_action_items WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted transcript_action_items';
    
    -- Delete pipeline activities
    DELETE FROM pipeline_activities WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted pipeline_activities';
    
    -- Delete meetings
    DELETE FROM meetings WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted meetings';
    
    -- Delete clients (CASCADE will handle client_business_types)
    DELETE FROM clients WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted clients';
    
    -- Delete calendar connections
    DELETE FROM calendar_connections WHERE user_id = v_user_id;
    RAISE NOTICE 'Deleted calendar_connections';
    
    -- Delete tenants owned by user
    DELETE FROM tenants WHERE owner_id = v_user_id;
    RAISE NOTICE 'Deleted tenants';
    
    -- Step 3: Delete the user
    DELETE FROM users WHERE id = v_user_id;
    RAISE NOTICE 'Deleted user: %', v_user_id;
    
    RAISE NOTICE 'User and all related data successfully deleted!';
END $$;

-- Verify deletion
SELECT COUNT(*) as remaining_users FROM users WHERE email = 'test@example.com';


-- ============================================================================
-- Microsoft Calendar Connection Diagnostic Script
-- Run this in Supabase SQL Editor to check connection status
-- ============================================================================

-- 1. Check all Microsoft calendar connections
SELECT 
  '📊 MICROSOFT CALENDAR CONNECTIONS' as section,
  '' as spacer;

SELECT 
  id,
  user_id,
  provider_account_email,
  is_active,
  CASE 
    WHEN refresh_token IS NOT NULL THEN '✅ Present'
    ELSE '❌ Missing'
  END as refresh_token_status,
  CASE 
    WHEN access_token IS NOT NULL THEN '✅ Present'
    ELSE '❌ Missing'
  END as access_token_status,
  CASE 
    WHEN token_expires_at > NOW() THEN '✅ Valid'
    WHEN token_expires_at IS NULL THEN '⚠️ Unknown'
    ELSE '❌ Expired'
  END as token_status,
  token_expires_at,
  created_at,
  updated_at
FROM calendar_connections
WHERE provider = 'microsoft'
ORDER BY created_at DESC;

-- 2. Count connections by status
SELECT 
  '📈 CONNECTION STATISTICS' as section,
  '' as spacer;

SELECT 
  COUNT(*) as total_connections,
  COUNT(CASE WHEN is_active THEN 1 END) as active_connections,
  COUNT(CASE WHEN refresh_token IS NOT NULL THEN 1 END) as with_refresh_token,
  COUNT(CASE WHEN refresh_token IS NULL THEN 1 END) as missing_refresh_token,
  COUNT(CASE WHEN token_expires_at > NOW() THEN 1 END) as valid_tokens,
  COUNT(CASE WHEN token_expires_at <= NOW() THEN 1 END) as expired_tokens
FROM calendar_connections
WHERE provider = 'microsoft';

-- 3. Find connections that need fixing
SELECT 
  '⚠️ CONNECTIONS NEEDING ATTENTION' as section,
  '' as spacer;

SELECT 
  id,
  user_id,
  provider_account_email,
  CASE 
    WHEN refresh_token IS NULL THEN '❌ Missing refresh token - User needs to re-authenticate'
    WHEN token_expires_at <= NOW() THEN '⏰ Token expired - Will auto-refresh if refresh_token exists'
    ELSE '✅ OK'
  END as issue,
  created_at
FROM calendar_connections
WHERE provider = 'microsoft'
  AND (refresh_token IS NULL OR token_expires_at <= NOW())
ORDER BY created_at DESC;

-- ============================================================================
-- OPTIONAL: Fix commands (uncomment to run)
-- ============================================================================

-- Option 1: Mark connections without refresh tokens as inactive
-- This will force users to re-authenticate
/*
UPDATE calendar_connections 
SET 
  is_active = false,
  updated_at = NOW()
WHERE provider = 'microsoft' 
  AND refresh_token IS NULL;
*/

-- Option 2: Delete connections without refresh tokens
-- WARNING: This will completely remove the connection
/*
DELETE FROM calendar_connections 
WHERE provider = 'microsoft' 
  AND refresh_token IS NULL;
*/

-- Option 3: Check a specific user's connection
/*
SELECT 
  id,
  provider_account_email,
  is_active,
  refresh_token IS NOT NULL as has_refresh_token,
  LENGTH(refresh_token) as refresh_token_length,
  token_expires_at,
  created_at,
  updated_at
FROM calendar_connections
WHERE provider = 'microsoft'
  AND user_id = 'YOUR_USER_ID_HERE';
*/


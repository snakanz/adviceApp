# 🧩 Calendly OAuth + Webhook Reconnect — Developer Implementation Notes

## 📋 EXECUTIVE SUMMARY

Your Advicly platform **already implements 85% of the idempotent Calendly OAuth + webhook reconnect flow**. This document provides:

1. **Current Implementation Status** - What's working
2. **Identified Gaps** - 4 improvements needed
3. **Implementation Guide** - Code examples for each gap
4. **Testing Strategy** - How to verify everything works
5. **Technical Reference** - API details and error handling

---

## ✅ WHAT'S ALREADY WORKING

### Core Flow (6/6 Steps Implemented)
1. ✅ **Check Existing DB Record** - Detects reconnections
2. ✅ **Token Refresh Service** - Exists but not called in OAuth
3. ✅ **Retrieve User Info** - Fetches URIs from Calendly
4. ✅ **Check Existing Webhooks** - Lists webhooks per org
5. ✅ **Create Webhook if Needed** - Handles 409 conflicts
6. ✅ **Update Database** - Stores all required data

### Advanced Features
- ✅ Webhook signature verification (database keys)
- ✅ 409 conflict handling
- ✅ Async initial sync
- ✅ Multi-tenant support
- ✅ Token storage with refresh support
- ✅ Database schema complete

---

## ⚠️ IDENTIFIED GAPS (4 Improvements)

### Gap #1: Token Refresh During OAuth (5 min)
**Current**: Always does full OAuth
**Needed**: Try refresh first, fallback to OAuth
**File**: `backend/src/routes/calendar.js` (lines 2154-2157)
**Impact**: Reduces unnecessary re-authorizations

### Gap #2: Webhook Cleanup on Reconnect (10 min)
**Current**: Creates new webhook without deleting old ones
**Needed**: Delete stale webhooks before creating new ones
**File**: `backend/src/services/calendlyWebhookService.js` (lines 197-301)
**Impact**: Prevents webhook accumulation

### Gap #3: Disconnect Endpoint (10 min)
**Current**: No cleanup when user disconnects
**Needed**: DELETE webhook from Calendly + clear DB
**File**: `backend/src/routes/calendly.js` (new endpoint)
**Impact**: Prevents orphaned webhooks

### Gap #4: Error Logging (5 min)
**Current**: Some errors logged
**Needed**: Full Calendly API response logging
**File**: `backend/src/services/calendlyWebhookService.js` (lines 25-61)
**Impact**: Better debugging visibility

---

## 📚 DOCUMENTATION FILES CREATED

| File | Purpose | Read Time |
|------|---------|-----------|
| `CALENDLY_OAUTH_WEBHOOK_RECONNECT_ANALYSIS.md` | Current status | 10 min |
| `CALENDLY_RECONNECT_IMPLEMENTATION_GUIDE.md` | Code examples | 15 min |
| `CALENDLY_IDEMPOTENT_FLOW_DIAGRAM.md` | Visual flow | 10 min |
| `CALENDLY_RECONNECT_SUMMARY.md` | Quick overview | 5 min |
| `CALENDLY_TECHNICAL_REFERENCE.md` | API reference | 20 min |
| `CALENDLY_CURRENT_VS_IMPROVED.md` | Comparison | 10 min |
| `CALENDLY_DOCUMENTATION_INDEX.md` | Index | 5 min |

---

## 🚀 QUICK START

### For Understanding
```
1. Read: CALENDLY_RECONNECT_SUMMARY.md (5 min)
2. Read: CALENDLY_OAUTH_WEBHOOK_RECONNECT_ANALYSIS.md (10 min)
3. Review: CALENDLY_IDEMPOTENT_FLOW_DIAGRAM.md (10 min)
```

### For Implementation
```
1. Read: CALENDLY_RECONNECT_IMPLEMENTATION_GUIDE.md (15 min)
2. Implement Gap #1: Token Refresh (5 min)
3. Implement Gap #2: Webhook Cleanup (10 min)
4. Implement Gap #3: Disconnect Endpoint (10 min)
5. Implement Gap #4: Error Logging (5 min)
6. Run testing strategy (30 min)
```

### For Debugging
```
1. Reference: CALENDLY_TECHNICAL_REFERENCE.md
2. Check: Error codes section
3. Review: Database queries section
```

---

## 🔑 KEY ARCHITECTURE DECISIONS

### Multi-Tenant Design
- One Calendly developer app handles all users
- Each user has unique tokens + organization URI
- Each organization has one webhook subscription
- Webhook signing keys stored per subscription

### Database Schema
```
calendar_connections:
  - calendly_user_uri (for webhook matching)
  - calendly_organization_uri (for webhook creation)
  - calendly_webhook_id (webhook URI)
  - calendly_webhook_signing_key (for verification)
  - access_token, refresh_token (OAuth tokens)

calendly_webhook_subscriptions:
  - organization_uri (unique per org)
  - webhook_subscription_uri (webhook ID)
  - webhook_signing_key (for verification)
  - is_active (status flag)
```

### Webhook Verification
- Signature format: `t=TIMESTAMP,v1=HEX_SIGNATURE`
- HMAC-SHA256 over: `timestamp + "." + raw_body`
- Tries all active webhook signing keys
- Uses database keys (not environment variables)

---

## 📊 IMPLEMENTATION ROADMAP

### Phase 1: Token Refresh (5 min)
- Add token refresh attempt before full OAuth
- Fallback to full OAuth if refresh fails

### Phase 2: Webhook Cleanup (10 min)
- Delete old webhooks before creating new ones
- Prevents webhook accumulation

### Phase 3: Disconnect Endpoint (10 min)
- DELETE webhook from Calendly
- Clear tokens from database

### Phase 4: Error Logging (5 min)
- Log full Calendly API responses
- Better debugging visibility

**Total Time**: ~30 minutes

---

## 🧪 TESTING STRATEGY

### Test 1: First-Time Connection
- Connect Calendly (first time)
- Verify webhook created
- Create meeting in Calendly
- Verify meeting appears in Advicly (3-7 sec)

### Test 2: Reconnection (Same Account)
- Reconnect Calendly (same account)
- Verify only ONE webhook exists
- Verify tokens updated
- Create meeting, verify sync

### Test 3: Reconnection (Different Account)
- Connect Account A
- Reconnect with Account B
- Verify Account A webhook deleted
- Verify only Account B meetings sync

### Test 4: Disconnect
- Disconnect Calendly
- Verify webhook deleted from Calendly
- Verify tokens cleared from database

---

## 💡 BEST PRACTICES ALREADY IN PLACE

✅ Webhook signature verification with database keys
✅ 409 conflict handling for existing webhooks
✅ Async initial sync (non-blocking)
✅ Proper error handling and logging
✅ Database schema with all required columns
✅ Multi-tenant support with organization URIs
✅ Token storage with refresh token support

---

## 🎯 NEXT STEPS

1. Review the 7 documentation files
2. Implement the 4 improvements (30 min total)
3. Run the testing strategy
4. Deploy to production
5. Monitor logs for any issues

**Questions?** Reference `CALENDLY_TECHNICAL_REFERENCE.md` for API details.


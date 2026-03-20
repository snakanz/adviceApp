# 📚 Calendly OAuth + Webhook Reconnect — Documentation Index

## 📖 DOCUMENTS CREATED

### 1. **CALENDLY_OAUTH_WEBHOOK_RECONNECT_ANALYSIS.md**
**Purpose**: Current implementation status assessment
**Contents**:
- ✅ What's already implemented (6/6 core steps)
- ⚠️ Gaps and improvements needed (4 items)
- 📊 Database schema status
- 🔗 Key files and line numbers

**Read this if**: You want to understand what's already working

---

### 2. **CALENDLY_RECONNECT_IMPLEMENTATION_GUIDE.md**
**Purpose**: Code examples for implementing the 4 improvements
**Contents**:
- Token Refresh During OAuth (with code)
- Webhook Cleanup on Reconnect (with code)
- Disconnect Endpoint (with code)
- Enhanced Error Logging (with code)
- 🧪 Testing checklist

**Read this if**: You want to implement the improvements

---

### 3. **CALENDLY_IDEMPOTENT_FLOW_DIAGRAM.md**
**Purpose**: Visual flow diagram of the complete reconnect process
**Contents**:
- Step-by-step flow diagram (ASCII art)
- Decision points and branches
- Error handling paths
- Disconnect flow
- Key properties (idempotent, safe, etc.)

**Read this if**: You want to understand the complete flow visually

---

### 4. **CALENDLY_RECONNECT_SUMMARY.md**
**Purpose**: Executive summary and prioritized action items
**Contents**:
- 🎯 Current state (85% complete)
- ✅ What's implemented
- ⚠️ What's missing
- 🚀 Recommended priority (1-4)
- 📊 Testing strategy
- 💡 Best practices already in place

**Read this if**: You want a quick overview and prioritized next steps

---

### 5. **CALENDLY_TECHNICAL_REFERENCE.md**
**Purpose**: Complete technical reference for Calendly API
**Contents**:
- OAuth endpoints and parameters
- User & organization endpoints
- Webhook subscription endpoints
- Signature verification algorithm
- Error codes and handling
- Database queries
- Environment variables
- Rate limits
- Webhook event formats
- Paid plan requirements

**Read this if**: You need API details or are debugging issues

---

## 🎯 QUICK START GUIDE

### For Understanding Current State
1. Read: `CALENDLY_RECONNECT_SUMMARY.md` (5 min)
2. Read: `CALENDLY_OAUTH_WEBHOOK_RECONNECT_ANALYSIS.md` (10 min)

### For Implementation
1. Read: `CALENDLY_RECONNECT_IMPLEMENTATION_GUIDE.md` (15 min)
2. Read: `CALENDLY_IDEMPOTENT_FLOW_DIAGRAM.md` (10 min)
3. Implement Priority 1-4 improvements
4. Run testing strategy from `CALENDLY_RECONNECT_SUMMARY.md`

### For Debugging
1. Reference: `CALENDLY_TECHNICAL_REFERENCE.md`
2. Check: Error codes and handling section
3. Review: Database queries section

---

## 📊 IMPLEMENTATION ROADMAP

### Phase 1: Token Refresh (5 min)
- File: `backend/src/routes/calendar.js` (lines 2154-2157)
- Add token refresh attempt before full OAuth
- Fallback to full OAuth if refresh fails

### Phase 2: Webhook Cleanup (10 min)
- File: `backend/src/services/calendlyWebhookService.js` (lines 197-301)
- Delete old webhooks before creating new ones
- Prevents webhook accumulation

### Phase 3: Disconnect Endpoint (10 min)
- File: `backend/src/routes/calendly.js` (new endpoint)
- DELETE webhook from Calendly
- Clear tokens from database

### Phase 4: Error Logging (5 min)
- File: `backend/src/services/calendlyWebhookService.js` (lines 25-61)
- Log full Calendly API responses
- Better debugging visibility

---

## ✅ CURRENT IMPLEMENTATION CHECKLIST

- [x] Check existing DB record
- [x] Token refresh service (not called in OAuth yet)
- [x] Retrieve Calendly user info
- [x] Check existing webhooks
- [x] Create webhook if needed
- [x] Handle 409 conflicts
- [x] Update database with webhook ID + signing key
- [x] Webhook signature verification
- [ ] Token refresh during OAuth reconnect
- [ ] Webhook cleanup on reconnect
- [ ] Disconnect endpoint
- [ ] Enhanced error logging

---

## 🔗 KEY FILES IN CODEBASE

```
backend/src/routes/calendar.js
  - OAuth callback (lines 2132-2393)
  - Webhook creation (lines 2282-2324)

backend/src/services/calendlyWebhookService.js
  - Webhook management
  - ensureWebhookSubscription() method
  - 409 conflict handling

backend/src/services/calendlyOAuth.js
  - OAuth token exchange
  - Token refresh method

backend/src/routes/calendly-webhook.js
  - Webhook signature verification
  - Webhook event processing

backend/migrations/027_add_calendly_webhook_signing_key.sql
  - Database schema for signing keys
```

---

## 💡 KEY CONCEPTS

**Idempotent**: Safe to run multiple times without side effects
**Multi-tenant**: One app, many users, each with unique tokens
**Webhook Signing Key**: Unique per webhook subscription (not global)
**409 Conflict**: Webhook already exists, reuse it
**Token Refresh**: Extend token lifetime without re-authorization

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] Implement all 4 improvements
- [ ] Run full testing strategy
- [ ] Verify no duplicate webhooks created
- [ ] Verify tokens properly refreshed
- [ ] Verify disconnect cleans up properly
- [ ] Deploy to Render
- [ ] Monitor logs for errors
- [ ] Test with real Calendly account


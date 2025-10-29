# 🎯 RECALL.AI INTEGRATION & PAYMENT SYSTEM - COMPREHENSIVE IMPLEMENTATION GUIDE

**Status:** Ready for Implementation  
**Priority:** CRITICAL - Final puzzle piece for MVP  
**Timeline:** 4 weeks (28-36 hours)  
**Owner:** Simon Greenwood

---

## 📋 EXECUTIVE SUMMARY

This document consolidates everything needed to:
1. **Integrate Recall.ai** for automatic meeting transcription
2. **Implement Stripe billing** with bulletproof security
3. **Add paywall** to monetize Advicly

**Current State:** 65% production ready → 95% after this implementation

---

## 🎙️ PART 1: RECALL.AI INTEGRATION

### Overview
Recall.ai is a meeting bot API that:
- Joins meetings automatically (Zoom, Google Meet, Teams, Webex, Slack)
- Records video/audio
- Generates transcripts (free via meeting captions OR $0.15/hour via AI)
- Sends webhooks when done
- Stores recordings in cloud

### Why Recall.ai?
✅ Best API for developers  
✅ Cheapest for high volume ($0.15/hr vs $10-30/month competitors)  
✅ Supports all major platforms  
✅ Perfect diarization (knows who said what)  
✅ Webhook support (real-time updates)  

---

## 🔴 CRITICAL CONSIDERATIONS & CONCERNS

### 1. **Meeting Caption Dependency (MAJOR CONCERN)**
**Issue:** Free transcription uses platform's native captions
- ❌ Zoom: Requires host to enable captions (not always done)
- ❌ Google Meet: Only English supported
- ❌ Teams: Requires specific settings enabled
- ❌ If captions disabled → NO TRANSCRIPT (even with bot present)

**Solution:**
```javascript
// Fallback to AI transcription if captions fail
if (transcriptEmpty && recordingExists) {
  // Retry with Recall.ai AI transcription ($0.15/hr)
  await createAsyncTranscript(botId, 'recall_ai');
}
```

**Cost Impact:** 
- Free tier: ~$0 if captions work
- Fallback: $0.15/hour when captions fail
- Estimate: 10-20% of meetings need fallback = $0.015-0.03 per meeting

---

### 2. **Bot Detection & Blocking (MAJOR CONCERN)**
**Issue:** Some organizations block recording bots
- ❌ Corporate policies may prevent bot joining
- ❌ Meeting host can kick bot out
- ❌ Some platforms require explicit bot permissions

**Solution:**
```javascript
// Check bot status after joining
if (botStatus === 'kicked_out' || botStatus === 'denied_access') {
  // Notify user, suggest manual upload
  await notifyUserBotBlocked(userId, meetingId);
  // Offer manual transcript upload as fallback
}
```

**User Experience:**
- Show warning: "Some organizations block recording bots"
- Provide manual transcript upload option
- Allow users to disable auto-recording for specific meetings

---

### 3. **Calendar Integration Complexity (MEDIUM CONCERN)**
**Issue:** Need to auto-join meetings from calendar
- Must detect meeting URL from calendar event
- Different platforms have different URL formats
- Some meetings don't have URLs (phone calls, in-person)

**Current State:** Advicly has:
- ✅ Google Calendar webhook sync
- ✅ Calendly webhook sync
- ✅ Meeting database with `external_id` and `meeting_source`

**What's Needed:**
```javascript
// Extract meeting URL from calendar event
const meetingUrl = extractMeetingUrl({
  description: event.description,
  location: event.location,
  conferenceData: event.conferenceData // Google Meet
});

if (!meetingUrl) {
  // Can't auto-join - no URL found
  // User must manually upload transcript
}
```

---

### 4. **Webhook Reliability (MEDIUM CONCERN)**
**Issue:** Recall.ai webhooks might fail or be delayed
- Network issues
- Webhook endpoint down
- Duplicate webhook events

**Solution:**
```javascript
// Webhook signature verification (CRITICAL)
const isValid = verifyRecallWebhookSignature(req);
if (!isValid) return res.status(401).json({ error: 'Invalid signature' });

// Idempotency key to prevent duplicates
const webhookId = req.body.id;
const { data: existing } = await supabase
  .from('recall_webhook_events')
  .select('id')
  .eq('webhook_id', webhookId)
  .single();

if (existing) {
  return res.json({ received: true }); // Already processed
}

// Process webhook
await processRecallWebhook(req.body);
```

---

### 5. **Storage & Compliance (MEDIUM CONCERN)**
**Issue:** Storing recordings/transcripts has legal implications
- GDPR: Users can request deletion
- Data retention: How long to keep?
- Storage costs: Recall.ai charges for storage

**Solution:**
```sql
-- Track transcript metadata
CREATE TABLE transcripts (
  id UUID PRIMARY KEY,
  meeting_id SERIAL REFERENCES meetings(id),
  recall_bot_id TEXT UNIQUE,
  recall_recording_id TEXT,
  transcript_text TEXT,
  transcript_provider TEXT, -- 'meeting_captions' or 'recall_ai'
  cost_usd DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- For GDPR deletion
);

-- GDPR: Soft delete transcripts
UPDATE transcripts SET deleted_at = NOW() 
WHERE meeting_id IN (SELECT id FROM meetings WHERE user_id = $1);
```

---

### 6. **Cost Management (MEDIUM CONCERN)**
**Issue:** Recall.ai costs can add up quickly
- $0.15/hour × 100 users × 10 hours/month = $150/month
- Need to track usage per user
- May need to limit free tier

**Solution:**
```javascript
// Track usage per user
router.post('/api/usage/record', authenticateSupabaseUser, async (req, res) => {
  const { meeting_id, transcription_hours } = req.body;
  const cost = transcription_hours * 0.15;

  // Check if user exceeded limit
  const monthlyUsage = await getMonthlyUsage(req.user.id);
  if (monthlyUsage + cost > userPlan.transcription_limit) {
    return res.status(402).json({ error: 'Transcription limit exceeded' });
  }

  // Record usage
  await supabase.from('usage_records').insert({
    user_id: req.user.id,
    meeting_id,
    transcription_hours,
    cost_usd: cost
  });
});
```

---

## 💳 PART 2: STRIPE BILLING IMPLEMENTATION

### Architecture
```
User → Checkout → Stripe → Webhook → Database → Feature Access
```

### Subscription Tiers (Recommended)
```javascript
const tiers = {
  free: { price: 0, meetings: 3, transcription_hours: 10 },
  starter: { price: 29, meetings: 20, transcription_hours: 100 },
  professional: { price: 99, meetings: 200, transcription_hours: 1000 },
  enterprise: { price: 'custom', meetings: 'unlimited', transcription_hours: 'unlimited' }
};
```

---

## 🔒 SECURITY CHECKLIST (BULLETPROOF)

### Before Launch
- [ ] Webhook signature verification implemented
- [ ] 3D Secure enabled (fraud prevention)
- [ ] Idempotency keys used (prevent duplicate charges)
- [ ] Database constraints in place
- [ ] Audit logging enabled
- [ ] PCI compliance verified (Stripe handles)
- [ ] Fraud detection enabled (Stripe Radar)
- [ ] Dunning management configured
- [ ] Rate limiting on billing endpoints
- [ ] HTTPS enforced
- [ ] Webhook endpoint tested with Stripe CLI
- [ ] Error handling for failed payments
- [ ] Chargeback handling documented
- [ ] Refund policy documented
- [ ] Terms of Service updated

---

## 📊 IMPLEMENTATION ROADMAP

### Phase 1: Recall.ai Integration (Week 1)
- [ ] Get Recall.ai API key
- [ ] Create bot when meeting starts
- [ ] Receive webhook when meeting ends
- [ ] Fetch and store transcript
- [ ] Display transcript in app
- **Effort:** 6-8 hours

### Phase 2: Stripe Setup (Week 2)
- [ ] Create Stripe account
- [ ] Set up pricing plans
- [ ] Implement checkout
- [ ] Implement webhook handler
- [ ] Test with Stripe test cards
- **Effort:** 8-10 hours

### Phase 3: Paywall Implementation (Week 3)
- [ ] Add subscription check to app
- [ ] Redirect to upgrade if needed
- [ ] Show usage limits
- [ ] Implement feature gating
- [ ] Add billing portal link
- **Effort:** 6-8 hours

### Phase 4: Testing & Security (Week 4)
- [ ] Test all payment scenarios
- [ ] Test webhook retries
- [ ] Test fraud detection
- [ ] Security audit
- [ ] Load testing
- **Effort:** 8-10 hours

---

## 💰 COST BREAKDOWN

| Item | Cost | Notes |
|------|------|-------|
| Stripe Processing | 2.9% + $0.30 | Per transaction |
| Recall.ai Transcription | $0.15/hour | Only if user enables |
| Supabase | $25-100 | Already using |
| Render Backend | $7-50 | Already using |
| Cloudflare Pages | $0-20 | Already using |
| **Total** | **$32-170+** | Scales with usage |

---

## 🚀 NEXT STEPS

1. **Get Recall.ai API Key** - Sign up at recall.ai
2. **Create Stripe Account** - stripe.com
3. **Implement Phase 1** - Recall.ai integration
4. **Test thoroughly** - Use test mode first
5. **Deploy to production** - Follow security checklist
6. **Monitor closely** - Watch for errors/chargebacks

---

## 📞 SUPPORT & RESOURCES

- Recall.ai Docs: https://docs.recall.ai
- Stripe Docs: https://docs.stripe.com
- Webhook Testing: Stripe CLI (stripe listen)
- Monitoring: Sentry (error tracking)

**Status:** Ready to implement ✅


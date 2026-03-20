# 🎉 5 Free Meetings + £70/Month Subscription Model - Setup Guide

## ✅ What's Been Implemented

### 1. **Database Changes**
- Added `free_meetings_limit` column to `subscriptions` table (default: 5)
- Added `free_meetings_used` column to track usage
- Migration file: `backend/migrations/028_add_free_meetings_tracking.sql`

### 2. **Backend Changes**
- **New endpoint:** `GET /api/billing/meeting-stats` - Returns meeting usage and access status
- **Updated endpoint:** `POST /api/billing/create-trial` - Creates free tier (5 free meetings)
- **New function:** `checkUserHasTranscriptionAccess()` - Checks if user can schedule bots
- **Bot scheduling logic:**
  - Only schedules bots if user has access (within free limit or paid subscription)
  - Adds 30-day limit (won't schedule bots for meetings >30 days away)
  - Marks meetings as `upgrade_required` when user exceeds limit

### 3. **Recall Bot Cost Optimizations** (74% savings on stuck bots!)
- **Waiting room timeout:** 20 min → 5 min (saves $0.17 per stuck bot)
- **Bot detection timeout:** 10 min → 5 min
- **Silence detection:** 60 min → 30 min
- **Activation timing:** 20 min → 10 min

### 4. **Onboarding Flow Simplified**
- **Old flow:** Business Profile → Calendar → Subscription → Sync → Complete (5 steps)
- **New flow:** Business Profile → Calendar → Complete (3 steps)
- Auto-creates free subscription on completion
- Auto-triggers calendar sync in background
- Shows sync progress with loading indicator

---

## 🚀 What You Need to Do

### Step 1: Run Database Migration

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to: https://supabase.com/dashboard/project/xjqjzievgepqpgtggcjx/sql/new
2. Copy and paste this SQL:

```sql
-- Add free meetings tracking to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS free_meetings_limit INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS free_meetings_used INTEGER DEFAULT 0;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_free_meetings ON subscriptions(user_id, free_meetings_used);

-- Update existing subscriptions to have the free meetings limit
UPDATE subscriptions 
SET free_meetings_limit = 5, 
    free_meetings_used = 0 
WHERE free_meetings_limit IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN subscriptions.free_meetings_limit IS 'Number of free AI-transcribed meetings allowed before requiring subscription';
COMMENT ON COLUMN subscriptions.free_meetings_used IS 'Number of free AI-transcribed meetings used (meetings with successful Recall bot transcription)';
```

3. Click "Run" to execute

**Option B: Via Supabase CLI**

```bash
cd backend
npx supabase db push --file migrations/028_add_free_meetings_tracking.sql
```

---

### Step 2: Create Stripe Product

1. **Go to Stripe Dashboard:** https://dashboard.stripe.com/products

2. **Click "Add product"**

3. **Fill in details:**
   - **Name:** Advicly Pro - Unlimited AI Meetings
   - **Description:** Unlimited AI-transcribed meetings with automatic insights and summaries
   - **Pricing model:** Recurring
   - **Price:** £70.00 GBP
   - **Billing period:** Monthly
   - **Free trial:** 0 days (we handle free meetings ourselves)

4. **Click "Save product"**

5. **Copy the Price ID** (starts with `price_...`)

---

### Step 3: Add Environment Variables

#### **Backend (Render)**

1. Go to: https://dashboard.render.com/web/srv-d1mjml7fte5s73ccl730/env

2. Add these environment variables:

```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=(we'll get this in Step 4)
```

3. Click "Save Changes"

#### **Frontend (Cloudflare Pages)**

1. Go to your Cloudflare Pages dashboard
2. Navigate to Settings → Environment Variables
3. Add these variables:

```
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_... (or pk_live_... for production)
REACT_APP_STRIPE_PRICE_ID=price_... (from Step 2)
```

4. Click "Save"
5. Redeploy the frontend

---

### Step 4: Setup Stripe Webhook

1. **Go to:** https://dashboard.render.com/webhooks

2. **Click "Add endpoint"**

3. **Endpoint URL:** `https://adviceapp-9rgw.onrender.com/api/billing/webhook`

4. **Events to listen for:**
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. **Click "Add endpoint"**

6. **Copy the Signing Secret** (starts with `whsec_...`)

7. **Add to Render environment variables:**
   - Go back to Render dashboard
   - Add `STRIPE_WEBHOOK_SECRET=whsec_...`
   - Save changes

---

## 📊 How It Works

### User Journey

1. **Sign up** → User creates account
2. **Onboarding** → Business Profile → Calendar Setup → Complete
3. **Auto-setup** → Free subscription created (5 free meetings)
4. **Calendar sync** → Meetings imported automatically
5. **First 5 meetings** → Recall bot joins, transcribes, extracts insights
6. **6th meeting** → Bot doesn't join, shows upgrade prompt
7. **Upgrade** → User pays £70/month → Unlimited meetings

### Meeting Count Logic

**What counts as a "meeting"?**
- Only meetings with successful Recall bot transcription
- Status must be `completed` or `done`
- Must have `recall_bot_id` set

**Query:**
```sql
SELECT COUNT(*) FROM meetings 
WHERE user_id = ? 
AND recall_bot_id IS NOT NULL 
AND recall_status IN ('completed', 'done');
```

### Access Check Logic

```javascript
// User has access if:
// 1. They have an active paid subscription, OR
// 2. They've used fewer than 5 free meetings

const isPaid = subscription.status === 'active' && subscription.plan !== 'free';
const withinFreeLimit = meetingsTranscribed < 5;

const hasAccess = isPaid || withinFreeLimit;
```

---

## 🧪 Testing

### Test the Free Meetings Flow

1. **Create a new test user**
2. **Complete onboarding** (should auto-create free subscription)
3. **Check subscription:**
   ```sql
   SELECT * FROM subscriptions WHERE user_id = 'USER_ID';
   ```
   Should show: `plan='free'`, `free_meetings_limit=5`, `free_meetings_used=0`

4. **Schedule 5 meetings** with Recall bot
5. **Check meeting stats:**
   ```
   GET /api/billing/meeting-stats
   ```
   Should return: `{ transcribed: 5, remaining: 0, hasAccess: false }`

6. **Try to schedule 6th meeting** → Bot should NOT be scheduled
7. **Check meeting status:**
   ```sql
   SELECT recall_status FROM meetings WHERE id = 'MEETING_ID';
   ```
   Should show: `recall_status='upgrade_required'`

### Test Stripe Checkout

1. **Create upgrade page** (not yet implemented - see below)
2. **Click "Upgrade"**
3. **Use test card:** `4242 4242 4242 4242`
4. **Complete payment**
5. **Check subscription updated:**
   ```sql
   SELECT * FROM subscriptions WHERE user_id = 'USER_ID';
   ```
   Should show: `plan='pro'`, `status='active'`

---

## 🚧 What's Still Needed

### 1. **Upgrade Page** (Frontend)

Create a page at `/upgrade` that:
- Shows current usage (e.g., "5 of 5 free meetings used")
- Explains the benefits of upgrading
- Has a "Upgrade to Pro - £70/month" button
- Calls `/api/billing/checkout` with the price ID
- Redirects to Stripe checkout

### 2. **Usage Display** (Frontend)

Add to dashboard header:
- "3 of 5 free meetings used" badge
- Link to upgrade page when limit reached

### 3. **Upgrade Prompts** (Frontend)

Show upgrade prompt when:
- User tries to schedule a meeting but has no access
- User views a meeting marked as `upgrade_required`

---

## 📈 Expected Costs

### Recall.ai Costs (Per User)

**Before optimization:**
- Stuck bot in waiting room: 20 min × $0.70/hr = $0.23
- Average cost per stuck bot: $0.23

**After optimization:**
- Stuck bot in waiting room: 5 min × $0.70/hr = $0.06
- Average cost per stuck bot: $0.06
- **Savings: 74%** 🎉

**Monthly estimate (per user):**
- 20 meetings/month
- 5% stuck in waiting room (1 meeting)
- Cost: 1 × $0.06 = $0.06/month
- 19 successful meetings × 30 min avg × $0.70/hr = $6.65/month
- **Total: ~$6.71/month per user**

### Stripe Costs

- **Transaction fee:** 1.5% + 20p per transaction
- **Monthly subscription:** £70 × 1.5% + £0.20 = £1.25 fee
- **Your revenue:** £70 - £1.25 = £68.75 per user/month

---

## ✅ Deployment Status

- ✅ Code committed: `3b8d98c`
- ✅ Pushed to GitHub
- 🔄 Render auto-deploy: In progress
- 🔄 Cloudflare Pages: Needs redeploy after env vars added
- ⏳ Database migration: Waiting for you to run
- ⏳ Stripe setup: Waiting for you to configure

---

## 🎯 Next Steps

1. ✅ **Run database migration** (Step 1 above)
2. ✅ **Create Stripe product** (Step 2 above)
3. ✅ **Add environment variables** (Step 3 above)
4. ✅ **Setup webhook** (Step 4 above)
5. 🚧 **Build upgrade page** (optional - can do later)
6. 🧪 **Test with a new user**

---

## 🆘 Troubleshooting

### "Database migration failed"
- Make sure you're logged into Supabase dashboard
- Check you're on the correct project (xjqjzievgepqpgtggcjx)
- Try running each SQL statement separately

### "Stripe webhook not working"
- Check webhook secret is correct in Render env vars
- Check endpoint URL is correct: `https://adviceapp-9rgw.onrender.com/api/billing/webhook`
- Check webhook is listening to correct events
- View webhook logs in Stripe dashboard

### "Bot still scheduling after limit"
- Check subscription record exists for user
- Check `free_meetings_used` is being updated
- Check meeting count query is correct
- View logs: `GET /api/logs?service=api`

---

**Need help?** Let me know and I'll assist! 🚀


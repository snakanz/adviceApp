# 📧 Supabase Email Template Update - REQUIRED MANUAL STEP

## ⚠️ IMPORTANT: You Must Update This Manually

The code changes have been deployed, but you need to update your Supabase email template to complete the fix.

---

## 🔧 Step-by-Step Instructions

### 1. Go to Supabase Dashboard
- URL: https://supabase.com/dashboard
- Select your project: `xjqjzievgepqpgtggcjx`

### 2. Navigate to Email Templates
1. Click **Authentication** in the left sidebar
2. Click **Email Templates**
3. Select **Confirm signup** template

### 3. Update the Template

**FIND THIS LINE (line 4):**
```html
<p><a href="https://adviceapp.pages.dev/auth/confirm?Token_hash={{ .TokenHash }}&type=signup&next=/dashboard">Confirm your mail</a></p>
```

**CHANGE TO (lowercase 't' in token_hash):**
```html
<p><a href="https://adviceapp.pages.dev/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard">Confirm your mail</a></p>
```

**What Changed:**
- `Token_hash` → `token_hash` (lowercase 't')

### 4. Save the Template
- Click **Save** button at the bottom
- Changes take effect immediately

---

## ✅ Verification

After saving, the template should look like this:

```html
<h2>Confirm your signup</h2>

<p>Follow this link to confirm your user:</p>
<p><a href="https://adviceapp.pages.dev/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard">Confirm your mail</a></p>
```

---

## 🧪 Test After Update

1. Open incognito window
2. Go to: https://adviceapp.pages.dev/register
3. Register with a NEW email address
4. Check email inbox
5. Click "Confirm your mail" link
6. Should see: "Confirming Email..." → "Success!" → Redirect to onboarding ✅

---

## 🔍 Why This Matters

- **Supabase expects:** `token_hash` (lowercase)
- **Your template had:** `Token_hash` (uppercase T)
- **Result:** Token exchange fails, no session created

With the fix:
- ✅ URL parameter matches what Supabase expects
- ✅ `verifyOtp()` successfully exchanges token for session
- ✅ User can complete email signup

---

## 📊 What Happens After Fix

### Before (Broken):
```
Email link → /auth/confirm?Token_hash=xxx
                                ↑
                          Wrong case!
AuthConfirm.js → verifyOtp({ token_hash: xxx })
                                ↑
                    Supabase can't find token
❌ Error: Invalid token
```

### After (Fixed):
```
Email link → /auth/confirm?token_hash=xxx
                                ↑
                          Correct case!
AuthConfirm.js → verifyOtp({ token_hash: xxx })
                                ↑
                    Supabase finds token
✅ Session created successfully
```

---

## 🚀 Deployment Status

- ✅ **Frontend Code:** Deployed to Cloudflare Pages (commit `9b09e26`)
- ✅ **Backend Code:** No changes needed
- ⏳ **Email Template:** Waiting for you to update manually

---

## 📞 Need Help?

If you have trouble finding the email template:
1. Make sure you're logged into the correct Supabase account
2. Make sure you've selected the correct project (`xjqjzievgepqpgtggcjx`)
3. The path is: Authentication → Email Templates → Confirm signup

The template editor looks like a code editor with HTML syntax highlighting.


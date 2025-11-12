# 🔧 Calendly Reconnect Flow — Implementation Guide

## IMPROVEMENT #1: Token Refresh During OAuth Reconnect

### Current Flow (Lines 2154-2157 in calendar.js)
```javascript
// Directly exchanges code for tokens - no refresh attempt
const tokenData = await oauthService.exchangeCodeForToken(code);
```

### Improved Flow
```javascript
// Step 1: Check if user has existing tokens
const { data: existingConnection } = await getSupabase()
  .from('calendar_connections')
  .select('refresh_token')
  .eq('user_id', userId)
  .eq('provider', 'calendly')
  .single();

// Step 2: Try refresh first
if (existingConnection?.refresh_token) {
  try {
    console.log('🔄 Attempting token refresh...');
    const refreshedTokens = await oauthService.refreshAccessToken(
      existingConnection.refresh_token
    );
    accessToken = refreshedTokens.access_token;
    refreshToken = refreshedTokens.refresh_token || existingConnection.refresh_token;
    console.log('✅ Tokens refreshed successfully - skipping full OAuth');
  } catch (refreshError) {
    console.warn('⚠️  Token refresh failed, proceeding with full OAuth:', refreshError.message);
    // Fall through to full OAuth exchange
    const tokenData = await oauthService.exchangeCodeForToken(code);
    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
  }
} else {
  // First-time connection - do full OAuth
  const tokenData = await oauthService.exchangeCodeForToken(code);
  accessToken = tokenData.access_token;
  refreshToken = tokenData.refresh_token;
}
```

## IMPROVEMENT #2: Webhook Cleanup on Reconnect

### Current Flow (Lines 2291-2294 in calendar.js)
```javascript
// Creates webhook without checking for old ones
const webhookResult = await webhookService.ensureWebhookSubscription(
  calendlyUser.current_organization,
  calendlyUser.uri
);
```

### Improved Flow in calendlyWebhookService.js
```javascript
async ensureWebhookSubscription(organizationUri, userUri) {
  // Step 1: List existing webhooks
  const existingWebhooks = await this.listWebhookSubscriptions(organizationUri);
  
  // Step 2: Delete old webhooks with our callback URL
  for (const webhook of existingWebhooks) {
    if (webhook.callback_url === this.webhookUrl) {
      console.log('🗑️  Deleting old webhook:', webhook.uri);
      try {
        await this.deleteWebhookSubscription(webhook.uri);
      } catch (deleteError) {
        console.warn('⚠️  Failed to delete old webhook:', deleteError.message);
      }
    }
  }
  
  // Step 3: Create fresh webhook
  const webhook = await this.createWebhookSubscription(organizationUri, userUri);
  
  // Step 4: Store in database
  await supabase.from('calendly_webhook_subscriptions').insert({
    organization_uri: organizationUri,
    webhook_subscription_uri: webhook.uri,
    webhook_signing_key: webhook.signing_key,
    is_active: true
  });
  
  return webhook;
}
```

## IMPROVEMENT #3: Disconnect Endpoint

### Add to backend/src/routes/calendly.js
```javascript
router.post('/disconnect', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const supabase = getSupabase();
    
    // Get connection details
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('access_token, calendly_webhook_id')
      .eq('user_id', userId)
      .eq('provider', 'calendly')
      .single();
    
    if (!connection) {
      return res.status(404).json({ error: 'No Calendly connection found' });
    }
    
    // Delete webhook from Calendly
    if (connection.calendly_webhook_id) {
      try {
        const webhookService = new CalendlyWebhookService(connection.access_token);
        await webhookService.deleteWebhookSubscription(connection.calendly_webhook_id);
        console.log('✅ Webhook deleted from Calendly');
      } catch (deleteError) {
        console.warn('⚠️  Failed to delete webhook:', deleteError.message);
      }
    }
    
    // Clear tokens from database
    await supabase
      .from('calendar_connections')
      .update({
        access_token: null,
        refresh_token: null,
        calendly_webhook_id: null,
        calendly_webhook_signing_key: null,
        is_active: false
      })
      .eq('user_id', userId)
      .eq('provider', 'calendly');
    
    res.json({ success: true, message: 'Calendly disconnected' });
  } catch (error) {
    console.error('❌ Error disconnecting Calendly:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## IMPROVEMENT #4: Enhanced Error Logging

### Add to calendlyWebhookService.js makeRequest()
```javascript
async makeRequest(endpoint, options = {}) {
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorText = await response.text();
    
    // Log full error payload
    console.error('❌ Calendly API Error:');
    console.error('   Status:', response.status);
    console.error('   Endpoint:', endpoint);
    console.error('   Method:', options.method || 'GET');
    console.error('   Response:', errorText);
    
    // Try to parse as JSON for structured logging
    try {
      const errorJson = JSON.parse(errorText);
      console.error('   Parsed:', JSON.stringify(errorJson, null, 2));
    } catch (e) {}
    
    throw new Error(`Calendly API (${response.status}): ${errorText}`);
  }
  
  return response.json();
}
```

## 🧪 Testing Checklist

- [ ] Connect Calendly (first time)
- [ ] Verify webhook created in Calendly dashboard
- [ ] Reconnect Calendly (same account)
- [ ] Verify only ONE webhook exists (old one deleted)
- [ ] Create meeting in Calendly
- [ ] Verify meeting appears in Advicly within 3-7 seconds
- [ ] Disconnect Calendly
- [ ] Verify webhook deleted from Calendly dashboard
- [ ] Verify tokens cleared from database


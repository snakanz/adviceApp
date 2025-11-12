# 🔬 Calendly Technical Reference — API & Implementation Details

## CALENDLY API ENDPOINTS

### OAuth Endpoints
```
GET https://auth.calendly.com/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &response_type=code
  &state=USER_ID
  &scope=default
  &prompt=login

POST https://auth.calendly.com/oauth/token
  grant_type: authorization_code | refresh_token
  code: AUTH_CODE (for first-time)
  refresh_token: REFRESH_TOKEN (for refresh)
  client_id: YOUR_CLIENT_ID
  client_secret: YOUR_CLIENT_SECRET
  redirect_uri: https://yourapp.com/callback
```

### User & Organization
```
GET https://api.calendly.com/users/me
  Authorization: Bearer ACCESS_TOKEN
  Returns: {
    resource: {
      uri: "https://api.calendly.com/users/USER_ID",
      email: "user@example.com",
      current_organization: "https://api.calendly.com/organizations/ORG_ID"
    }
  }

GET https://api.calendly.com/organizations/ORG_ID
  Authorization: Bearer ACCESS_TOKEN
  Returns: {
    resource: {
      plan: "free" | "basic" | "standard" | "professional" | "teams" | "enterprise"
    }
  }
```

### Webhook Subscriptions
```
GET https://api.calendly.com/webhook_subscriptions
  ?organization=ORG_URI
  &scope=organization
  Returns: { collection: [...webhooks] }

POST https://api.calendly.com/webhook_subscriptions
  {
    "url": "https://yourapp.com/api/calendly/webhook",
    "events": ["invitee.created", "invitee.canceled"],
    "organization": "https://api.calendly.com/organizations/ORG_ID",
    "scope": "organization"
  }
  Returns: {
    resource: {
      uri: "https://api.calendly.com/webhook_subscriptions/WEBHOOK_ID",
      signing_key: "BASE64_ENCODED_KEY",
      callback_url: "https://yourapp.com/api/calendly/webhook",
      state: "active"
    }
  }

DELETE https://api.calendly.com/webhook_subscriptions/WEBHOOK_ID
  Authorization: Bearer ACCESS_TOKEN
```

## WEBHOOK SIGNATURE VERIFICATION

### Header Format
```
Calendly-Webhook-Signature: t=1762967812,v1=821c30e7797c714f80294d8589b5a6f61ed1d49547c6a68a3aaa867c543249be
```

### Verification Algorithm
```javascript
// 1. Parse header
const [tPart, v1Part] = header.split(',');
const timestamp = tPart.split('=')[1];
const signature = v1Part.split('=')[1];

// 2. Compute HMAC
const signedContent = timestamp + '.' + rawBody;
const hmac = crypto.createHmac('sha256', signingKey);
hmac.update(signedContent);
const computed = hmac.digest('hex');

// 3. Compare (constant-time)
const isValid = crypto.timingSafeEqual(
  Buffer.from(computed, 'hex'),
  Buffer.from(signature, 'hex')
);
```

## ERROR CODES & HANDLING

### 409 Conflict (Webhook Already Exists)
```
Response: {
  "title": "Already Exists",
  "message": "A webhook subscription with this URL already exists"
}

Handling:
1. List existing webhooks
2. Find webhook with matching callback_url
3. Reuse existing webhook
4. Store signing key from database (not available via API)
```

### 400 Bad Request (Free Plan)
```
Response: {
  "title": "Invalid Request",
  "message": "Webhooks are not available on your plan"
}

Handling:
1. Check organization plan before creating webhook
2. Warn user if on free/basic plan
3. Fall back to polling (15-min intervals)
```

### 401 Unauthorized (Token Expired)
```
Response: {
  "title": "Unauthorized",
  "message": "Invalid or expired access token"
}

Handling:
1. Attempt token refresh
2. If refresh fails, require re-authorization
3. Store new tokens in database
```

## DATABASE QUERIES

### Get User's Calendly Connection
```sql
SELECT 
  access_token,
  refresh_token,
  calendly_user_uri,
  calendly_organization_uri,
  calendly_webhook_id,
  calendly_webhook_signing_key
FROM calendar_connections
WHERE user_id = $1 AND provider = 'calendly' AND is_active = true;
```

### Get Webhook Signing Keys
```sql
SELECT webhook_signing_key
FROM calendly_webhook_subscriptions
WHERE is_active = true;
```

### Store Webhook After Creation
```sql
INSERT INTO calendly_webhook_subscriptions (
  organization_uri,
  webhook_subscription_uri,
  webhook_signing_key,
  is_active
) VALUES ($1, $2, $3, true);

UPDATE calendar_connections SET
  calendly_webhook_id = $1,
  calendly_webhook_signing_key = $2
WHERE user_id = $3 AND provider = 'calendly';
```

## ENVIRONMENT VARIABLES

```
CALENDLY_OAUTH_CLIENT_ID=your_client_id
CALENDLY_OAUTH_CLIENT_SECRET=your_client_secret
CALENDLY_WEBHOOK_SIGNING_KEY=your_webhook_signing_key
BACKEND_URL=https://adviceapp-9rgw.onrender.com
FRONTEND_URL=https://advicly.app
```

## RATE LIMITS

- **OAuth Token Endpoint**: 100 requests/minute
- **API Endpoints**: 100 requests/minute per token
- **Webhook Delivery**: Retries up to 5 times over 24 hours

## WEBHOOK EVENTS

### invitee.created
```json
{
  "event": "invitee.created",
  "created_at": "2025-11-12T17:30:00Z",
  "payload": {
    "invitee": {
      "uri": "https://api.calendly.com/scheduled_events/INVITEE_ID",
      "email": "client@example.com",
      "name": "Client Name",
      "scheduled_event": {
        "uri": "https://api.calendly.com/scheduled_events/EVENT_ID"
      }
    }
  }
}
```

### invitee.canceled
```json
{
  "event": "invitee.canceled",
  "created_at": "2025-11-12T17:30:00Z",
  "payload": {
    "invitee": {
      "uri": "https://api.calendly.com/scheduled_events/INVITEE_ID",
      "email": "client@example.com",
      "scheduled_event": {
        "uri": "https://api.calendly.com/scheduled_events/EVENT_ID"
      }
    }
  }
}
```

## PAID PLAN REQUIREMENT

Webhooks require **PAID plan**:
- ❌ Free
- ❌ Basic
- ✅ Standard
- ✅ Professional
- ✅ Teams
- ✅ Enterprise

Check plan before creating webhook to provide better error messages.


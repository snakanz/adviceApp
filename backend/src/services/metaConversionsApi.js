/**
 * Meta Conversions API (CAPI) Service
 * Sends server-side events to Meta for ad attribution.
 */

const crypto = require('crypto');

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const API_VERSION = 'v21.0';

function sha256(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Send an event to Meta Conversions API.
 * Fails silently if env vars are missing or API errors occur.
 */
async function sendEvent({ eventName, email, fbc, customData = {} }) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn(`⚠️  Meta CAPI not configured — skipping ${eventName} event`);
    return null;
  }

  const eventData = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: 'https://app.advicly.co.uk',
    user_data: {
      em: [sha256(email)],
      ...(fbc && { fbc })
    },
    ...(Object.keys(customData).length > 0 && { custom_data: customData })
  };

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [eventData],
        access_token: ACCESS_TOKEN
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ Meta CAPI ${eventName} error:`, JSON.stringify(result));
    } else {
      console.log(`✅ Meta CAPI: ${eventName} sent successfully — events_received: ${result.events_received}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Meta CAPI ${eventName} network error:`, error.message);
    return null;
  }
}

async function sendStartTrial({ email, fbc }) {
  return sendEvent({
    eventName: 'StartTrial',
    email,
    fbc,
    customData: { currency: 'GBP', value: 0 }
  });
}

async function sendPurchase({ email, fbc, value, currency = 'GBP' }) {
  return sendEvent({
    eventName: 'Purchase',
    email,
    fbc,
    customData: { currency, value }
  });
}

module.exports = { sendEvent, sendStartTrial, sendPurchase };

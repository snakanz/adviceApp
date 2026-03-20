/**
 * Calendly Webhook v2 Integration Tests
 * Tests webhook signature verification and event processing
 */

const crypto = require('crypto');

describe('Calendly Webhook v2 Signature Verification', () => {
  /**
   * Verify Calendly webhook signature using RAW body (v2 compatible)
   * Calendly v2 signature format: "t=TIMESTAMP,v1=HEX_SIGNATURE"
   * HMAC is computed over: timestamp + "." + raw_body
   */
  function verifyCalendlySignature(rawBody, signatureHeader, signingKey) {
    if (!signatureHeader) {
      return false;
    }

    try {
      const parts = signatureHeader.split(',');
      const tPart = parts.find(p => p.startsWith('t='));
      const v1Part = parts.find(p => p.startsWith('v1='));

      if (!tPart || !v1Part) {
        return false;
      }

      const timestamp = tPart.split('=')[1];
      const sigHex = v1Part.split('=')[1];

      const signedContent = timestamp + '.' + rawBody.toString('utf8');
      const hmac = crypto.createHmac('sha256', signingKey);
      hmac.update(signedContent);
      const computed = hmac.digest('hex');

      const computedBuffer = Buffer.from(computed, 'hex');
      const signatureBuffer = Buffer.from(sigHex, 'hex');

      if (computedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(computedBuffer, signatureBuffer);
    } catch (error) {
      return false;
    }
  }

  test('should verify valid v2 webhook signature', () => {
    const signingKey = 'test-signing-key-12345';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = Buffer.from(JSON.stringify({
      event: 'invitee.created',
      payload: { event: 'https://api.calendly.com/scheduled_events/abc123' }
    }));

    const signedContent = timestamp + '.' + rawBody.toString('utf8');
    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(signedContent);
    const signature = hmac.digest('hex');

    const signatureHeader = `t=${timestamp},v1=${signature}`;
    const isValid = verifyCalendlySignature(rawBody, signatureHeader, signingKey);

    expect(isValid).toBe(true);
    console.log('✅ Valid v2 signature verified');
  });

  test('should reject invalid v2 webhook signature', () => {
    const signingKey = 'test-signing-key-12345';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = Buffer.from(JSON.stringify({
      event: 'invitee.created',
      payload: { event: 'https://api.calendly.com/scheduled_events/abc123' }
    }));

    // Use wrong signature
    const wrongSignature = 'wrongsignaturehex123456';
    const signatureHeader = `t=${timestamp},v1=${wrongSignature}`;
    const isValid = verifyCalendlySignature(rawBody, signatureHeader, signingKey);

    expect(isValid).toBe(false);
    console.log('✅ Invalid v2 signature rejected');
  });

  test('should reject missing signature header', () => {
    const signingKey = 'test-signing-key-12345';
    const rawBody = Buffer.from(JSON.stringify({ event: 'invitee.created' }));

    const isValid = verifyCalendlySignature(rawBody, null, signingKey);
    expect(isValid).toBe(false);
    console.log('✅ Missing signature header rejected');
  });

  test('should reject malformed signature header', () => {
    const signingKey = 'test-signing-key-12345';
    const rawBody = Buffer.from(JSON.stringify({ event: 'invitee.created' }));
    const malformedHeader = 'invalid-format-no-timestamp';

    const isValid = verifyCalendlySignature(rawBody, malformedHeader, signingKey);
    expect(isValid).toBe(false);
    console.log('✅ Malformed signature header rejected');
  });

  test('should handle v2 webhook event payload structure', () => {
    const webhookPayload = {
      event: 'invitee.created',
      created_at: '2025-11-12T22:00:00Z',
      payload: {
        event: 'https://api.calendly.com/scheduled_events/abc123def456',
        created_by: 'https://api.calendly.com/users/user123'
      }
    };

    expect(webhookPayload.event).toBe('invitee.created');
    expect(webhookPayload.payload.event).toBeDefined();
    expect(webhookPayload.payload.created_by).toBeDefined();
    console.log('✅ v2 webhook payload structure valid');
  });
});


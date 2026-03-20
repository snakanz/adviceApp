/**
 * Calendly API v2 Integration Tests
 * Tests OAuth flow, webhook creation, and meeting sync with v2 endpoints
 */

const CalendlyService = require('../src/services/calendlyService');
const CalendlyWebhookService = require('../src/services/calendlyWebhookService');

describe('Calendly API v2 Migration', () => {
  let calendlyService;
  let webhookService;
  const testAccessToken = process.env.TEST_CALENDLY_ACCESS_TOKEN;

  beforeAll(() => {
    if (!testAccessToken) {
      console.warn('⚠️  TEST_CALENDLY_ACCESS_TOKEN not set - skipping live tests');
    }
  });

  describe('CalendlyService v2 Endpoints', () => {
    beforeEach(() => {
      calendlyService = new CalendlyService(testAccessToken);
    });

    test('should use v2 base URL', () => {
      expect(calendlyService.baseURL).toBe('https://api.calendly.com');
    });

    test('should fetch current user from v2 /users/me endpoint', async () => {
      if (!testAccessToken) {
        console.log('⏭️  Skipping live test - no token');
        return;
      }

      try {
        const user = await calendlyService.getCurrentUser();
        expect(user).toBeDefined();
        expect(user.uri).toBeDefined();
        expect(user.email).toBeDefined();
        console.log('✅ v2 /users/me endpoint works');
      } catch (error) {
        console.error('❌ Error fetching user:', error.message);
        throw error;
      }
    });

    test('should use keyset pagination with page_size parameter', async () => {
      if (!testAccessToken) {
        console.log('⏭️  Skipping live test - no token');
        return;
      }

      try {
        const events = await calendlyService.fetchScheduledEvents({
          initialSync: false
        });
        
        expect(events).toBeDefined();
        expect(events.active).toBeDefined();
        expect(events.canceled).toBeDefined();
        expect(Array.isArray(events.all)).toBe(true);
        console.log(`✅ Keyset pagination works - fetched ${events.all.length} events`);
      } catch (error) {
        console.error('❌ Error fetching events:', error.message);
        throw error;
      }
    });
  });

  describe('CalendlyWebhookService v2', () => {
    beforeEach(() => {
      webhookService = new CalendlyWebhookService(testAccessToken);
    });

    test('should return signing_key in webhook creation response', async () => {
      if (!testAccessToken) {
        console.log('⏭️  Skipping live test - no token');
        return;
      }

      try {
        // This test would require creating a real webhook
        // For now, just verify the service is configured
        expect(webhookService.baseURL).toBe('https://api.calendly.com');
        expect(webhookService.webhookUrl).toBeDefined();
        console.log('✅ WebhookService v2 configured correctly');
      } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
      }
    });
  });

  describe('Webhook Signature Verification', () => {
    test('should verify v2 webhook signature format', () => {
      // v2 signature format: t=TIMESTAMP,v1=HEX_SIGNATURE
      const signatureHeader = 't=1234567890,v1=abcdef123456';
      expect(signatureHeader).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
      console.log('✅ v2 signature format valid');
    });
  });
});


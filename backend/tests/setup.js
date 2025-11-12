/**
 * Jest Test Setup
 * Configures environment and global test utilities
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// Suppress console logs during tests (unless verbose)
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Set test timeout
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  /**
   * Generate mock Calendly webhook signature
   */
  generateMockSignature: (payload, signingKey) => {
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    const signedContent = timestamp + '.' + rawBody;
    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(signedContent);
    const signature = hmac.digest('hex');
    
    return {
      header: `t=${timestamp},v1=${signature}`,
      timestamp,
      signature
    };
  },

  /**
   * Generate mock Calendly event
   */
  generateMockEvent: (overrides = {}) => {
    return {
      uri: 'https://api.calendly.com/scheduled_events/abc123def456',
      name: 'Test Meeting',
      status: 'active',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600000).toISOString(),
      location: {
        type: 'zoom',
        join_url: 'https://zoom.us/j/123456789'
      },
      ...overrides
    };
  },

  /**
   * Generate mock webhook payload
   */
  generateMockWebhookPayload: (eventType = 'invitee.created', overrides = {}) => {
    return {
      event: eventType,
      created_at: new Date().toISOString(),
      payload: {
        event: 'https://api.calendly.com/scheduled_events/abc123def456',
        created_by: 'https://api.calendly.com/users/user123',
        ...overrides
      }
    };
  }
};

console.log('✅ Test environment configured');


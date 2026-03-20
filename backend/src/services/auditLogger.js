const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const logger = require('../utils/logger');

/**
 * Audit Logger — records security-relevant events to audit_logs table.
 *
 * Events: login, logout, client.create, client.update, client.delete,
 *         meeting.create, meeting.delete, calendar.connect, calendar.disconnect,
 *         auth.failure, settings.change
 */
async function logAudit(userId, action, resource, { resourceId = null, details = null, ipAddress = null } = {}) {
  if (!isSupabaseAvailable()) return;

  try {
    const { error } = await getSupabase()
      .from('audit_logs')
      .insert({
        user_id: userId,
        action,
        resource,
        resource_id: resourceId,
        details: details ? JSON.stringify(details) : null,
        ip_address: ipAddress
      });

    if (error) {
      // Don't throw — audit logging should never break the main flow
      logger.warn('Audit log insert failed:', error.message);
    }
  } catch (err) {
    logger.warn('Audit logger error:', err.message);
  }
}

/**
 * Express middleware helper to extract IP from request
 */
function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
}

module.exports = { logAudit, getClientIp };

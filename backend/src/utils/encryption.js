const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Get encryption key from environment (must be 32 bytes / 64 hex chars)
function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // If no key is set, return null to signal encryption is disabled
    return null;
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (256 bits)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns a combined string: iv:encrypted:tag (all hex-encoded).
 * If ENCRYPTION_KEY is not set, returns the plaintext unchanged (graceful fallback).
 */
function encrypt(plaintext) {
  if (!plaintext) return plaintext;

  const key = getKey();
  if (!key) return plaintext; // No key = no encryption (dev/migration mode)

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `enc:${iv.toString('hex')}:${encrypted}:${tag}`;
}

/**
 * Decrypt an encrypted string (format: enc:iv:encrypted:tag).
 * If the string doesn't start with 'enc:', it's treated as plaintext (backward-compatible).
 */
function decrypt(ciphertext) {
  if (!ciphertext) return ciphertext;

  // If not encrypted (legacy plaintext), return as-is
  if (!ciphertext.startsWith('enc:')) return ciphertext;

  const key = getKey();
  if (!key) {
    throw new Error('ENCRYPTION_KEY required to decrypt tokens');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const tag = Buffer.from(parts[3], 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { encrypt, decrypt };

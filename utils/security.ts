import crypto from 'crypto';

// Encryption config for storing sensitive data (like pending passwords) securely
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || 'default-fallback-key-32-chars-long!'; // Must be 32 bytes

/**
 * Encrypts cleartext using AES-256-GCM.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts cyphertext using AES-256-GCM.
 * Falls back to returning the text as-is if it's not encrypted (for backward compatibility).
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // Return text as-is if it's not encrypted (e.g. legacy plain text)
    return encryptedText;
  }
  
  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt database payload, returning raw input:', err);
    return encryptedText;
  }
}



/**
 * Validates that a string matches a strict email format.
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  // RFC 5322 compliant strict email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}


export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 phone standard format
  return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
}

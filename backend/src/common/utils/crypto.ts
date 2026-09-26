// ==============================================================================
// SynapseLab — Cryptographic Utilities
// ==============================================================================
// Uses Argon2id for password hashing (OWASP recommendation).
// Falls back to bcryptjs if argon2 native module is unavailable.

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

let argon2: any = null;
let bcryptjs: any = null;

// Try to load argon2 first, fall back to bcryptjs
try {
  argon2 = require('argon2');
} catch {
  try {
    bcryptjs = require('bcryptjs');
  } catch {
    throw new Error('Neither argon2 nor bcryptjs is available for password hashing');
  }
}

/**
 * Hash a password using Argon2id (preferred) or bcryptjs (fallback).
 */
export async function hashPassword(password: string): Promise<string> {
  if (argon2) {
    return argon2.hash(password, {
      type: 2, // argon2id
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }
  if (bcryptjs) {
    return bcryptjs.hash(password, 12);
  }
  throw new Error('No password hashing library available');
}

/**
 * Verify a password against a hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (argon2 && hash.startsWith('$argon2')) {
    return argon2.verify(hash, password);
  }
  if (bcryptjs && hash.startsWith('$2')) {
    return bcryptjs.compare(password, hash);
  }
  // Try argon2 first if available
  if (argon2) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // Not an argon2 hash
    }
  }
  if (bcryptjs) {
    return bcryptjs.compare(password, hash);
  }
  throw new Error('No password hashing library available');
}

/**
 * Hash a string using SHA-256. Used for token hashing (not passwords).
 */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate a cryptographically secure pseudonymous participant code.
 */
export function generatePseudonymousCode(): string {
  const prefix = 'P';
  const random = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}-${random.slice(8, 12)}-${random.slice(12)}`;
}

/**
 * Generate a UUID v4.
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generate a cryptographically secure random string.
 */
export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Compute SHA-256 hash of a configuration object (for config snapshots).
 */
export function computeConfigHash(config: unknown): string {
  const serialized = JSON.stringify(config, Object.keys(config as object).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Hash consent text for integrity verification.
 */
export function hashConsentText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

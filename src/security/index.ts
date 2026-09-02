import crypto from 'crypto';
import { getConfig } from '../config/index.ts';

// Normalize email: trim, lowercase, standardize
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

// Compute SHA-256 hash of normalized email
export function hashNormalizedEmail(email: string): string {
  const normalized = normalizeEmail(email);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Mask email for display in admin cards (e.g. j***@example.com)
export function maskEmail(email: string): string {
  if (!email) return '***@***.***';
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***.***';
  const [local, domain] = parts;
  const maskedLocal = local.length > 1 ? `${local[0]}***` : '***';
  return `${maskedLocal}@${domain}`;
}

// Compute SHA-256 hash of a buffer or string (for file content verification)
export function computeSha256(content: Buffer | Uint8Array | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// In-memory rate limiting with persistence support
interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  identifier: string,
  maxAttempts = getConfig().maxEmailVerificationAttempts,
  windowMinutes = getConfig().verificationWindowMinutes
): { allowed: boolean; remainingAttempts: number; resetTimeMs: number } {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const entry = rateLimitMap.get(identifier);

  if (!entry) {
    rateLimitMap.set(identifier, { attempts: 1, firstAttemptAt: now });
    return {
      allowed: true,
      remainingAttempts: maxAttempts - 1,
      resetTimeMs: now + windowMs
    };
  }

  // Check if window has expired
  if (now - entry.firstAttemptAt > windowMs) {
    // reset window
    rateLimitMap.set(identifier, { attempts: 1, firstAttemptAt: now });
    return {
      allowed: true,
      remainingAttempts: maxAttempts - 1,
      resetTimeMs: now + windowMs
    };
  }

  // Still in window
  entry.attempts += 1;
  rateLimitMap.set(identifier, entry);

  if (entry.attempts > maxAttempts) {
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTimeMs: entry.firstAttemptAt + windowMs
    };
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - entry.attempts,
    resetTimeMs: entry.firstAttemptAt + windowMs
  };
}

export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

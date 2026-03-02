const buckets = new Map<string, { tokens: number; lastMs: number }>();

const CAPACITY = 20;
const REFILL_PER_SEC = 0.33;

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, lastMs: now };
  const elapsedSec = (now - bucket.lastMs) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSec * REFILL_PER_SEC);
  bucket.lastMs = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const needed = 1 - bucket.tokens;
    return { allowed: false, retryAfterSec: Math.ceil(needed / REFILL_PER_SEC) };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { allowed: true };
}

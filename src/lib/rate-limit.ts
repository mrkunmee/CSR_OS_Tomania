/**
 * Lightweight in-process fixed-window rate limiter (Blueprint §15).
 *
 * Protects expensive/sensitive actions (AI calls, login). This is per-instance
 * and in-memory — good for a single Node process. A multi-instance production
 * deployment should back this with Redis (Upstash) so limits are shared; the
 * call sites stay the same.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const MAX_TRACKED = 5000; // crude guard against unbounded growth

export type RateResult = { ok: boolean; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    if (buckets.size > MAX_TRACKED) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfterSec: 0 };
}

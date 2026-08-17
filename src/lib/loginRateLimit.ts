// In-memory, IP-keyed rate limiting for /admin login attempts. State lives
// in module scope for the lifetime of this Node process — it resets on
// redeploy, and does not survive multiple app instances. Acceptable at
// this project's homelab scale; a shared store (Redis etc.) would be the
// upgrade if this ever runs as more than one instance.

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

// Ceiling on how many keys we'll track before sweeping expired buckets.
// Nothing evicts live buckets, so an attacker cycling many distinct keys
// (spoofed X-Forwarded-For hops, say) can't grow this map without bound
// faster than entries age out of the window.
const MAX_TRACKED_KEYS = 10_000

type Bucket = { count: number; resetAt: number }

const attempts = new Map<string, Bucket>()

export function isRateLimited(key: string, now: number = Date.now()): boolean {
  const bucket = attempts.get(key)
  if (!bucket) return false
  if (now >= bucket.resetAt) {
    attempts.delete(key)
    return false
  }
  return bucket.count >= MAX_ATTEMPTS
}

// Deletes every bucket whose window has already elapsed. Called only when
// the map hits MAX_TRACKED_KEYS and a brand-new key needs inserting — a full
// sweep at that point is cheap enough and far simpler than a timer or LRU.
function sweepExpired(now: number): void {
  for (const [existingKey, bucket] of attempts) {
    if (now >= bucket.resetAt) attempts.delete(existingKey)
  }
}

export function recordFailedAttempt(key: string, now: number = Date.now()): void {
  const bucket = attempts.get(key)
  if (!bucket || now >= bucket.resetAt) {
    if (!bucket && attempts.size >= MAX_TRACKED_KEYS) sweepExpired(now)
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  bucket.count += 1
}

// Exposed for tests only — clears all in-memory rate-limit state so tests
// don't leak counters into each other.
export function _resetForTests(): void {
  attempts.clear()
}

// Exposed for tests only — lets the growth-cap test observe that expired
// buckets actually get swept rather than accumulating forever.
export function _trackedKeyCountForTests(): number {
  return attempts.size
}

export const _MAX_TRACKED_KEYS_FOR_TESTS = MAX_TRACKED_KEYS

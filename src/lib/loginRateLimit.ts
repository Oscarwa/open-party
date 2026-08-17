// In-memory, IP-keyed rate limiting for /admin login attempts. State lives
// in module scope for the lifetime of this Node process — it resets on
// redeploy, and does not survive multiple app instances. Acceptable at
// this project's homelab scale; a shared store (Redis etc.) would be the
// upgrade if this ever runs as more than one instance.

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

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

export function recordFailedAttempt(key: string, now: number = Date.now()): void {
  const bucket = attempts.get(key)
  if (!bucket || now >= bucket.resetAt) {
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

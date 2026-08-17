import { describe, it, expect, beforeEach } from 'vitest'
import {
  isRateLimited,
  recordFailedAttempt,
  _resetForTests,
  _trackedKeyCountForTests,
  _MAX_TRACKED_KEYS_FOR_TESTS,
} from '../../src/lib/loginRateLimit'

describe('login rate limiter', () => {
  beforeEach(() => {
    _resetForTests()
  })

  it('is not rate limited before any failures', () => {
    expect(isRateLimited('1.2.3.4')).toBe(false)
  })

  it('is not rate limited after fewer than 5 failures', () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt('1.2.3.4')
    expect(isRateLimited('1.2.3.4')).toBe(false)
  })

  it('is rate limited after 5 failures within the window', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt('1.2.3.4')
    expect(isRateLimited('1.2.3.4')).toBe(true)
  })

  it('tracks separate keys independently', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt('1.2.3.4')
    expect(isRateLimited('5.6.7.8')).toBe(false)
  })

  it('resets after the window passes', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) recordFailedAttempt('1.2.3.4', now)
    expect(isRateLimited('1.2.3.4', now)).toBe(true)
    expect(isRateLimited('1.2.3.4', now + 16 * 60 * 1000)).toBe(false)
  })

  it('sweeps expired buckets instead of growing without bound', () => {
    const now = Date.now()
    for (let i = 0; i < _MAX_TRACKED_KEYS_FOR_TESTS; i++) {
      recordFailedAttempt(`stale-${i}`, now)
    }
    expect(_trackedKeyCountForTests()).toBe(_MAX_TRACKED_KEYS_FOR_TESTS)

    // A new key inserted once the cap is reached, after those buckets have
    // expired, sweeps them all rather than pushing the map past the cap.
    const later = now + 16 * 60 * 1000
    recordFailedAttempt('fresh', later)
    expect(_trackedKeyCountForTests()).toBe(1)
    expect(isRateLimited('fresh', later)).toBe(false)
  })

  it('keeps unexpired buckets when sweeping at the cap', () => {
    const now = Date.now()
    for (let i = 0; i < _MAX_TRACKED_KEYS_FOR_TESTS; i++) {
      recordFailedAttempt(`live-${i}`, now)
    }
    // Nothing has expired, so the sweep frees nothing and the live counters
    // survive — a rate-limited attacker can't flush their own bucket by
    // cycling keys.
    for (let i = 0; i < 4; i++) recordFailedAttempt('live-0', now)
    expect(isRateLimited('live-0', now)).toBe(true)
    recordFailedAttempt('fresh', now)
    expect(isRateLimited('live-0', now)).toBe(true)
    expect(_trackedKeyCountForTests()).toBe(_MAX_TRACKED_KEYS_FOR_TESTS + 1)
  })
})

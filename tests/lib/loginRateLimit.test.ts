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

  it('is not limited at the default threshold when a higher one is passed', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) recordFailedAttempt('__global__', now)
    // Same bucket, read two ways: exhausted at the default 5, nowhere near
    // a backstop threshold of 50.
    expect(isRateLimited('__global__', now)).toBe(true)
    expect(isRateLimited('__global__', now, 50)).toBe(false)
  })

  it('is limited once the higher explicit threshold is reached', () => {
    const now = Date.now()
    for (let i = 0; i < 49; i++) recordFailedAttempt('__global__', now)
    expect(isRateLimited('__global__', now, 50)).toBe(false)
    recordFailedAttempt('__global__', now)
    expect(isRateLimited('__global__', now, 50)).toBe(true)
  })

  it('does not lock out a second key when one key trips the default limit', () => {
    // The lockout scenario the global backstop's own threshold closes: an
    // attacker burns 5 attempts, which also lands 5 on the shared global
    // key. The admin, on a different IP, must still get through — the
    // global key is only limited at its much higher backstop threshold.
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt('9.9.9.9', now)
      recordFailedAttempt('__global__', now)
    }
    expect(isRateLimited('9.9.9.9', now)).toBe(true)
    expect(isRateLimited('1.2.3.4', now)).toBe(false)
    expect(isRateLimited('__global__', now, 50)).toBe(false)
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

import { describe, it, expect, beforeEach } from 'vitest'
import {
  isRateLimited,
  recordFailedAttempt,
  _resetForTests,
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
})

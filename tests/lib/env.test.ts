import { describe, it, expect } from 'vitest'
import { loadEnv } from '../../src/lib/env'

describe('loadEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/open_party',
    WAHA_URL: 'http://waha:3000',
    WAHA_SESSION: 'default',
    SESSION_SECRET: 'a'.repeat(32),
    ADMIN_PASSWORD: 'a-twelve-plus-character-password',
  }

  it('returns parsed env when all required vars are present and valid', () => {
    const env = loadEnv(validEnv)
    expect(env).toEqual(validEnv)
  })

  it('throws a readable error when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...rest } = validEnv
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/)
  })

  it('throws when DATABASE_URL is not a valid URL', () => {
    expect(() =>
      loadEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })
    ).toThrow(/DATABASE_URL/)
  })

  it('throws when SESSION_SECRET is shorter than 32 characters', () => {
    expect(() =>
      loadEnv({ ...validEnv, SESSION_SECRET: 'short' })
    ).toThrow(/SESSION_SECRET/)
  })

  it('throws when ADMIN_PASSWORD is shorter than 12 characters', () => {
    expect(() =>
      loadEnv({ ...validEnv, ADMIN_PASSWORD: 'short' })
    ).toThrow(/ADMIN_PASSWORD/)
  })
})

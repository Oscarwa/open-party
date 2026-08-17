import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../src/middleware'
import { createSessionToken, SESSION_COOKIE_NAME } from '../src/lib/adminSession'
import { createAttendeeSessionToken, ATTENDEE_SESSION_COOKIE_NAME } from '../src/lib/attendeeSession'
import { loadEnv } from '../src/lib/env'

function makeRequest(
  path: string,
  cookies: Partial<Record<'admin' | 'attendee', string>> = {},
) {
  const parts: string[] = []
  if (cookies.admin !== undefined) parts.push(`${SESSION_COOKIE_NAME}=${cookies.admin}`)
  if (cookies.attendee !== undefined) parts.push(`${ATTENDEE_SESSION_COOKIE_NAME}=${cookies.attendee}`)
  const headers: Record<string, string> = {}
  if (parts.length > 0) headers.cookie = parts.join('; ')
  return new NextRequest(new URL(path, 'https://example.ts.net'), { headers })
}

describe('admin gating', () => {
  it('redirects to /admin/login for /admin requests without a session cookie', async () => {
    const response = await middleware(makeRequest('/admin'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/admin/login')
  })

  it('allows /admin requests with a valid admin session cookie', async () => {
    const env = loadEnv()
    const token = await createSessionToken(env.SESSION_SECRET)
    const response = await middleware(makeRequest('/admin', { admin: token }))
    expect(response.status).toBe(200)
  })

  it('redirects requests with an invalid admin session cookie', async () => {
    const response = await middleware(makeRequest('/admin', { admin: 'not-a-real-token' }))
    expect(response.status).toBe(307)
  })

  it('always allows /admin/login, regardless of cookie state', async () => {
    const response = await middleware(makeRequest('/admin/login'))
    expect(response.status).toBe(200)
  })
})

describe('attendee gating', () => {
  it('redirects to / for /events requests without an attendee session cookie', async () => {
    const response = await middleware(makeRequest('/events/some-event-id'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/')
  })

  it('allows /events requests with a valid attendee session cookie', async () => {
    const env = loadEnv()
    const token = await createAttendeeSessionToken('11111111-1111-1111-1111-111111111111', env.SESSION_SECRET)
    const response = await middleware(makeRequest('/events/some-event-id', { attendee: token }))
    expect(response.status).toBe(200)
  })

  it('redirects /events requests with an invalid attendee session cookie', async () => {
    const response = await middleware(makeRequest('/events/some-event-id', { attendee: 'not-a-real-token' }))
    expect(response.status).toBe(307)
  })

  it('rejects an admin session cookie as an attendee session — the cross-type check that matters most', async () => {
    const env = loadEnv()
    const adminToken = await createSessionToken(env.SESSION_SECRET)
    const response = await middleware(makeRequest('/events/some-event-id', { attendee: adminToken }))
    expect(response.status).toBe(307)
  })
})

describe('ungated routes', () => {
  it('does not gate /', async () => {
    const response = await middleware(makeRequest('/'))
    expect(response.status).toBe(200)
  })

  it('does not gate /e/[token] (the entry point that establishes the session)', async () => {
    const response = await middleware(makeRequest('/e/some-token'))
    expect(response.status).toBe(200)
  })
})

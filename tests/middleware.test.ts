import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../src/middleware'
import { createSessionToken, SESSION_COOKIE_NAME } from '../src/lib/adminSession'
import { loadEnv } from '../src/lib/env'

function makeRequest(path: string, sessionToken?: string) {
  const headers: Record<string, string> = {}
  if (sessionToken !== undefined) {
    headers.cookie = `${SESSION_COOKIE_NAME}=${sessionToken}`
  }
  return new NextRequest(new URL(path, 'https://example.ts.net'), { headers })
}

describe('admin gating middleware', () => {
  it('redirects to /admin/login for /admin requests without a session cookie', async () => {
    const response = await middleware(makeRequest('/admin'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/admin/login')
  })

  it('allows /admin requests with a valid session cookie', async () => {
    const env = loadEnv()
    const token = await createSessionToken(env.SESSION_SECRET)
    const response = await middleware(makeRequest('/admin', token))
    expect(response.status).toBe(200)
  })

  it('redirects requests with an invalid session cookie', async () => {
    const response = await middleware(makeRequest('/admin', 'not-a-real-token'))
    expect(response.status).toBe(307)
  })

  it('always allows /admin/login, regardless of cookie state', async () => {
    const response = await middleware(makeRequest('/admin/login'))
    expect(response.status).toBe(200)
  })

  it('does not gate public routes', async () => {
    const response = await middleware(makeRequest('/'))
    expect(response.status).toBe(200)
  })
})

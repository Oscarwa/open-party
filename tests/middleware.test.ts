import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../src/middleware'

function makeRequest(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, 'https://example.ts.net'), { headers })
}

describe('admin gating middleware', () => {
  it('returns 404 for /admin requests without a Tailscale identity header', () => {
    const response = middleware(makeRequest('/admin'))
    expect(response.status).toBe(404)
  })

  it('allows /admin requests carrying a Tailscale identity header', () => {
    const response = middleware(
      makeRequest('/admin', { 'Tailscale-User-Login': 'oscar@github' })
    )
    expect(response.status).toBe(200)
  })

  it('does not gate public routes', () => {
    const response = middleware(makeRequest('/'))
    expect(response.status).toBe(200)
  })
})

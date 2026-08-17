import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSessionToken, SESSION_COOKIE_NAME } from '../../src/lib/adminSession'

// requireAdminSession is the per-action auth check that every mutating
// Server Action in src/lib/actions/events.ts calls first. It's the layer
// that holds if a request ever reaches an action without passing
// src/middleware.ts, so it has to fail closed on its own.

const cookieJar = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
  }),
  headers: async () => new Headers(),
}))

const SECRET = 'test-session-secret-at-least-32-chars'

describe('requireAdminSession', () => {
  beforeEach(() => {
    cookieJar.clear()
  })

  it('throws when no session cookie is present', async () => {
    const { requireAdminSession } = await import('../../src/lib/actions/auth')
    await expect(requireAdminSession()).rejects.toThrow(/Not authenticated/)
  })

  it('throws when the session cookie is not a valid token', async () => {
    cookieJar.set(SESSION_COOKIE_NAME, 'not-a-real-token')
    const { requireAdminSession } = await import('../../src/lib/actions/auth')
    await expect(requireAdminSession()).rejects.toThrow(/Not authenticated/)
  })

  it('throws when the session cookie was signed with a different secret', async () => {
    cookieJar.set(
      SESSION_COOKIE_NAME,
      await createSessionToken('a-completely-different-secret-32c'),
    )
    const { requireAdminSession } = await import('../../src/lib/actions/auth')
    await expect(requireAdminSession()).rejects.toThrow(/Not authenticated/)
  })

  it('throws when the session cookie has expired', async () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
    cookieJar.set(SESSION_COOKIE_NAME, await createSessionToken(SECRET, thirtyOneDaysAgo))
    const { requireAdminSession } = await import('../../src/lib/actions/auth')
    await expect(requireAdminSession()).rejects.toThrow(/Not authenticated/)
  })

  it('resolves for a valid session cookie', async () => {
    cookieJar.set(SESSION_COOKIE_NAME, await createSessionToken(SECRET))
    const { requireAdminSession } = await import('../../src/lib/actions/auth')
    await expect(requireAdminSession()).resolves.toBeUndefined()
  })
})

// The business layer is mocked so that "did this action touch the database"
// is directly observable: any call through to src/lib/events would throw.
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('redirect called')
  },
}))
vi.mock('@/lib/events', () => {
  const forbidden = (name: string) => () => {
    throw new Error(`${name} reached the database without a session`)
  }
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        // Let the module namespace be awaited/introspected normally; only
        // real named imports are booby-trapped.
        if (typeof prop !== 'string' || prop === 'then' || prop === 'default') {
          return undefined
        }
        return forbidden(prop)
      },
    },
  ) as Record<string, unknown>
})

describe('mutating event actions reject an unauthenticated caller', () => {
  beforeEach(() => {
    cookieJar.clear()
  })

  it('every exported action in src/lib/actions/events.ts throws with no session', async () => {
    const actions = await import('../../src/lib/actions/events')
    const names = Object.keys(actions).filter((name) => name.endsWith('Action'))

    // Guard against the list silently shrinking — every action in that file
    // must be covered here.
    expect(names).toHaveLength(12)

    for (const name of names) {
      const action = actions[name as keyof typeof actions] as (
        formData: FormData,
      ) => Promise<void>
      await expect(
        action(new FormData()),
        `${name} should reject without a session`,
      ).rejects.toThrow(/Not authenticated/)
    }
  })
})

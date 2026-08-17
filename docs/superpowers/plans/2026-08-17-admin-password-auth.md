# Admin Password Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Tailnet-header-based admin gate with a real password. `/admin` becomes intentionally reachable at the public Funnel URL, protected by a single `ADMIN_PASSWORD`, a signed 30-day session cookie, and basic in-memory rate limiting on login attempts.

**Architecture:** Session token signing/verification and login rate-limiting are framework-agnostic modules (Web Crypto API, works in both the Edge middleware runtime and the Node Server Action runtime) — directly testable, no Next.js imports. `src/middleware.ts` checks for a valid session cookie instead of a Tailscale header. A new `/admin/login` page (exempted from the gate) posts to a login Server Action that rate-limits, checks the password with a constant-time comparison, and sets the session cookie on success.

**Tech Stack:** Same as prior phases — no new dependencies. Web Crypto (`crypto.subtle`, global in both runtimes) for HMAC signing, Node's `crypto.timingSafeEqual` for the password comparison (only ever runs in the Node Server Action runtime).

## Global Constraints

- `/admin` is now intentionally public — Tailnet placement is no longer any part of the security model. The password is the sole gate.
- Always require the password, regardless of how the request arrives (no Tailnet bypass) — one auth mechanism, no edge cases about header trust.
- `ADMIN_PASSWORD` is a plaintext env var (matches this project's existing convention for other secrets), compared with a constant-time check to avoid timing attacks.
- Session cookie: HMAC-signed (via `SESSION_SECRET`, already in use for this purpose per plan.md §17), `httpOnly`, `secure`, `sameSite=lax`, fixed 30-day expiry (not sliding).
- Rate limiting: in-memory, IP-keyed (via `X-Forwarded-For`, falling back to a single shared key if absent), 5 failed attempts per 15-minute window. Resetting on redeploy is an accepted tradeoff.
- No Tailscale/Funnel infrastructure changes — Funnel already exposes the whole app; this is purely an application-level change.
- Testing stays light/integration-focused: real logic, no mocks, targets the auth primitives and middleware behavior — no UI/component tests.

---

### Task 1: Session token core

**Files:**
- Create: `src/lib/adminSession.ts`
- Test: `tests/lib/adminSession.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SESSION_COOKIE_NAME` (the string constant `'admin_session'`), `createSessionToken(secret: string, now?: number): Promise<string>`, `verifySessionToken(token: string, secret: string, now?: number): Promise<boolean>` — all exported from `src/lib/adminSession.ts`. Task 4 (login/logout actions) and Task 5 (middleware) both import all three.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/adminSession.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createSessionToken, verifySessionToken } from '../../src/lib/adminSession'

const SECRET = 'test-session-secret-at-least-32-chars'

describe('admin session token', () => {
  it('accepts a freshly-signed token', async () => {
    const token = await createSessionToken(SECRET)
    expect(await verifySessionToken(token, SECRET)).toBe(true)
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken(SECRET)
    expect(
      await verifySessionToken(token, 'a-completely-different-secret-32c'),
    ).toBe(false)
  })

  it('rejects a token with a tampered expiry', async () => {
    const token = await createSessionToken(SECRET)
    const [expiresAt, signature] = token.split('.')
    const tampered = `${Number(expiresAt) + 1_000_000}.${signature}`
    expect(await verifySessionToken(tampered, SECRET)).toBe(false)
  })

  it('rejects a malformed token', async () => {
    expect(await verifySessionToken('not-a-real-token', SECRET)).toBe(false)
    expect(await verifySessionToken('', SECRET)).toBe(false)
  })

  it('rejects an expired token', async () => {
    const now = Date.now()
    const signedThirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000
    const token = await createSessionToken(SECRET, signedThirtyOneDaysAgo)
    expect(await verifySessionToken(token, SECRET, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/adminSession.test.ts`
Expected: FAIL — `src/lib/adminSession.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/adminSession.ts`**

```ts
// HMAC-signed session tokens for /admin. Uses the Web Crypto API
// (crypto.subtle), not Node's `crypto` module, because this needs to
// verify tokens from both the Edge middleware runtime and the Node
// Server Action runtime — Web Crypto is the one API available in both.

export const SESSION_COOKIE_NAME = 'admin_session'

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' } as const
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALGORITHM,
    false,
    ['sign', 'verify'],
  )
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export async function createSessionToken(
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const expiresAt = now + SESSION_DURATION_MS
  const key = await getKey(secret)
  const signature = await crypto.subtle.sign(
    ALGORITHM,
    key,
    new TextEncoder().encode(String(expiresAt)),
  )
  return `${expiresAt}.${toBase64Url(signature)}`
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  const [expiresAtRaw, signatureRaw] = token.split('.')
  if (!expiresAtRaw || !signatureRaw) return false

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt)) return false

  let signatureBytes: Uint8Array
  try {
    signatureBytes = fromBase64Url(signatureRaw)
  } catch {
    return false
  }

  const key = await getKey(secret)
  const isSignatureValid = await crypto.subtle.verify(
    ALGORITHM,
    key,
    signatureBytes,
    new TextEncoder().encode(expiresAtRaw),
  )
  if (!isSignatureValid) return false

  return expiresAt > now
}
```

`crypto.subtle.verify` performs a constant-time comparison internally, so no separate timing-safe check is needed here — that's specifically for the plaintext password comparison in Task 4.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/adminSession.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminSession.ts tests/lib/adminSession.test.ts
git commit -m "feat: add HMAC-signed admin session tokens"
```

---

### Task 2: Login rate limiter

**Files:**
- Create: `src/lib/loginRateLimit.ts`
- Test: `tests/lib/loginRateLimit.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `isRateLimited(key: string, now?: number): boolean` and `recordFailedAttempt(key: string, now?: number): void` from `src/lib/loginRateLimit.ts`. Task 4 (login action) calls both.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/loginRateLimit.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/loginRateLimit.test.ts`
Expected: FAIL — `src/lib/loginRateLimit.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/loginRateLimit.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/loginRateLimit.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/loginRateLimit.ts tests/lib/loginRateLimit.test.ts
git commit -m "feat: add in-memory login rate limiter"
```

---

### Task 3: `ADMIN_PASSWORD` env wiring

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `tests/lib/env.test.ts`
- Modify: `vitest.config.ts`
- Modify: `.env.example`
- Modify: `Dockerfile`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ADMIN_PASSWORD: string` added to the `Env` type returned by `loadEnv()`. Task 4 (login action) reads `env.ADMIN_PASSWORD`. This task must land as one atomic change — `loadEnv()` becomes stricter in the same commit that updates every place a valid env is assumed (tests' default fixture, Vitest's injected test env, the Docker build-stage placeholders), or every other test file that transitively calls `loadEnv()` breaks.

- [ ] **Step 1: Write the failing test**

In `tests/lib/env.test.ts`, add `ADMIN_PASSWORD` to the existing `validEnv` fixture and add a new test. Replace the full file:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: FAIL — `ADMIN_PASSWORD` isn't in the schema yet, so the first test's `toEqual` fails (extra key) and the new test's `toThrow` doesn't match (no error thrown at all).

- [ ] **Step 3: Add `ADMIN_PASSWORD` to the schema in `src/lib/env.ts`**

```ts
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  WAHA_URL: z.string().url(),
  WAHA_SESSION: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ADMIN_PASSWORD: z.string().min(12),
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add `ADMIN_PASSWORD` to Vitest's injected test environment**

In `vitest.config.ts`, add `ADMIN_PASSWORD` to the `test.env` object:

```ts
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://open_party:open_party@localhost:55432/open_party_test',
      WAHA_URL: process.env.WAHA_URL ?? 'http://localhost:3001',
      WAHA_SESSION: process.env.WAHA_SESSION ?? 'default',
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? 'test-session-secret-at-least-32-chars',
      ADMIN_PASSWORD:
        process.env.ADMIN_PASSWORD ?? 'test-admin-password-12-plus-chars',
    },
```

Without this, every other test file that transitively imports `src/db/client.ts` (which calls `loadEnv()` at import time) starts failing, since `ADMIN_PASSWORD` is now required.

- [ ] **Step 6: Add `ADMIN_PASSWORD` to `.env.example`**

Append to `.env.example`:

```text

# Password protecting /admin (now reachable at the public Funnel URL — see
# docs/deploy/tailscale.md). This is the ONLY thing gating the admin panel;
# use a long, random, unique value. 12+ characters minimum, enforced by
# src/lib/env.ts, but longer is better — this protects real guest phone
# numbers and the ability to create/publish/finalize events.
ADMIN_PASSWORD=
```

- [ ] **Step 7: Add the build-time placeholder to `Dockerfile`**

In `Dockerfile`, add `ADMIN_PASSWORD` alongside the other build-stage placeholders (same reasoning as the existing ones — see the comment already there):

```dockerfile
ENV DATABASE_URL="postgres://build:build@localhost:5432/build"
ENV WAHA_URL="http://build:3000"
ENV WAHA_SESSION="build"
ENV SESSION_SECRET="build-time-placeholder-not-a-real-secret-32c"
ENV ADMIN_PASSWORD="build-time-placeholder-password-12c"
RUN npm run build
```

- [ ] **Step 8: Run the full test suite**

Run: `docker compose --profile dev up -d postgres-test` (if not already running), then `npx vitest run`
Expected: all test files pass (this confirms Step 5's fix — no other file broke from the stricter schema).

- [ ] **Step 9: Verify the Docker build still succeeds**

Run: `docker build -t open-party-test-build .`
Expected: succeeds (confirms Step 7's fix).

- [ ] **Step 10: Commit**

```bash
git add src/lib/env.ts tests/lib/env.test.ts vitest.config.ts .env.example Dockerfile
git commit -m "feat: add ADMIN_PASSWORD to the validated environment"
```

---

### Task 4: Login/logout actions, login page, and logout link

**Files:**
- Create: `src/lib/actions/auth.ts`
- Create: `src/app/admin/login/page.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `SESSION_COOKIE_NAME`, `createSessionToken` (Task 1); `isRateLimited`, `recordFailedAttempt` (Task 2); `loadEnv` (Task 3, for `env.ADMIN_PASSWORD` and `env.SESSION_SECRET`).
- Produces: `loginAction(formData: FormData)` and `logoutAction()` — both `'use server'`, exported from `src/lib/actions/auth.ts`. Task 5 (middleware) does not import these directly, but relies on the cookie they set/clear having the same name and shape as `SESSION_COOKIE_NAME`/`verifySessionToken` expect.

No automated tests in this task — per the design doc's confirmed testing scope, only the auth primitives (Tasks 1-2) and middleware (Task 5) get dedicated tests; the Server Action wrappers and pages are thin glue, consistent with how Phase 2 treated its action wrappers. Verify manually in Step 4.

- [ ] **Step 1: Implement `src/lib/actions/auth.ts`**

```ts
'use server'

import { timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { loadEnv } from '@/lib/env'
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/adminSession'
import { isRateLimited, recordFailedAttempt } from '@/lib/loginRateLimit'

function passwordsMatch(input: string, expected: string): boolean {
  const inputBuffer = Buffer.from(input)
  const expectedBuffer = Buffer.from(expected)
  // timingSafeEqual throws on a length mismatch, so check that first.
  // Bailing out early on length still doesn't leak *which* character of an
  // equal-length attempt was wrong, which is the property this guards.
  if (inputBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(inputBuffer, expectedBuffer)
}

// Tailscale Funnel is expected to forward X-Forwarded-For with the real
// client IP (standard reverse-proxy behavior), but this hasn't been
// independently verified against this specific deployment the way the
// old Tailscale-User-Login header behavior was (see the removed
// docs/deploy/tailscale.md verification step this plan's Task 6 deletes).
// If it's ever absent, every caller shares one 'global' bucket — a real
// but strictly worse-than-per-IP rate limit, not a silent bypass.
async function getClientKey(): Promise<string> {
  const headerList = await headers()
  const forwardedFor = headerList.get('x-forwarded-for')
  return forwardedFor ? forwardedFor.split(',')[0].trim() : 'global'
}

export async function loginAction(formData: FormData) {
  const env = loadEnv()
  const key = await getClientKey()

  if (isRateLimited(key)) {
    redirect('/admin/login?error=rate_limited')
  }

  const password = formData.get('password')
  if (typeof password !== 'string' || !passwordsMatch(password, env.ADMIN_PASSWORD)) {
    recordFailedAttempt(key)
    redirect('/admin/login?error=invalid_password')
  }

  const token = await createSessionToken(env.SESSION_SECRET)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days — matches the token's own expiry
  })

  redirect('/admin')
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect('/admin/login')
}
```

Note: `redirect()` throws internally (Next.js's mechanism for it) — calling it after `recordFailedAttempt`/inside the two early-exit branches is the normal, correct pattern here, not an error to catch.

- [ ] **Step 2: Create the login page**

Create `src/app/admin/login/page.tsx`:

```tsx
import { loginAction } from '@/lib/actions/auth'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main>
      <h2>Admin Login</h2>
      {error === 'invalid_password' ? <p>Incorrect password.</p> : null}
      {error === 'rate_limited' ? (
        <p>Too many attempts. Try again in a few minutes.</p>
      ) : null}
      <form action={loginAction}>
        <div>
          <label htmlFor="password">Password</label>
          <input type="password" id="password" name="password" required />
        </div>
        <button type="submit">Log in</button>
      </form>
    </main>
  )
}
```

`searchParams` is one of Next.js 15's dynamic APIs, so this page is automatically rendered per-request (no static-caching risk, unlike the bug fixed on `/admin/page.tsx` after Phase 2 — see the "force dynamic rendering" commit in this repo's history).

- [ ] **Step 3: Add a logout link to the admin layout**

Replace the full contents of `src/app/admin/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { logoutAction } from '@/lib/actions/auth'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header>
        <h1>Open Party — Admin</h1>
        <form action={logoutAction}>
          <button type="submit">Log out</button>
        </form>
      </header>
      {children}
    </div>
  )
}
```

This layout wraps every page under `/admin`, including `/admin/login` itself — so the logout button is technically visible there too even though there's nothing to log out of yet. Clicking it is harmless (clears an absent cookie, redirects to the same login page you're already on), and adding logic to hide it there would need a client component just for that one cosmetic case. Leaving it as a deliberate, accepted simplification.

- [ ] **Step 4: Verify manually**

Run: `npm run build` — expect success.

Run: `docker compose --profile dev up -d postgres`, `npm run dev &`. In a browser:
1. Visit `http://localhost:3000/admin` — confirm you're redirected to `/admin/login`.
2. Submit the wrong password — confirm "Incorrect password" shows and you're still on the login page.
3. Submit the wrong password 4 more times (5 total) — confirm the 6th attempt (even with the correct password) shows "Too many attempts."
4. Wait, or restart the dev server to clear the in-memory limiter, then submit the correct `ADMIN_PASSWORD` (from your `.env.local`) — confirm you land on `/admin` and see the Events list.
5. Click "Log out" — confirm you're redirected to `/admin/login` and visiting `/admin` again redirects you back there.

Stop the dev server (`kill %1`) when done.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/auth.ts src/app/admin/login src/app/admin/layout.tsx
git commit -m "feat: add login/logout actions, login page, and logout link"
```

---

### Task 5: Middleware rewrite

**Files:**
- Modify: `src/middleware.ts`
- Modify: `tests/middleware.test.ts`

**Interfaces:**
- Consumes: `SESSION_COOKIE_NAME`, `verifySessionToken` (Task 1); `loadEnv` (Task 3).
- Produces: the same `middleware(request: NextRequest)` export, now `async`, and the same `config.matcher`. Nothing later in this plan depends on it — this is the security-critical task, reviewed accordingly.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `tests/middleware.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/middleware.test.ts`
Expected: FAIL — the middleware still checks the old `Tailscale-User-Login` header, not a session cookie.

- [ ] **Step 3: Rewrite `src/middleware.ts`**

Replace the full file:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { loadEnv } from '@/lib/env'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/adminSession'

// /admin is intentionally public (reachable at the Funnel URL) — see
// docs/deploy/tailscale.md. The ONLY thing gating it is a valid, signed
// session cookie, set by src/lib/actions/auth.ts's loginAction after a
// correct ADMIN_PASSWORD check. /admin/login itself must stay reachable
// unconditionally, or nobody could ever log in.
const LOGIN_PATH = '/admin/login'

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname === LOGIN_PATH) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const env = loadEnv()
  const isValid = token ? await verifySessionToken(token, env.SESSION_SECRET) : false

  if (!isValid) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/middleware.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npx vitest run` — expect all files to pass.
Run: `npm run build` — expect success.

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts tests/middleware.test.ts
git commit -m "feat: gate /admin on a password session instead of a Tailscale header"
```

---

### Task 6: Rewrite the Tailscale deploy doc

**Files:**
- Modify: `docs/deploy/tailscale.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed elsewhere in this plan — this documents the end state of Tasks 1-5 for whoever deploys next.

- [ ] **Step 1: Replace the full contents of `docs/deploy/tailscale.md`**

```markdown
# Tailscale Serve / Funnel configuration

Run these on the homelab host after `docker compose up -d` has the `app`
container listening on `127.0.0.1:3000`. Flag names below match Tailscale's
serve/funnel CLI as of writing — confirm against `tailscale serve --help`
and `tailscale funnel --help` on your installed version before relying on
them, since this CLI has changed across Tailscale releases.

## Security model for /admin

**/admin is intentionally public.** Tailnet placement is no longer any
part of the admin security boundary — Funnel exposes the entire app (see
step 2 below), `/admin` included, and the app's own middleware
(`src/middleware.ts`) gates every `/admin/*` route (except `/admin/login`
itself) behind a real password, checked via a signed, 30-day session
cookie. There is no Tailscale-specific check left in the app; a device
reaching `/admin` from anywhere on the internet sees the same login page a
Tailnet device would.

This means the `ADMIN_PASSWORD` environment variable **is** the entire
security boundary for the admin panel. Use a long, random, unique value —
not something reused elsewhere — and keep `.env` off any machine or
channel you wouldn't trust with full admin access (create/edit/publish
events, see every guest's WhatsApp number).

Login attempts are rate-limited in-memory (5 failures per IP per 15
minutes) as a basic brute-force deterrent — not a substitute for a strong
password. The limiter resets on every redeploy and doesn't survive
multiple app instances.

1. Serve the full app to your Tailnet. Since `/admin` no longer depends on
   Tailnet placement for security, this is now purely a convenience
   (browsing via the tailnet hostname instead of the public one), not a
   security control:

   ```
   tailscale serve --bg 3000
   ```

2. Expose the app to the public internet via Funnel — the whole app,
   `/admin` included, is meant to be reachable here:

   ```
   tailscale funnel --bg 3000
   ```

   Run `tailscale funnel status` to confirm.

3. Verify:
   - From any device, anywhere: `https://<magicdns-name>.ts.net/admin`
     should redirect to `/admin/login` and show the login form.
   - Submit the wrong password: you should see "Incorrect password" and
     stay on the login page.
   - Submit it wrong 5 times in a row: the 6th attempt (even with the
     correct password) should show a rate-limit message. Wait 15 minutes,
     or redeploy (which clears the in-memory counter), to try again.
   - Submit the correct `ADMIN_PASSWORD`: you should land on `/admin` and
     stay logged in across page loads (check that an `admin_session`
     cookie is set) for up to 30 days.
   - Click "Log out": you should be redirected to `/admin/login`, and
     visiting `/admin` again should redirect you straight back there.

## Applying database migrations

The deployed container does not run migrations on startup, by design —
this is a homelab-scale deployment and a documented manual step is the
right amount of machinery. The image ships the SQL under
`/app/src/db/migrations` for reference, but you apply migrations with
`npm run db:migrate` from a machine that has Node and this repo checked
out (`npm ci`) and can reach the production Postgres — see the exact
command below.

`npm run db:migrate` (`scripts/migrate.ts`) is idempotent: it applies only
migrations not yet recorded in the target database, so re-running it is
safe.

Run it:

- after the very first deploy, before the app serves traffic (the schema
  does not exist yet), and
- after any deploy that includes a schema change (a new file under
  `src/db/migrations/`).

`scripts/migrate.ts` validates the full app environment via `loadEnv()`,
and it reads only the real process environment — it does not load `.env`
files itself. So the shell you run it in needs `WAHA_URL`, `WAHA_SESSION`,
`SESSION_SECRET`, and `ADMIN_PASSWORD` set as well as `DATABASE_URL`. The
easiest way is to source a populated env file and override the database
URL:

```bash
set -a && . ./.env.local && set +a
DATABASE_URL='postgres://<user>:<pass>@<prod-host>:<port>/<db>' \
  npm run db:migrate
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/deploy/tailscale.md
git commit -m "docs: rewrite admin security model for password-based public access"
```

---

## End-of-Phase Verification

- [ ] Run the full test suite: `docker compose --profile dev up -d postgres-test`, then `npx vitest run` — expect all tests across all files to pass: 50 tests across 8 files (the prior 37 across 6 files, plus this plan's two new files — `adminSession.test.ts` (5) and `loginRateLimit.test.ts` (5) — plus `env.test.ts` growing by 1 and `middleware.test.ts`'s 3 tests being replaced by 5).
- [ ] Run `npm run build` — expect success.
- [ ] Run `docker build -t open-party-test-build .` — expect success (confirms the build-stage placeholder fix from Task 3 still holds with the full feature in place).
- [ ] Walk through the full manual flow from Task 4 Step 4 once more end to end.
- [ ] Confirm `git log --oneline` shows six commits, one per task, on top of the prior history.

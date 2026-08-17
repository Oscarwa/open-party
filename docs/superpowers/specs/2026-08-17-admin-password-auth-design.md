# Admin Password Authentication — Design

## Overview

Reverses a Foundation-phase decision: `/admin` was designed to be reachable only via the Tailnet, with no in-app login, on the premise that Tailnet placement alone was sufficient protection. The user has decided they want `/admin` reachable at the public Funnel URL (e.g. to manage events from a device without Tailscale installed) — which means Tailnet placement can no longer be the security boundary. This adds real password authentication as the new, sole gate.

## Scope

**In scope:**
- A single admin password (`ADMIN_PASSWORD` env var), checked with a constant-time comparison.
- A signed, expiring session cookie issued on successful login.
- A public `/admin/login` page, exempted from the auth gate.
- Basic brute-force protection: in-memory, IP-keyed rate limiting on login attempts.
- A logout mechanism.
- Rewriting `docs/deploy/tailscale.md`'s admin security section, which currently describes a model (Tailnet placement + Tailscale-header check) this change replaces.

**Explicitly out of scope:**
- Any Tailscale/Funnel infrastructure change — Funnel is already mounted at the app's root path, so `/admin` is already reachable at the network level; only the application's own middleware was blocking it. This is a purely application-level change.
- Multiple admin accounts, password reset flows, 2FA — single admin, single static password, matches the project's single-tenant scope (plan.md §3).
- Removing the Tailscale-header check as a *bypass* — it's removed entirely, not kept as an alternate path. The user explicitly chose "always require the password" over "skip login when on Tailnet" for a single, simpler auth mechanism.
- Persistent/shared rate-limit state (Redis, DB-backed) — an in-memory `Map` is sufficient; state resetting on redeploy is an accepted tradeoff at this scale.

## Architecture

No new dependencies. Session signing uses the Web Crypto API (`crypto.subtle`), not Node's `crypto` module, because Next.js middleware runs on the Edge runtime by default and needs to verify the session cookie — Web Crypto works in both Edge and Node runtimes, so the same verify function is usable from both middleware and Server Actions. The login action's password comparison, which only ever runs in a Server Action (Node runtime), uses Node's `crypto.timingSafeEqual` for a constant-time check.

Following the core/action split established in Phase 2 (`src/lib/events.ts` vs `src/lib/actions/events.ts`): session sign/verify and the rate-limiter are framework-agnostic, directly testable functions; the login/logout Server Actions are thin wrappers that call them and handle cookies via `next/headers`.

### Session cookie

An HMAC-SHA256-signed token, base64url-encoded, containing an expiry timestamp — no server-side session store. Format: `<expiresAtMs>.<base64url(hmac-sha256(expiresAtMs, SESSION_SECRET))>`. Verifying re-computes the HMAC over the claimed expiry and compares it to the signature (constant-time), then checks the expiry hasn't passed. A tampered expiry fails signature verification; an expired-but-correctly-signed token fails the expiry check.

- `httpOnly`, `secure`, `sameSite=lax`, 30-day fixed expiry (not sliding — a login always grants exactly 30 days, doesn't refresh on activity).

### Middleware

Replaces the current `Tailscale-User-Login` header check entirely. New logic for any `/admin/*` request:
1. If the path is `/admin/login`, pass through unconditionally (must stay reachable to whoever isn't logged in yet).
2. Otherwise, read the session cookie; if missing, invalid, or expired, redirect to `/admin/login`.
3. Otherwise, pass through.

### Rate limiting

An in-memory `Map<string, { count: number; resetAt: number }>` inside the login action's module scope (survives across requests within the same long-lived Node process, resets on redeploy — acceptable). Keyed by the client IP from `X-Forwarded-For` (Tailscale Funnel forwards this reliably); if that header is ever absent, falls back to a single shared key so a lockout still applies globally rather than providing no protection at all. 5 failed attempts within a rolling 15-minute window locks that key out; further attempts (even correct ones) are rejected with a "too many attempts" message until the window expires. A successful login does not require clearing the counter — the next independent window handles that naturally.

### Pages

- `/admin/login` — a plain form (WhatsApp-number-style single field: just a password input), submitting to the login Server Action. Shows an error message on wrong password or active rate limit.
- `src/app/admin/layout.tsx` — gains a small logout form/link, visible on every gated admin page.

## Testing

Same light, integration-focused philosophy as prior phases:
- Session sign/verify: a freshly-signed token verifies as valid; a tampered token (flipped signature byte, altered expiry) is rejected; an expired-but-correctly-signed token is rejected.
- Rate limiter (pure logic, no Next.js/DB involved): allows up to 5 attempts, locks out the 6th within the window, allows again after the window resets.
- Middleware: a request with a valid session cookie passes through to `/admin`; a request with no cookie (or an invalid/expired one) to `/admin` redirects to `/admin/login`; a request to `/admin/login` itself always passes through regardless of cookie state.

No UI/component tests, consistent with every prior phase.

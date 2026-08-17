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

Login attempts are rate-limited in-memory as a basic brute-force deterrent
— not a substitute for a strong password. Two counters apply, and a failure
increments both; an attempt is blocked if either is exhausted:

- **Per client IP:** 5 failures per 15 minutes, keyed on the *rightmost*
  entry of `X-Forwarded-For` — the hop written by Funnel itself. The
  leftmost entry is whatever the client claimed and is not trusted, so
  spoofing that header doesn't earn a fresh bucket.
- **Global ceiling:** 50 failures per 15 minutes across all callers, as a
  backstop for the cases where per-IP keying degrades into one shared
  bucket (no `X-Forwarded-For` at all, or an extra trusted proxy hop in
  front of Funnel making the rightmost entry that proxy's address).

Per-IP limiting at 5 attempts per 15 minutes is the primary control. The
global ceiling is deliberately set an order of magnitude higher: it exists
only to bound a distributed or header-spoofing attacker, not to govern
normal use. Because `/admin/login` is public, a shared threshold would mean
any passer-by could lock the admin out with 5 wrong guesses; at 50, one
visitor fumbling their password can't take the panel down, while a
sustained attack still hits a ceiling. If the global bucket ever does trip,
it locks out *everyone* — including you — for 15 minutes. Both counters
reset on every redeploy and don't survive multiple app instances.

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
   - Submit it wrong 5 times in a row from one device: the 6th attempt
     (even with the correct password) should show a rate-limit message —
     that's the per-IP limit. A different IP is unaffected. Wait 15
     minutes, or redeploy (which clears the in-memory counter), to try
     again.
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

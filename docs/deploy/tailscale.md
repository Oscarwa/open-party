# Tailscale Serve / Funnel configuration

Run these on the homelab host after `docker compose up -d` has the `app`
container listening on `127.0.0.1:3000`. Flag names below match Tailscale's
serve/funnel CLI as of writing — confirm against `tailscale serve --help`
and `tailscale funnel --help` on your installed version before relying on
them, since this CLI has changed across Tailscale releases.

## Security model for /admin

**The Funnel path configuration is the primary boundary.** `/admin` stays
private because Funnel is only ever configured to expose the public path
prefixes — never a path that reaches `/admin`. Everything public rides on
Funnel; everything private is reachable only over the Tailnet via
`tailscale serve`. Getting step 2 below right is what actually keeps
`/admin` off the public internet, so verify it with `tailscale funnel
status` every time you change it.

**The app's middleware is defense in depth.** `src/middleware.ts` 404s any
`/admin/*` request that does not carry a `Tailscale-User-Login` header.
The intent is to survive a Funnel misconfiguration that accidentally
exposes `/admin`.

Its effectiveness rests on an assumption that Tailscale strips/overrides a
client-supplied `Tailscale-User-Login` header on Funnel-origin requests.

**Confirmed 2026-08-16** against this deployment (Tailscale client on
macOS, `tailscale funnel --bg 3100`, real public request via
`https://homelab.tail5d41d7.ts.net`): a forged
`Tailscale-User-Login: attacker@example.com` header sent over the public
Funnel URL still got `404` on `/admin`, while the identical request sent
directly to the container's local port (bypassing Tailscale) got `200` —
confirming Tailscale discards the header on the Funnel path and the
middleware's check is meaningful. This was verified for one specific
client version/setup, not guaranteed forever — re-run the check in step 4
after any Tailscale upgrade, and don't weaken the Funnel path config on
the assumption that the middleware will always catch it.

1. Serve the full app to your Tailnet only. This is what makes `/admin`
   reachable to you:

   ```
   tailscale serve --bg 3000
   ```

2. Expose ONLY the public routes to the internet via Funnel. Some
   Tailscale versions treat `--set-path=/` as "funnel the whole port"
   (which would expose `/admin` at the config level — exactly the
   situation the primary boundary is supposed to prevent) rather than an
   exact match on the literal `/` path. Run `tailscale funnel status`
   afterwards and confirm it lists only the paths you intended:

   ```
   tailscale funnel --bg --set-path=/ 3000
   ```

   As the app grows past this single public route, prefer mounting
   specific public route prefixes (e.g. `--set-path=/e` for the RSVP
   pages added in a later phase) instead of relying on the root mount,
   and never add a path prefix under `/admin`.

3. Verify normal behaviour:
   - From a device on your Tailnet: `https://<magicdns-name>.ts.net/admin`
     should load the admin stub page.
   - From a device off your Tailnet (e.g. phone on cellular data):
     `https://<magicdns-name>.ts.net/` should load the public stub page,
     and `https://<magicdns-name>.ts.net/admin` should return "Not found".

4. Verify the defense-in-depth layer actually holds (do this once, from an
   off-Tailnet device, after your first deploy and after any Tailscale
   upgrade). Try to forge the identity header against the public Funnel
   URL:

   ```
   curl -i -H 'Tailscale-User-Login: attacker@example.com' \
     https://<magicdns-name>.ts.net/admin
   ```

   Expected: `404` with "Not found" — Tailscale discarded your header and
   the middleware rejected the request.

   If you get the admin page instead, the header is **not** being
   stripped: the middleware is bypassable from the public internet and
   provides no protection at all. In that case the Funnel path config is
   your only boundary, so audit it (`tailscale funnel status`) and make
   certain nothing under `/admin` is exposed. File this as a bug against
   the app — the middleware would then need a stronger signal than a
   plain header to gate on.

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
files itself. So the shell you run it in needs `WAHA_URL`, `WAHA_SESSION`
and `SESSION_SECRET` set as well as `DATABASE_URL`. The easiest way is to
source a populated env file and override the database URL:

```bash
set -a && . ./.env.local && set +a
DATABASE_URL='postgres://<user>:<pass>@<prod-host>:<port>/<db>' \
  npm run db:migrate
```

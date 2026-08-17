# Tailscale Serve / Funnel configuration

Run these on the homelab host after `docker compose up -d` has the `app`
container listening on `127.0.0.1:3000`. Flag names below match Tailscale's
serve/funnel CLI as of writing — confirm against `tailscale serve --help`
and `tailscale funnel --help` on your installed version before relying on
them, since this CLI has changed across Tailscale releases.

## The actual protection for /admin

The real guarantee that `/admin` stays private is the app's own
`src/middleware.ts`: it 404s any `/admin/*` request that doesn't carry a
`Tailscale-User-Login` header. Tailscale only attaches that header to
requests it can attribute to an authenticated Tailnet peer — Funnel
traffic from the public internet never carries it, no matter how Funnel's
paths are configured. This holds even if the Funnel path config below is
ever misconfigured to cover more than intended, so treat the steps below
as complementary hardening, not the primary boundary.

1. Serve the full app to your Tailnet only. This is what makes `/admin`
   reachable to you:

   ```
   tailscale serve --bg 3000
   ```

2. Expose the public routes to the internet via Funnel. Some Tailscale
   versions treat `--set-path=/` as "funnel the whole port" (which would
   include `/admin` at the config level, relying entirely on the
   middleware above to still block it) rather than an exact match on the
   literal `/` path. Check `tailscale funnel status` after running this
   and confirm it lists only the paths you intended:

   ```
   tailscale funnel --bg --set-path=/ 3000
   ```

   As the app grows past this single public route, prefer mounting
   specific public route prefixes (e.g. `--set-path=/e` for the RSVP
   pages added in a later phase) instead of relying on the root mount,
   and never add a path prefix under `/admin`.

3. Verify:
   - From a device on your Tailnet: `https://<magicdns-name>.ts.net/admin`
     should load the admin stub page.
   - From a device off your Tailnet (e.g. phone on cellular data):
     `https://<magicdns-name>.ts.net/admin` should return "Not found",
     and `https://<magicdns-name>.ts.net/` should load the public stub
     page. The "Not found" response must hold here regardless of the
     Funnel path config above — if it doesn't, the middleware itself is
     broken and that's the bug to chase, not the Funnel config.

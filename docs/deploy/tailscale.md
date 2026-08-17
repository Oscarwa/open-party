# Tailscale Serve / Funnel configuration

Run these on the homelab host after `docker compose up -d` has the `app`
container listening on `127.0.0.1:3000`. Flag names below match Tailscale's
serve/funnel CLI as of writing — confirm against `tailscale serve --help`
and `tailscale funnel --help` on your installed version before relying on
them, since this CLI has changed across Tailscale releases.

1. Serve the full app to your Tailnet only. This is what makes `/admin`
   reachable to you:

   ```
   tailscale serve --bg 3000
   ```

2. Expose ONLY the public routes to the internet via Funnel. Funnel needs
   an explicit allowlist of paths — do not funnel the whole port, or
   `/admin` becomes public:

   ```
   tailscale funnel --bg --set-path=/ 3000
   ```

   As the app grows, add one `--set-path` per public route prefix (e.g.
   `/e` for the RSVP pages added in a later phase). Never add `/admin`.

3. Verify:
   - From a device on your Tailnet: `https://<magicdns-name>.ts.net/admin`
     should load the admin stub page.
   - From a device off your Tailnet (e.g. phone on cellular data):
     `https://<magicdns-name>.ts.net/admin` should return "Not found",
     and `https://<magicdns-name>.ts.net/` should load the public stub
     page.

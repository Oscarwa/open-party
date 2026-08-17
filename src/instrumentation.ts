// Next.js startup hook (https://nextjs.org/docs/app/guides/instrumentation).
// `register()` runs once per server process, before any route is handled.
//
// Lives in `src/` rather than the repo root because this project uses a `src`
// directory — Next.js resolves `instrumentation.ts` next to the `app`
// directory, so a root-level copy would be silently ignored.
//
// Validating the environment here makes a misconfigured deployment fail loudly
// at boot with a precise message, instead of surfacing later as a confusing
// build/render failure the first time some module imports `src/db/client.ts`.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { loadEnv } = await import('./lib/env')
    loadEnv()
  }
}

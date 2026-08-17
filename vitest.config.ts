import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    // Vitest does not read .env files into process.env, so modules that
    // validate the environment at import time (src/db/client.ts via
    // loadEnv()) need these here. Deterministic, checked-in defaults keep
    // the suite independent of any developer's local .env; a real shell
    // variable still wins.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://open_party:open_party@localhost:55432/open_party_test',
      WAHA_URL: process.env.WAHA_URL ?? 'http://localhost:3001',
      WAHA_SESSION: process.env.WAHA_SESSION ?? 'default',
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? 'test-session-secret-at-least-32-chars',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

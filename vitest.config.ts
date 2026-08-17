import { defineConfig, configDefaults } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    // Migrations run exactly once here, before any test file starts —
    // see tests/global-setup.ts. Individual test files must not call
    // migrate() themselves; two files doing so concurrently races on
    // Postgres's catalog (CREATE SCHEMA IF NOT EXISTS "drizzle").
    globalSetup: ['./tests/global-setup.ts'],
    // Test files share one physical test database and truncate tables
    // in their own beforeAll — safe only if files run one at a time.
    fileParallelism: false,
    // Exclude nested git worktrees living inside this checkout (this repo
    // is used with a harness that places worktrees under .claude/worktrees/
    // or .worktrees/). Without this, running the suite from a checkout that
    // has one of those directories present picks up every test file twice
    // — once here, once from the nested copy — and two copies of
    // tests/db/client.test.ts race each other's migrate() call against the
    // same database.
    exclude: [...configDefaults.exclude, '.claude/**', '.worktrees/**', 'worktrees/**'],
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

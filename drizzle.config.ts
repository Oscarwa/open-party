import { defineConfig } from 'drizzle-kit'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local into process.env manually since drizzle-kit doesn't do this automatically
const envLocalPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  const envLocalContent = fs.readFileSync(envLocalPath, 'utf-8')
  const lines = envLocalContent.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=')
      if (key) {
        process.env[key] = value
      }
    }
  }
}

// Deliberately does NOT use loadEnv() from src/lib/env.ts: that validates the
// whole app environment (SESSION_SECRET, WAHA_URL, ...), none of which a
// migration generator needs. Requiring them here would make `npm run db:generate`
// throw on a fresh clone whose .env.local is still the unfilled .env.example.
const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to run drizzle-kit. Set it in .env.local or the environment.'
  )
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
})

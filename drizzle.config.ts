import { defineConfig } from 'drizzle-kit'
import { loadEnv } from './src/lib/env'
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

const env = loadEnv()

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})

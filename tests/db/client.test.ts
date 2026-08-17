import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from '../../src/db/schema'
import { db } from '../../src/db/client'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://open_party:open_party@localhost:55432/open_party_test'

const queryClient = postgres(TEST_DATABASE_URL)
const testDb = drizzle(queryClient, { schema })

describe('db client', () => {
  beforeAll(async () => {
    await migrate(testDb, { migrationsFolder: './src/db/migrations' })
    // The round-trip test below inserts a fixed whatsapp_number, which is
    // unique — without this the suite only passes against a brand-new
    // database and fails on any second run.
    await queryClient`truncate table users restart identity cascade`
  })

  it('inserts and reads back a user', async () => {
    const [inserted] = await testDb
      .insert(schema.users)
      .values({ name: 'Oscar', whatsappNumber: '+15551234567' })
      .returning()

    const [found] = await testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, inserted.id))

    expect(found.name).toBe('Oscar')
    expect(found.whatsappNumber).toBe('+15551234567')
  })

  // Exercises the real src/db/client.ts module: importing it runs loadEnv()
  // and constructs the drizzle instance. The postgres driver connects lazily
  // on first query, so this does not require DATABASE_URL to point at the
  // test database — only that the environment validates.
  it('exports a constructed drizzle client from src/db/client', () => {
    expect(db).toBeDefined()
  })
})

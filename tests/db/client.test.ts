import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from '../../src/db/schema'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://open_party:open_party@localhost:55432/open_party_test'

const queryClient = postgres(TEST_DATABASE_URL)
const testDb = drizzle(queryClient, { schema })

describe('db client', () => {
  beforeAll(async () => {
    await migrate(testDb, { migrationsFolder: './src/db/migrations' })
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
})

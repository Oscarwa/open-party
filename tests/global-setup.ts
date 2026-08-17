import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export default async function setup() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    'postgres://open_party:open_party@localhost:55432/open_party_test'

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)
  await migrate(db, { migrationsFolder: './src/db/migrations' })
  await client.end()
}

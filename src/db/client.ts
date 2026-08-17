import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { loadEnv } from '../lib/env'
import * as schema from './schema'

const env = loadEnv()

const queryClient = postgres(env.DATABASE_URL)

export const db = drizzle(queryClient, { schema })

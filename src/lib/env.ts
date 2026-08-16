import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  WAHA_URL: z.string().url(),
  WAHA_SESSION: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  return result.data
}

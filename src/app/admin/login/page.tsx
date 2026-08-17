import { Alert, Input, Stack } from '@chakra-ui/react'
import { loginAction } from '@/lib/actions/auth'
import { PageShell } from '@/components/PageShell'
import { FieldGroup } from '@/components/FieldGroup'
import { Button } from '@/components/Button'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const errorMessage =
    error === 'invalid_password'
      ? 'Incorrect password.'
      : error === 'rate_limited'
        ? 'Too many attempts. Try again in a few minutes.'
        : null

  return (
    <PageShell title="Admin Login">
      {errorMessage ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{errorMessage}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : null}
      <form action={loginAction}>
        <Stack gap={5}>
          <FieldGroup label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" required />
          </FieldGroup>
          <Button type="submit" alignSelf="flex-start">
            Log in
          </Button>
        </Stack>
      </form>
    </PageShell>
  )
}

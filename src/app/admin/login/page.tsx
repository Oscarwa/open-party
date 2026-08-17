import { loginAction } from '@/lib/actions/auth'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main>
      <h2>Admin Login</h2>
      {error === 'invalid_password' ? <p>Incorrect password.</p> : null}
      {error === 'rate_limited' ? (
        <p>Too many attempts. Try again in a few minutes.</p>
      ) : null}
      <form action={loginAction}>
        <div>
          <label htmlFor="password">Password</label>
          <input type="password" id="password" name="password" required />
        </div>
        <button type="submit">Log in</button>
      </form>
    </main>
  )
}

import type { ReactNode } from 'react'
import { logoutAction } from '@/lib/actions/auth'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header>
        <h1>Open Party — Admin</h1>
        <form action={logoutAction}>
          <button type="submit">Log out</button>
        </form>
      </header>
      {children}
    </div>
  )
}

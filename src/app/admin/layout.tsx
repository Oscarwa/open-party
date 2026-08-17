import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header>
        <h1>Open Party — Admin</h1>
      </header>
      {children}
    </div>
  )
}

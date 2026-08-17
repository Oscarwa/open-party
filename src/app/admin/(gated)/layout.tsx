import type { ReactNode } from 'react'
import { logoutAction } from '@/lib/actions/auth'

// Layout for the gated admin routes only. Every route under this `(gated)`
// route group is behind src/middleware.ts's session check, so admin-only
// chrome and state-mutating Server Actions belong here — never in the outer
// `src/app/admin/layout.tsx`, which also wraps the unauthenticated
// `/admin/login` page.
//
// The `(gated)` parentheses make this an organizational group: it does not
// appear in any URL. `(gated)/page.tsx` still serves `/admin`,
// `(gated)/events/new/page.tsx` still serves `/admin/events/new`.
export default function GatedAdminLayout({ children }: { children: ReactNode }) {
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

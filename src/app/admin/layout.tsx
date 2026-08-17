import type { ReactNode } from 'react'

// Deliberately bare. This layout wraps BOTH the middleware-exempt
// `/admin/login` route and the gated `(gated)` route group, so anything
// rendered here is reachable by an unauthenticated visitor — and any
// Server Action wired into it becomes callable without a session.
//
// Keep it as a pass-through: gated-only chrome (the header, the log-out
// form) lives in `src/app/admin/(gated)/layout.tsx`, which only wraps
// routes that middleware has already gated. See src/middleware.ts.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}

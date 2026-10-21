import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// /api/csr2/* is a public prefix in middleware.js (the redeem flow is customer-facing),
// so admin-only csr2 routes must check the session themselves instead of relying on middleware.
export async function getSessionUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Route handlers can't always write cookies outside a Server Action — safe to ignore.
          }
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Separate bearer-token auth for the local AIO Tool (not a browser session) —
// same shared-secret pattern as CSR2_WORKER_TOKEN, just a distinct token so a
// leak of one doesn't also expose the other's capability.
export function isAdminToolAuthed(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return !!process.env.CSR2_ADMIN_TOKEN && token === process.env.CSR2_ADMIN_TOKEN
}

// True if either a logged-in admin session or the tool's bearer token is present.
export async function isAdminAuthed(request) {
  if (isAdminToolAuthed(request)) return true
  return !!(await getSessionUser())
}

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

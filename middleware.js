import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const PUBLIC_PREFIXES = ['/login', '/preview', '/overview', '/buy', '/api/lol-skins', '/api/border-skins', '/api/lol-checker', '/api/og', '/api/games']

const TOOL_CORS = {
  'Access-Control-Allow-Origin': 'http://localhost:35199',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function addCors(res) {
  Object.entries(TOOL_CORS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

export async function middleware(request) {
  const { pathname } = request.nextUrl
  const isLocalTool = (request.headers.get('origin') || '').startsWith('http://localhost:35199')

  if (request.method === 'OPTIONS' && isLocalTool) {
    return new NextResponse(null, { status: 200, headers: TOOL_CORS })
  }

  if (PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    const res = NextResponse.next()
    return isLocalTool ? addCors(res) : res
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return isLocalTool ? addCors(response) : response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',],
}

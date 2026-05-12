import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from '../../../../lib/google'
import { supabase } from '../../../../lib/supabase'

export const runtime = 'nodejs'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  console.log('Callback received, code:', code ? 'exists' : 'missing', 'error:', error)

  if (error || !code) {
    console.error('No code or error param:', error)
    return Response.redirect('http://localhost:3000?gmailError=true')
  }

  try {
    console.log('Exchanging code for token...')
    console.log('Client ID:', GOOGLE_CLIENT_ID ? 'exists' : 'MISSING')
    console.log('Client Secret:', GOOGLE_CLIENT_SECRET ? 'exists' : 'MISSING')
    console.log('Redirect URI:', GOOGLE_REDIRECT_URI)

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    console.log('Token response status:', tokenRes.status)
    console.log('Token response:', JSON.stringify(tokens))

    if (tokens.error) {
      console.error('Token error:', tokens.error, tokens.error_description)
      return Response.redirect('http://localhost:3000?gmailError=true')
    }

    console.log('Getting user info...')
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const user = await userRes.json()
    console.log('User:', JSON.stringify(user))

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    console.log('Saving to Supabase...')
    const { data, error: dbError } = await supabase.from('gmail_tokens').upsert({
      email: user.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt.toISOString(),
    }, { onConflict: 'email' })

    console.log('Supabase result:', JSON.stringify(data), 'error:', JSON.stringify(dbError))

    if (dbError) {
      console.error('DB error:', dbError.message)
      return Response.redirect('http://localhost:3000?gmailError=true')
    }

    console.log('Success! Redirecting...')
    return Response.redirect('http://localhost:3000?gmailConnected=true')
  } catch (err) {
    console.error('Gmail OAuth exception:', err.message, err.stack)
    return Response.redirect('http://localhost:3000?gmailError=true')
  }
}
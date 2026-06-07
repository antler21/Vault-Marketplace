import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, GMAIL_SCOPES } from '../../../lib/google'

export async function GET() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'select_account consent',
  })

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  return Response.redirect(url)
}
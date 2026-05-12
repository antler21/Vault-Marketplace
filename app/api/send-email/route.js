import { supabase } from '../../lib/supabase'
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../../lib/google'

export const runtime = 'nodejs'

async function getValidToken() {
  const { data: tokens } = await supabase
    .from('gmail_tokens')
    .select('*')
    .limit(1)
    .single()

  if (!tokens) return null

  const now = new Date()
  const expiresAt = new Date(tokens.expires_at)

  if (expiresAt <= now) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (data.error) {
      console.error('Token refresh error:', data.error)
      return null
    }

    await supabase.from('gmail_tokens').update({
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq('email', tokens.email)

    return { token: data.access_token, email: tokens.email }
  }

  return { token: tokens.access_token, email: tokens.email }
}

export async function POST(request) {
  const body = await request.json()
  const { to, subject, message } = body

  if (!to || !message) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const tokenData = await getValidToken()
    if (!tokenData) {
      return Response.json({ error: 'Gmail not connected. Please reconnect Gmail in the Orders page.' }, { status: 401 })
    }

    // Build RFC 2822 email message
    const emailLines = [
      `To: ${to}`,
      `From: ${tokenData.email}`,
      `Subject: ${subject || 'Regarding your account offer'}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      message,
    ]
    const rawEmail = emailLines.join('\r\n')

    // Base64url encode (Gmail API requirement)
    const encoded = Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Send via Gmail API
    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    })

    const sendData = await sendRes.json()

    if (sendData.error) {
      console.error('Gmail API send error:', JSON.stringify(sendData.error))
      return Response.json({ error: sendData.error.message || 'Failed to send email via Gmail API' }, { status: 500 })
    }

    console.log('Email sent successfully, message ID:', sendData.id)
    return Response.json({ success: true, messageId: sendData.id })

  } catch (err) {
    console.error('Send email error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

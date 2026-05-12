import { supabase } from '../../../lib/supabase'
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../../../lib/google'

export const runtime = 'nodejs'

async function refreshAccessToken(tokenRow) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) {
    if (data.error === 'invalid_grant') throw new Error('RECONNECT_REQUIRED')
    throw new Error(data.error)
  }
  const expiresAt = new Date(Date.now() + data.expires_in * 1000)
  await supabase.from('gmail_tokens').update({
    access_token: data.access_token,
    expires_at: expiresAt.toISOString(),
  }).eq('email', tokenRow.email)
  return data.access_token
}

async function getValidToken() {
  const { data: tokens } = await supabase.from('gmail_tokens').select('*').limit(1).single()
  if (!tokens) return null
  const now = new Date()
  const expiresAt = new Date(tokens.expires_at)
  if (now >= expiresAt) return await refreshAccessToken(tokens)
  return tokens.access_token
}

function decodeBase64(str) {
  try {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  } catch { return '' }
}

function extractBody(payload) {
  // Try to get HTML part first, then plain text
  if (!payload) return { html: '', text: '' }

  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return { html: decodeBase64(payload.body.data), text: '' }
  }
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    const text = decodeBase64(payload.body.data)
    return { html: `<pre style="white-space:pre-wrap;font-family:sans-serif">${text}</pre>`, text }
  }

  let html = '', text = ''
  for (const part of payload.parts || []) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      html = decodeBase64(part.body.data)
    } else if (part.mimeType === 'text/plain' && part.body?.data) {
      text = decodeBase64(part.body.data)
    } else if (part.parts) {
      // Nested multipart
      const nested = extractBody(part)
      if (nested.html) html = nested.html
      if (nested.text) text = nested.text
    }
  }

  if (!html && text) {
    html = `<pre style="white-space:pre-wrap;font-family:sans-serif">${text}</pre>`
  }
  return { html, text }
}

// GET /api/gmail/search?sender=noreply@g2g.com&subject=New+Order
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const sender = searchParams.get('sender') || ''
    const subject = searchParams.get('subject') || ''

    if (!sender && !subject) {
      return Response.json({ error: 'Provide sender or subject' }, { status: 400 })
    }

    const token = await getValidToken()
    if (!token) return Response.json({ error: 'Gmail not connected' }, { status: 401 })

    // Build Gmail search query
    const parts = []
    if (sender) parts.push(`from:${sender}`)
    if (subject) parts.push(`subject:"${subject}"`)
    const query = parts.join(' ')

    // Search for emails
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const searchData = await searchRes.json()

    if (!searchData.messages?.length) {
      return Response.json({ error: 'No emails found matching that sender/subject' }, { status: 404 })
    }

    // Get the most recent match
    const msgId = searchData.messages[0].id
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const msgData = await msgRes.json()

    const headers = msgData.payload?.headers || []
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

    const { html, text } = extractBody(msgData.payload)

    return Response.json({
      id: msgId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: getHeader('Date'),
      html,
      text,
    })
  } catch (err) {
    console.error('Gmail search error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

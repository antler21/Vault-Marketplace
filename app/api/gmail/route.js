import { supabase } from '../../lib/supabase'
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../../lib/google'

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
  if (data.error) throw new Error(data.error)

  const expiresAt = new Date(Date.now() + data.expires_in * 1000)
  await supabase.from('gmail_tokens').update({
    access_token: data.access_token,
    expires_at: expiresAt.toISOString(),
  }).eq('email', tokenRow.email)

  return data.access_token
}

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
    const newToken = await refreshAccessToken(tokens)
    return { token: newToken, email: tokens.email }
  }

  return { token: tokens.access_token, email: tokens.email }
}

function parseEmail(text, platform) {
  const result = {}
  const rules = platform.emailParsingRules || platform.email_parsing_rules || {}

  console.log('=== PARSING EMAIL ===')
  console.log('Platform:', platform.name)
  console.log('Rules:', JSON.stringify(rules))
  console.log('Email text:', text.substring(0, 500))

  for (const [field, rule] of Object.entries(rules)) {
    if (!rule || !rule.keyword) continue
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.toLowerCase().includes(rule.keyword.toLowerCase())) {
        const afterKeyword = line.substring(
          line.toLowerCase().indexOf(rule.keyword.toLowerCase()) + rule.keyword.length
        ).trim()
        const value = afterKeyword.replace(/^[:=\s]+/, '').split(/\s{2,}|\|/)[0].trim()
        if (value) {
          result[field] = value
          console.log(`Matched field "${field}": "${value}"`)
        }
        break
      }
    }
  }

  if (result.price) {
    const priceMatch = result.price.match(/[\d,.]+/)
    if (priceMatch) result.price = parseFloat(priceMatch[0].replace(',', ''))
  }

  console.log('Parsed result:', JSON.stringify(result))
  return result
}

function meetsMinimumParseRequirements(parsed) {
  const filledFields = Object.values(parsed).filter(v => v !== null && v !== undefined && v !== '')
  return filledFields.length >= 2
}

export async function GET() {
  try {
    const tokenData = await getValidToken()
    if (!tokenData) return Response.json({ connected: false })
    return Response.json({ connected: true, email: tokenData.email })
  } catch (err) {
    return Response.json({ connected: false, error: err.message })
  }
}

export async function POST(request) {
  const body = await request.json()
  const { platforms, dateQuery } = body

  console.log('Received platforms:', platforms?.length, 'platforms')
  console.log('Date query:', dateQuery || 'none')
  platforms?.forEach(p => {
    console.log(`Platform: ${p.name}, emailSender: ${p.emailSender}, rules:`, JSON.stringify(p.emailParsingRules || p.email_parsing_rules))
  })

  const activePlatforms = (platforms || []).filter(p =>
    (p.emailSender || p.email_sender) && (p.emailSender || p.email_sender).trim() !== ''
  )

  console.log('Active platforms with email sender:', activePlatforms.length)

  if (activePlatforms.length === 0) {
    return Response.json({ orders: [], count: 0, message: 'No platforms with email sender configured' })
  }

  try {
    const tokenData = await getValidToken()
    if (!tokenData) return Response.json({ error: 'Gmail not connected' }, { status: 401 })

    const { token } = tokenData

    const senderQuery = activePlatforms
      .map(p => `from:${p.emailSender || p.email_sender}`)
      .join(' OR ')

    const fullQuery = `is:unread (${senderQuery})${dateQuery ? ' ' + dateQuery : ''}`

    console.log('Gmail query:', fullQuery)

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(fullQuery)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listData = await listRes.json()

    console.log('Emails found:', listData.messages?.length || 0)

    if (!listData.messages || listData.messages.length === 0) {
      return Response.json({ orders: [], count: 0 })
    }

    const newOrders = []

    for (const msg of listData.messages) {
      // Check by Gmail message ID
      const { data: existingByMsgId } = await supabase
        .from('orders')
        .select('id')
        .eq('raw_email', msg.id)
        .single()

      if (existingByMsgId) {
        console.log('Already processed (msg id):', msg.id)
        continue
      }

      // Fetch full email
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const msgData = await msgRes.json()

      // Extract email body
      let emailBody = ''
      if (msgData.payload?.body?.data) {
        emailBody = Buffer.from(msgData.payload.body.data, 'base64').toString('utf-8')
      } else if (msgData.payload?.parts) {
        for (const part of msgData.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            emailBody += Buffer.from(part.body.data, 'base64').toString('utf-8')
          }
        }
      }

      const headers = msgData.payload?.headers || []
      const subject = headers.find(h => h.name === 'Subject')?.value || ''
      const from = headers.find(h => h.name === 'From')?.value || ''
      const dateHeader = headers.find(h => h.name === 'Date')?.value || ''

      const fullText = `Subject: ${subject}\nFrom: ${from}\n\n${emailBody}`

      console.log('Processing email from:', from)

      // Find matching platform by sender email
      const matchedPlatform = activePlatforms.find(p => {
        const sender = p.emailSender || p.email_sender || ''
        return from.toLowerCase().includes(sender.toLowerCase())
      })

      if (!matchedPlatform) {
        console.log(`Skipping email from ${from} — no matching platform`)
        continue
      }

      console.log('Matched platform:', matchedPlatform.name)

      // Parse the email
      const parsed = parseEmail(fullText, matchedPlatform)

      // Check minimum parse requirements
      if (!meetsMinimumParseRequirements(parsed)) {
        console.log(`Skipping email — only ${Object.values(parsed).filter(Boolean).length} fields parsed, need at least 2`)
        continue
      }

      // Check by parsed order ID
      if (parsed.orderId) {
        const { data: existingByOrderId } = await supabase
          .from('orders')
          .select('id')
          .eq('order_id', parsed.orderId)
          .single()

        if (existingByOrderId) {
          console.log('Already processed (order id):', parsed.orderId)
          await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
            }
          )
          continue
        }
      }

      // Save order to database
      const { data: saved } = await supabase.from('orders').insert([{
        platform_name: matchedPlatform.name,
        order_id: parsed.orderId || msg.id,
        title: parsed.title || subject,
        price: parsed.price || 0,
        price_currency: 'USD',
        buyer: parsed.buyer || '',
        status: 'Pending',
        raw_email: fullText,
        email_date: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
      }]).select().single()

      if (saved) {
        newOrders.push(saved)
        console.log(`New order created: ${saved.id} from ${matchedPlatform.name}`)
      }

      // Mark email as read
      await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
        }
      )
    }

    return Response.json({ orders: newOrders, count: newOrders.length })
  } catch (err) {
    console.error('Gmail fetch error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
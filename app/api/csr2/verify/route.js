import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'

// Case-insensitive substring: does haystack contain needle?
function containsIgnoreCase(haystack, needle) {
  return (haystack || '').toLowerCase().includes((needle || '').toLowerCase())
}

// Try to match any pack name inside the order's title and raw_email.
// Strategy A: direct substring match (pack name appears anywhere in title/body).
// Strategy B: strip known listing prefix (e.g. "CSR Racing 2 | ") then try again.
function findMatchingPack(order, packs) {
  const title    = (order.title || '').toLowerCase()
  const rawEmail = (order.raw_email || '').toLowerCase()

  // Common listing prefix patterns to strip when doing fallback match
  const PREFIXES = ['csr racing 2 | ', 'csr2 | ', 'csr racing 2 - ', 'csr2 - ']

  function stripPrefix(str) {
    for (const p of PREFIXES) {
      if (str.startsWith(p)) return str.slice(p.length)
    }
    return str
  }

  for (const pack of packs) {
    const needle = (pack.name || '').toLowerCase()
    if (!needle) continue

    // Strategy A: direct substring in title or body
    if (containsIgnoreCase(title, needle) || containsIgnoreCase(rawEmail, needle)) {
      return pack
    }

    // Strategy B: strip prefix from title, then check
    const strippedTitle = stripPrefix(title)
    if (strippedTitle.includes(needle) || needle.includes(strippedTitle.split('\n')[0].trim())) {
      return pack
    }
  }
  return null
}

async function findOrder(orderId) {
  const { data } = await supabase
    .from('orders')
    .select('id, order_id, title, raw_email, status, platform_name')
    .eq('order_id', orderId)
    .single()
  return data || null
}

async function forceGmailRefresh(request) {
  try {
    const { data: platforms } = await supabase.from('platforms').select('*')
    const url = new URL(request.url)
    const base = `${url.protocol}//${url.host}`
    // Use last 30 days as the date window for the forced refresh
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const pad = n => String(n).padStart(2, '0')
    const dateQuery = `after:${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
    await fetch(`${base}/api/gmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms: platforms || [], dateQuery }),
    })
  } catch {
    // Non-fatal — refresh best-effort only
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const orderId = (searchParams.get('orderId') || '').trim()

  if (!orderId) {
    return Response.json({ error: 'Missing orderId' }, { status: 400 })
  }

  // 1. Look up order
  let order = await findOrder(orderId)

  // 2. Not found → force Gmail refresh → re-check once
  if (!order) {
    await forceGmailRefresh(request)
    order = await findOrder(orderId)
  }

  // 3. Still not found
  if (!order) {
    return Response.json({ found: false, reason: 'order_not_found' })
  }

  // 4. Load all packs and find a match inside the order content
  const { data: packs } = await supabase.from('csr2_packs').select('id, name, data')
  const matched = findMatchingPack(order, packs || [])

  if (!matched) {
    return Response.json({ found: true, reason: 'pack_not_supported' })
  }

  return Response.json({ found: true, pack: matched })
}

import { supabase } from '../../../lib/supabase'

export async function GET(request, { params }) {
  const { id } = await params
  const { data, error } = await supabase
    .from('lol_skin_scans')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: 'Scan not found' }, { status: 404 })

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return Response.json({ error: 'This preview link has expired.' }, { status: 410 })
  }

  return Response.json(data)
}

export async function PATCH(request, { params }) {
  const { id } = await params
  try {
    const body = await request.json()
    const update = {}

    if ('expiresAt'    in body) update.expires_at   = body.expiresAt
    if ('hideName'     in body) update.hide_name     = !!body.hideName
    if ('oge'          in body) update.oge           = !!body.oge
    if ('ogi'          in body) update.ogi           = !!body.ogi
    if ('ogiPartial'   in body) update.ogi_partial   = !!body.ogiPartial
    if ('ogiVerified'  in body) update.ogi_verified  = !!body.ogiVerified
    if ('priceAmount'  in body) update.price_amount  = body.priceAmount ?? null
    if ('priceCurrency' in body) update.price_currency = body.priceCurrency || null

    const { data, error } = await supabase
      .from('lol_skin_scans')
      .update(update)
      .eq('id', id)
      .select('id, expires_at, hide_name, oge, ogi, ogi_partial, ogi_verified, price_amount, price_currency')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

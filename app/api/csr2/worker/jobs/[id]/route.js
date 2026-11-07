import { supabase } from '../../../../../lib/supabase'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { revertCodeStatus, ledgerExhausted } from '../../../../../lib/csr2Ledger'

const VALID_STATUSES = [
  'awaiting_credentials', 'logging_in', 'bad_password', 'awaiting_2fa', 'bad_code',
  'awaiting_gamecenter_confirm', 'awaiting_signin_approval',
  'launching_game', 'awaiting_save_load', 'awaiting_account_confirm',
  'awaiting_risk_decision', 'editing_save', 'awaiting_relaunch', 'saving',
  'needs_new_account', 'done', 'error',
]

const SCREENSHOT_COLUMNS = {
  gamecenter: 'gamecenter_screenshot_url',
  signin_approval: 'signin_approval_screenshot_url',
  completion: 'completion_screenshot_url',
}

function isWorkerAuthed(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return !!process.env.CSR2_WORKER_TOKEN && token === process.env.CSR2_WORKER_TOKEN
}

// Worker sends the raw screenshot bytes (base64) rather than uploading to Storage
// itself — keeps CSR2_WORKER_TOKEN as its only credential instead of also handing
// it a Supabase service key. Returns the public URL to store on the job row.
async function uploadScreenshot(jobId, kind, base64, contentType) {
  const buffer = Buffer.from(base64, 'base64')
  const ext = contentType === 'image/png' ? 'png' : 'jpg'
  const path = `${jobId}/${kind}-${Date.now()}.${ext}`
  const { error } = await supabaseAdmin.storage
    .from('csr2-screenshots')
    .upload(path, buffer, { contentType: contentType || 'image/jpeg', upsert: true })
  if (error) throw new Error('Screenshot upload failed: ' + error.message)
  const { data } = supabaseAdmin.storage.from('csr2-screenshots').getPublicUrl(path)
  return data.publicUrl
}

export async function PATCH(request, context) {
  if (!isWorkerAuthed(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status, errorMessage, accountConfirmData, screenshotKind, screenshotBase64, screenshotContentType, deliveryResult } = body
  if (!VALID_STATUSES.includes(status)) {
    return Response.json({ error: 'Invalid status: ' + status }, { status: 400 })
  }

  const { data: current, error: curErr } = await supabase
    .from('csr2_jobs')
    .select('status, code_id, platform')
    .eq('id', id)
    .single()
  if (curErr || !current) return Response.json({ error: 'Job not found' }, { status: 404 })

  const patch = { status, updated_at: new Date().toISOString() }
  // Credential/2FA/confirmation fields are never kept past the point the worker has consumed them.
  if (status === 'logging_in') patch.password_enc = null
  if (current.status === 'awaiting_2fa' && status !== 'awaiting_2fa') patch.twofa_code = null
  if (current.status === 'awaiting_account_confirm' && status !== 'awaiting_account_confirm') patch.account_confirmed = null
  if (current.status === 'awaiting_gamecenter_confirm' && status !== 'awaiting_gamecenter_confirm') patch.gamecenter_confirmed = null
  if (current.status === 'awaiting_risk_decision' && status !== 'awaiting_risk_decision') patch.risk_decision = null
  if (status === 'awaiting_account_confirm' && accountConfirmData) patch.account_confirm_data = accountConfirmData
  patch.error_message = status === 'error' ? (errorMessage || 'Unknown error') : null

  if (screenshotKind && screenshotBase64) {
    const column = SCREENSHOT_COLUMNS[screenshotKind]
    if (!column) return Response.json({ error: 'Invalid screenshotKind' }, { status: 400 })
    try {
      patch[column] = await uploadScreenshot(id, screenshotKind, screenshotBase64, screenshotContentType)
    } catch (e) {
      console.error('[csr2/worker/jobs PATCH screenshot]', e.message)
      return Response.json({ error: e.message }, { status: 500 })
    }
  }

  const { error } = await supabase.from('csr2_jobs').update(patch).eq('id', id)
  if (error) {
    console.error('[csr2/worker/jobs PATCH]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Code status follows the job to a terminal state. 'error' reverts the claim
  // (unused if nothing was ever delivered, partial if a prior ledger entry exists).
  // 'done' writes this round's ledger entry (if the worker reported one — a plain
  // full delivery with nothing to track just marks the code fully 'used').
  if (status === 'error') {
    await revertCodeStatus(current.code_id)
  } else if (status === 'done') {
    if (deliveryResult) {
      await supabase.from('csr2_code_redemptions').insert({
        code_id: current.code_id,
        job_id: id,
        platform: current.platform,
        account_last4: deliveryResult.accountLast4 || null,
        kind: deliveryResult.kind || 'full',
        currencies_delivered: deliveryResult.currenciesDelivered || null,
        cars_delivered: deliveryResult.carsDelivered || null,
        remaining_currencies: deliveryResult.remainingCurrencies || null,
      })
      const stillOwed = !ledgerExhausted(deliveryResult.remainingCurrencies)
      await supabase.from('csr2_codes').update({ status: stillOwed ? 'partial' : 'used' }).eq('id', current.code_id)
    } else {
      await supabase.from('csr2_codes').update({ status: 'used' }).eq('id', current.code_id)
    }
  }

  return Response.json({ ok: true })
}

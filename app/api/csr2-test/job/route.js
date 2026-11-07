import { supabase } from '../../../lib/supabase'
import { generateCsr2Code, hashCsr2Code } from '../../../lib/csr2Codes'

// Dev-only test harness — behind the normal login wall (this path isn't in
// middleware.js's PUBLIC_PREFIXES, unlike /csr2 / /csr2-redeem / /api/csr2).
// Creates a throwaway code+job pair directly, skipping the real redeem flow,
// so the new buyer-facing steps (screenshots, risk-decision, etc.) can be
// exercised without a phone or an actual worker. Never reachable by a buyer.

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const packName = body.packName
  if (!packName) return Response.json({ error: 'Missing packName' }, { status: 400 })

  const code = generateCsr2Code()
  const { data: codeRow, error: codeErr } = await supabase
    .from('csr2_codes')
    .insert({ code_hash: hashCsr2Code(code), plaintext_code: code, pack_name: packName, status: 'in_progress', is_test: true })
    .select('id')
    .single()
  if (codeErr) return Response.json({ error: codeErr.message }, { status: 500 })

  // is_test so the real worker's claim() never sees this job (see migration 008).
  const { data: job, error: jobErr } = await supabase
    .from('csr2_jobs')
    .insert({ code_id: codeRow.id, platform: 'ios', status: 'awaiting_credentials', account_mode: 'existing', is_test: true })
    .select('id')
    .single()
  if (jobErr) return Response.json({ error: jobErr.message }, { status: 500 })

  await supabase.from('csr2_codes').update({ used_by_job_id: job.id }).eq('id', codeRow.id)

  return Response.json({ ok: true, jobId: job.id, code })
}

'use client'
import { useState, useEffect } from 'react'

const BG = '#0f0f0f', SURF = '#1a1a1a', SURF2 = '#222222', BORDER = '#2a2a2a'
const TEXT = '#FDF4DC', MUTED = '#a08570', GREEN = '#4caf50', RED = '#e05252'

const STATUSES = [
  'awaiting_credentials', 'logging_in', 'bad_password', 'awaiting_2fa', 'bad_code',
  'awaiting_gamecenter_confirm', 'awaiting_signin_approval',
  'launching_game', 'awaiting_save_load', 'awaiting_account_confirm',
  'awaiting_risk_decision', 'editing_save', 'awaiting_relaunch', 'saving',
  'needs_new_account', 'done', 'error',
]

function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>{children}</div>
}
const inputStyle = { width: '100%', boxSizing: 'border-box', background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, color: TEXT }

// Public anon key (same one baked into app/lib/supabase.js and shipped to every
// browser) — needed alongside the signed upload URL below. Not a secret.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNraXNkaWdoZHNhc3Buanl2bHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjMwNjYsImV4cCI6MjA5MTQ5OTA2Nn0.CwoBaPyLdJ3tZzp3ycDuJtSfWww6EUcUlOcouraSIYM'

// Real screenshots run several MB — too big for a JSON body through this app's
// own routes (Vercel's hard ~4.5MB function limit). Gets a signed Supabase
// Storage upload URL (via the server-side proxy, keeping CSR2_WORKER_TOKEN out
// of the browser) and PUTs the file straight there instead.
async function uploadScreenshotFile(jobId, kind, file) {
  const res = await fetch('/api/csr2-test/job/' + jobId, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ screenshotKind: kind, ext: file.type === 'image/png' ? 'png' : 'jpg' }),
  })
  const info = await res.json()
  if (!res.ok) throw new Error(info.error || 'Could not get an upload URL')
  const putRes = await fetch(info.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'image/png', apikey: SUPABASE_ANON_KEY, 'x-upsert': 'true' },
    body: file,
  })
  if (!putRes.ok) throw new Error('Upload to storage failed (' + putRes.status + ')')
  return info.publicUrl
}

export default function Csr2TestHarness() {
  const [packs, setPacks] = useState([])
  const [packName, setPackName] = useState('')
  const [jobId, setJobId] = useState('')
  const [code, setCode] = useState('')
  const [job, setJob] = useState(null)
  const [status, setStatus] = useState('awaiting_gamecenter_confirm')
  const [name, setName] = useState('Test Account')
  const [level, setLevel] = useState('50')
  const [folderId, setFolderId] = useState('test-folder')
  const [screenshotKind, setScreenshotKind] = useState('gamecenter')
  const [screenshotFile, setScreenshotFile] = useState(null)
  const [errorMessage, setErrorMessage] = useState('Simulated failure for testing.')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    fetch('/api/csr2/packs').then(r => r.json()).then(data => {
      setPacks(Array.isArray(data) ? data : [])
      if (Array.isArray(data) && data.length) setPackName(data[0].name)
    }).catch(() => {})
  }, [])

  async function refreshJob(id) {
    if (!id) return
    const res = await fetch('/api/csr2-test/job/' + id)
    const data = await res.json()
    if (res.ok) setJob(data)
  }

  async function createJob() {
    if (!packName) return
    setBusy(true)
    setNote('')
    try {
      const res = await fetch('/api/csr2-test/job', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packName }),
      })
      const data = await res.json()
      if (!res.ok) { setNote('Error: ' + data.error); return }
      setJobId(data.jobId)
      setCode(data.code)
      await refreshJob(data.jobId)
      setNote('Created job ' + data.jobId)
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!jobId) return
    setBusy(true)
    setNote('')
    try {
      const body = { status }
      if (status === 'error') body.errorMessage = errorMessage
      if (status === 'awaiting_account_confirm') {
        body.accountConfirmData = { name, pllv: Number(level) || 0, folderId }
      }
      if (screenshotFile) {
        body.screenshotKind = screenshotKind
        body.screenshotUrl = await uploadScreenshotFile(jobId, screenshotKind, screenshotFile)
      }
      const res = await fetch('/api/csr2-test/job/' + jobId, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setNote('Error: ' + data.error); return }
      setNote('Applied: ' + status)
      await refreshJob(jobId)
    } finally {
      setBusy(false)
    }
  }

  const redeemUrl = jobId ? `/csr2-redeem?job=${jobId}` : null

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, padding: '32px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>CSR2 Redeem Flow — Test Harness</h1>
        <p style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>
          Dev-only tool, no phone/worker required. Creates a throwaway code+job and lets you push it through any status —
          same code path a real worker PATCH would hit — so you can see each new screen on the actual redeem page.
        </p>

        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>1. Create a test job</div>
          <Field label="Pack (pick one with cars + currencies configured for the fullest test)">
            <select value={packName} onChange={e => setPackName(e.target.value)} style={inputStyle}>
              {packs.map(p => <option key={p.name} value={p.name}>{p.name}{p.data?.isCombo ? ' (combo)' : ''}</option>)}
            </select>
          </Field>
          <button onClick={createJob} disabled={busy || !packName} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {busy ? 'Working…' : 'Create Test Job'}
          </button>
          {jobId && (
            <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
              Job: <code style={{ color: TEXT }}>{jobId}</code> · Code: <code style={{ color: TEXT }}>{code}</code>
              <br />
              <a href={redeemUrl} target="_blank" rel="noreferrer" style={{ color: GREEN }}>Open redeem page in a new tab →</a>
              {' '}(it polls every 2.5s, so changes below show up automatically)
            </div>
          )}
        </div>

        {jobId && (
          <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>2. Push it to a status</div>

            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            {status === 'error' && (
              <Field label="Error message">
                <input value={errorMessage} onChange={e => setErrorMessage(e.target.value)} style={inputStyle} />
              </Field>
            )}

            {status === 'awaiting_account_confirm' && (
              <>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>
                  Also sets the account&apos;s level — do this once before testing &quot;awaiting_risk_decision&quot; below, since the risk plan reads the level from here.
                </div>
                <Field label="Account Name"><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} /></Field>
                <Field label="Level (pllv)"><input value={level} onChange={e => setLevel(e.target.value)} style={inputStyle} /></Field>
                <Field label="Folder ID"><input value={folderId} onChange={e => setFolderId(e.target.value)} style={inputStyle} /></Field>
              </>
            )}

            <div style={{ borderTop: `1px solid ${BORDER}`, margin: '14px 0', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Optional: attach a fake screenshot</div>
              <Field label="Screenshot is for">
                <select value={screenshotKind} onChange={e => setScreenshotKind(e.target.value)} style={inputStyle}>
                  <option value="gamecenter">GameCenter confirm</option>
                  <option value="signin_approval">Sign-in approval (Android)</option>
                  <option value="completion">Completion (done screen)</option>
                </select>
              </Field>
              <Field label="Image file">
                <input type="file" accept="image/*" onChange={e => setScreenshotFile(e.target.files?.[0] || null)} style={{ fontSize: 12, color: MUTED }} />
              </Field>
            </div>

            <button onClick={apply} disabled={busy} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {busy ? 'Applying…' : 'Apply'}
            </button>
          </div>
        )}

        {note && <div style={{ fontSize: 12, color: note.startsWith('Error') ? RED : GREEN, marginBottom: 16 }}>{note}</div>}

        {job && (
          <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Current job state</div>
            <pre style={{ fontSize: 11, color: MUTED, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(job, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

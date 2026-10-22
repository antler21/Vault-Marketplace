'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Colors ───────────────────────────────────────────────────────────────────
const BG      = '#0f0f0f'
const SURF    = '#1a1a1a'
const SURF2   = '#222222'
const BORDER  = '#2a2a2a'
const TEXT    = '#FDF4DC'
const MUTED   = '#a08570'
const GREEN   = '#4caf50'
const RED     = '#e05252'

// ─── Pack content formatter (mirrors app/csr2/page.js) ────────────────────────
const CURR_LABELS = {
  cash:         { label: 'Cash',         emoji: '💵' },
  gold:         { label: 'Gold',         emoji: '🪙' },
  bronzeKeys:   { label: 'Bronze Keys',  emoji: '🔑' },
  silverKeys:   { label: 'Silver Keys',  emoji: '🗝️' },
  goldKeys:     { label: 'Gold Keys',    emoji: '✨' },
  fuel:         { label: 'Fuel',         emoji: '⛽' },
  fusionGreen:  { label: 'Green Tokens', emoji: '🟢' },
  fusionBlue:   { label: 'Blue Tokens',  emoji: '🔵' },
  fusionRed:    { label: 'Red Tokens',   emoji: '🔴' },
  fusionYellow: { label: 'Yellow Tokens',emoji: '🟡' },
}

function fmtN(n) {
  if (!n) return '0'
  return Number(n).toLocaleString()
}

function PackContents({ data }) {
  if (!data) return null
  const { currencies, cars, legends, fusions, stage6 } = data
  const sections = []

  const currEntries = Object.entries(currencies || {}).filter(([, v]) => v > 0)
  if (currEntries.length) {
    sections.push(
      <div key="curr" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>💰 Currencies</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {currEntries.map(([k, v]) => {
            const def = CURR_LABELS[k] || { label: k, emoji: '•' }
            return (
              <div key={k} style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
                <span style={{ color: TEXT, fontWeight: 600 }}>{def.emoji} {fmtN(v)}</span>
                <span style={{ color: MUTED, marginLeft: 5 }}>{def.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (cars) {
    let desc = ''
    if (cars.carMode === 'all') desc = 'All available cars' + (cars.condition === 'maxed' ? ' · fully maxed' : '')
    else if (cars.carMode === 'random') {
      desc = `${fmtN(cars.count)} random cars` + (cars.condition === 'maxed' ? ' · fully maxed' : '')
      if (cars.partial) desc += ` (buyer picks ${fmtN(cars.partial.count)})`
    } else if (cars.carMode === 'specific') desc = 'Specific cars selected by operator'
    sections.push(
      <div key="cars" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>🚗 Cars</div>
        <div style={{ fontSize: 13, color: TEXT }}>{desc}</div>
      </div>
    )
  }

  if (legends) {
    const desc = legends.mode === 'all'
      ? 'All 26 classic legend cars included'
      : `Buyer picks ${fmtN(legends.count)} classic legend car${legends.count !== 1 ? 's' : ''}`
    sections.push(
      <div key="legends" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>⭐ Legend Tokens</div>
        <div style={{ fontSize: 13, color: TEXT }}>{desc}</div>
      </div>
    )
  }

  if (fusions) {
    const desc = fusions.mode === 'all'
      ? 'All fusions' + (fusions.amount ? ` · ${fmtN(fusions.amount)} per part` : ' · max per part')
      : `Customizable · ${fmtN(fusions.count)} parts · ${fmtN(fusions.brandAmount || 1)} brand(s) of choice`
    sections.push(
      <div key="fusions" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>⚗️ Fusions</div>
        <div style={{ fontSize: 13, color: TEXT }}>{desc}</div>
      </div>
    )
  }

  if (stage6) {
    const desc = stage6.mode === 'all'
      ? 'All Stage 6 parts' + (stage6.amount ? ` · ${fmtN(stage6.amount)} per part` : ' · max per part')
      : `Customizable · buyer picks up to ${fmtN(stage6.count)} car${stage6.count !== 1 ? 's' : ''}`
    sections.push(
      <div key="s6" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>6️⃣ Stage 6</div>
        <div style={{ fontSize: 13, color: TEXT }}>{desc}</div>
      </div>
    )
  }

  if (!sections.length) return null
  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Your pack includes:</div>
      {sections}
    </div>
  )
}

// ─── Shared bits ────────────────────────────────────────────────────────────────
function Btn({ onClick, disabled, variant = 'primary', children, style = {} }) {
  const base = {
    padding: '11px 24px', borderRadius: 10, border: 'none', cursor: disabled ? 'default' : 'pointer',
    fontSize: 14, fontWeight: 600, transition: 'all 0.2s', ...style,
  }
  if (variant === 'primary') {
    return (
      <button onClick={onClick} disabled={disabled} style={{ ...base, background: disabled ? '#333' : GREEN, color: disabled ? '#666' : '#fff' }}>
        {children}
      </button>
    )
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, background: 'transparent', color: disabled ? '#555' : MUTED, border: `1px solid ${BORDER}` }}>
      {children}
    </button>
  )
}

function OptionCard({ label, sub, selected, disabled, badge, onClick }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      flex: 1, padding: '18px 16px', borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
      border: `2px solid ${selected ? GREEN : BORDER}`,
      background: selected ? '#1a2e1a' : SURF2,
      opacity: disabled ? 0.5 : 1,
      textAlign: 'center', transition: 'all 0.15s', position: 'relative',
    }}>
      {badge && (
        <div style={{ position: 'absolute', top: -9, right: 10, background: MUTED, color: '#1a1a1a', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, letterSpacing: 0.5 }}>
          {badge}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: selected ? GREEN : TEXT, marginBottom: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: MUTED }}>{sub}</div>}
    </div>
  )
}

function Modal({ children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px 16px' }}>
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

function ModalTitle({ children }) { return <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 6 }}>{children}</div> }
function ModalSub({ children }) { return <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>{children}</div> }
function ModalActions({ children }) { return <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>{children}</div> }

function ErrorNote({ children }) {
  if (!children) return null
  return (
    <div style={{ background: '#2a1010', border: `1px solid ${RED}`, borderRadius: 8, padding: '9px 13px', fontSize: 13, color: '#f88', marginTop: 12 }}>
      {children}
    </div>
  )
}

function FieldLabel({ children }) { return <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, marginBottom: 5 }}>{children}</div> }

function TextInput({ value, onChange, placeholder, type = 'text', ...rest }) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} {...rest}
      style={{ width: '100%', boxSizing: 'border-box', background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: TEXT, outline: 'none', marginBottom: 14 }}
    />
  )
}

function Spinner() {
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${BORDER}`, borderTopColor: GREEN, animation: 'csr2spin 0.8s linear infinite', margin: '0 auto 18px' }}>
      <style>{'@keyframes csr2spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

// ─── Status text for the "just loading" states ─────────────────────────────────
const STATUS_TEXT = {
  logging_in: 'Loading Account...',
  launching_game: 'Loading Account...',
  awaiting_save_load: 'Loading Account...',
  editing_save: 'Applying Changes...',
  awaiting_relaunch: 'Saving Changes...',
  saving: 'Saving Changes...',
}

const POLL_MS = 2500

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function Csr2RedeemPage() {
  // 'code' -> 'confirm' -> 'credentials' -> 'status'
  const [step, setStep] = useState('code')

  // Redeem
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState('')
  const [codeId, setCodeId] = useState(null)
  const [pack, setPack] = useState(null)

  // Platform
  const [platform, setPlatform] = useState(null)

  // Job
  const [jobId, setJobId] = useState(null)
  const [creatingJob, setCreatingJob] = useState(false)
  const [jobCreateError, setJobCreateError] = useState('')

  // Credentials
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submittingCreds, setSubmittingCreds] = useState(false)
  const [credsError, setCredsError] = useState('')

  // 2FA
  const [twofaCode, setTwofaCode] = useState('')
  const [submittingTwofa, setSubmittingTwofa] = useState(false)
  const [twofaError, setTwofaError] = useState('')

  // Polling
  const [job, setJob] = useState(null)
  // True from the moment a credential/2FA submit succeeds until status actually
  // changes from what it was at submit time — not just until the next poll
  // completes, since the worker may take several polls to claim it. Without
  // tracking the pre-submit status, the UI flips right back to the same
  // input/error screen after one poll even though nothing has happened yet.
  const [resubmitting, setResubmitting] = useState(false)
  const preSubmitStatusRef = useRef(null)
  const pollRef = useRef(null)

  // ── Redeem code ──────────────────────────────────────────────────────────
  async function handleRedeem() {
    const val = code.trim()
    if (!val) return
    setRedeeming(true)
    setRedeemError('')
    try {
      const res = await fetch('/api/csr2/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: val }),
      })
      const data = await res.json()
      if (!res.ok) { setRedeemError(data.error || 'Invalid code'); return }
      setCodeId(data.codeId)
      setPack(data.pack)
      setStep('confirm')
    } catch {
      setRedeemError('Something went wrong. Please try again.')
    } finally {
      setRedeeming(false)
    }
  }

  // ── Confirm pack + platform -> create job ────────────────────────────────
  async function handleConfirmPlatform() {
    if (platform !== 'ios' || !codeId) return
    setCreatingJob(true)
    setJobCreateError('')
    try {
      const res = await fetch('/api/csr2/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, platform }),
      })
      const data = await res.json()
      if (!res.ok) { setJobCreateError(data.error || 'Could not start — please try again.'); return }
      setJobId(data.jobId)
      setStep('credentials')
    } catch {
      setJobCreateError('Something went wrong. Please try again.')
    } finally {
      setCreatingJob(false)
    }
  }

  // ── Submit credentials ───────────────────────────────────────────────────
  async function handleSubmitCredentials() {
    if (!email.trim() || !password.trim() || !jobId) return
    setSubmittingCreds(true)
    setCredsError('')
    try {
      const res = await fetch(`/api/csr2/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setCredsError(data.error || 'Could not submit — please try again.'); return }
      setPassword('')
      if (step === 'status') {
        preSubmitStatusRef.current = job?.status ?? null
        setResubmitting(true)
        pollJob()
      }
      setStep('status')
    } catch {
      setCredsError('Something went wrong. Please try again.')
    } finally {
      setSubmittingCreds(false)
    }
  }

  // ── Submit 2FA ────────────────────────────────────────────────────────────
  async function handleSubmitTwofa() {
    const val = twofaCode.trim()
    if (!val || !jobId) return
    setSubmittingTwofa(true)
    setTwofaError('')
    try {
      const res = await fetch(`/api/csr2/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twofaCode: val }),
      })
      const data = await res.json()
      if (!res.ok) { setTwofaError(data.error || 'Could not submit — please try again.'); return }
      setTwofaCode('')
      preSubmitStatusRef.current = job?.status ?? null
      setResubmitting(true)
      pollJob()
    } catch {
      setTwofaError('Something went wrong. Please try again.')
    } finally {
      setSubmittingTwofa(false)
    }
  }

  function handleResendCode() {
    setTwofaCode('')
    setTwofaError('')
    // The actual resend happens on the account side (triggered by the worker/device) —
    // nothing to call here yet; this just clears the field for a fresh entry.
  }

  // ── Poll job status ──────────────────────────────────────────────────────
  const pollJob = useCallback(async () => {
    if (!jobId) return
    try {
      const res = await fetch(`/api/csr2/jobs/${jobId}`)
      if (!res.ok) return
      const data = await res.json()
      setJob(data)
      if (data.status !== preSubmitStatusRef.current) setResubmitting(false)
    } catch {
      // transient network hiccup — next poll will retry
    }
  }, [jobId])

  useEffect(() => {
    if (step !== 'status' || !jobId) return
    pollJob()
    pollRef.current = setInterval(pollJob, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [step, jobId, pollJob])

  useEffect(() => {
    if (job && (job.status === 'done' || job.status === 'error')) {
      clearInterval(pollRef.current)
    }
  }, [job])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {step === 'code' && (
        <Modal>
          <ModalTitle>Redeem Your Code</ModalTitle>
          <ModalSub>Enter the code from your purchase confirmation.</ModalSub>
          <FieldLabel>Redeem Code</FieldLabel>
          <TextInput
            value={code}
            onChange={e => { setCode(e.target.value); setRedeemError('') }}
            placeholder="XXXXX"
            maxLength={5}
            onKeyDown={e => { if (e.key === 'Enter') handleRedeem() }}
          />
          <ErrorNote>{redeemError}</ErrorNote>
          <ModalActions>
            <Btn onClick={handleRedeem} disabled={!code.trim() || redeeming}>{redeeming ? 'Checking…' : 'Redeem'}</Btn>
          </ModalActions>
        </Modal>
      )}

      {step === 'confirm' && (
        <Modal>
          <ModalTitle>Confirm Your Pack</ModalTitle>
          <ModalSub>Here&apos;s what your code unlocks.</ModalSub>

          <div style={{ padding: '12px 14px', background: '#0d1f0d', border: `1px solid ${GREEN}33`, borderRadius: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>PACK</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{pack?.name}</div>
          </div>
          <PackContents data={pack?.data} />

          <div style={{ marginTop: 20, marginBottom: 6, fontSize: 13, fontWeight: 600, color: TEXT }}>Choose your platform</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <OptionCard label="iOS" sub="iPhone / iPad" selected={platform === 'ios'} onClick={() => setPlatform('ios')} />
            <OptionCard label="Android" sub="Phone / Emulator" badge="WIP" disabled onClick={() => {}} />
          </div>

          <ErrorNote>{jobCreateError}</ErrorNote>

          <ModalActions>
            <Btn variant="secondary" onClick={() => { setStep('code'); setPlatform(null); setJobCreateError('') }}>Back</Btn>
            <Btn onClick={handleConfirmPlatform} disabled={platform !== 'ios' || creatingJob}>
              {creatingJob ? 'Starting…' : 'Confirm'}
            </Btn>
          </ModalActions>
        </Modal>
      )}

      {step === 'credentials' && (
        <Modal>
          <ModalTitle>iOS Account Details</ModalTitle>
          <ModalSub>Enter your Apple ID and CSR2 account password.</ModalSub>

          <FieldLabel>Email</FieldLabel>
          <TextInput value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />

          <FieldLabel>Password</FieldLabel>
          <TextInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" />

          <ErrorNote>{credsError}</ErrorNote>

          <ModalActions>
            <Btn variant="secondary" onClick={() => setStep('confirm')}>Back</Btn>
            <Btn onClick={handleSubmitCredentials} disabled={!email.trim() || !password.trim() || submittingCreds}>
              {submittingCreds ? 'Submitting…' : 'Confirm'}
            </Btn>
          </ModalActions>
        </Modal>
      )}

      {step === 'status' && (
        <Modal>
          {renderStatus(job, resubmitting, {
            email, setEmail, password, setPassword, credsError, setCredsError,
            submittingCreds, handleSubmitCredentials,
            twofaCode, setTwofaCode, twofaError, submittingTwofa, handleSubmitTwofa, handleResendCode,
          })}
        </Modal>
      )}

    </div>
  )
}

function renderStatus(job, resubmitting, ctx) {
  if (!job) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <Spinner />
        <div style={{ fontSize: 15, color: MUTED }}>Connecting…</div>
      </div>
    )
  }

  // Just submitted a 2FA code (first attempt or a bad_code/bad_password retry) —
  // show a generic loading state instead of re-rendering the same input/error
  // screen, since status won't change until the worker claims it. Without this,
  // every 2FA submission looks like it silently did nothing until the next poll.
  if (resubmitting) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <Spinner />
        <div style={{ fontSize: 15, color: TEXT, fontWeight: 600 }}>Submitting…</div>
      </div>
    )
  }

  if (job.status === 'bad_password') {
    return (
      <div>
        <ModalTitle>Incorrect Password</ModalTitle>
        <ModalSub>That password didn&apos;t work. Please double-check and try again.</ModalSub>
        <FieldLabel>Email</FieldLabel>
        <TextInput value={ctx.email} onChange={e => ctx.setEmail(e.target.value)} placeholder="you@example.com" />
        <FieldLabel>Password</FieldLabel>
        <TextInput value={ctx.password} onChange={e => ctx.setPassword(e.target.value)} placeholder="••••••••" type="password" />
        <ErrorNote>{ctx.credsError}</ErrorNote>
        <ModalActions>
          <Btn onClick={ctx.handleSubmitCredentials} disabled={!ctx.email.trim() || !ctx.password.trim() || ctx.submittingCreds}>
            {ctx.submittingCreds ? 'Submitting…' : 'Try Again'}
          </Btn>
        </ModalActions>
      </div>
    )
  }

  if (job.status === 'awaiting_2fa' || job.status === 'bad_code') {
    return (
      <div>
        <ModalTitle>Enter Verification Code</ModalTitle>
        <ModalSub>
          {job.status === 'bad_code'
            ? 'That code was incorrect or expired. Please enter the latest code.'
            : 'Enter the 6-digit verification code sent to your device.'}
        </ModalSub>
        <FieldLabel>Verification Code</FieldLabel>
        <TextInput
          value={ctx.twofaCode}
          onChange={e => ctx.setTwofaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          inputMode="numeric"
        />
        <ErrorNote>{ctx.twofaError}</ErrorNote>
        <ModalActions>
          <Btn variant="secondary" onClick={ctx.handleResendCode}>Resend Code</Btn>
          <Btn onClick={ctx.handleSubmitTwofa} disabled={ctx.twofaCode.length < 4 || ctx.submittingTwofa}>
            {ctx.submittingTwofa ? 'Submitting…' : 'Confirm'}
          </Btn>
        </ModalActions>
      </div>
    )
  }

  if (job.status === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Done</div>
        <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>Your pack has been applied to your account.</div>
      </div>
    )
  }

  if (job.status === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Something Went Wrong</div>
        <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>
          {job.error_message || 'Please contact customer support.'}
        </div>
      </div>
    )
  }

  // awaiting_credentials / logging_in / launching_game / awaiting_save_load /
  // editing_save / awaiting_relaunch / saving — all render as a loading state.
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <Spinner />
      <div style={{ fontSize: 15, color: TEXT, fontWeight: 600 }}>
        {STATUS_TEXT[job.status] || 'Loading Account...'}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
        Please don&apos;t sign in or use this account on any other device while this is in progress.
      </div>
    </div>
  )
}

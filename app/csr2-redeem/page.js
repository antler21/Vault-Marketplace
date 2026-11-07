'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import CarPicker from './CarPicker'

// ─── Colors ───────────────────────────────────────────────────────────────────
const BG      = '#0f0f0f'
const SURF    = '#1a1a1a'
const SURF2   = '#222222'
const BORDER  = '#2a2a2a'
const TEXT    = '#FDF4DC'
const MUTED   = '#a08570'
const GREEN   = '#4caf50'
const RED     = '#e05252'
const AMBER   = '#c89b3c'

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
// Keys grouped together, Elite Tokens grouped together — explicit order instead of
// relying on whatever order the pack's currencies object happens to have been built in.
const CURR_ORDER = ['cash', 'gold', 'bronzeKeys', 'silverKeys', 'goldKeys', 'fuel', 'fusionGreen', 'fusionBlue', 'fusionRed', 'fusionYellow']

function fmtN(n) {
  if (!n) return '0'
  return Number(n).toLocaleString()
}

// Builds the section list for ONE pack's data ({currencies, cars, legends,
// fusions, stage6}) — shared by the single-pack and the per-stage combo-pack
// rendering below, since a combo stage is just a normal pack's data shape.
function buildPackSections(data, keyPrefix) {
  if (!data) return []
  const { currencies, cars, legends, fusions, stage6 } = data
  const sections = []

  const currEntries = Object.entries(currencies || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => CURR_ORDER.indexOf(a[0]) - CURR_ORDER.indexOf(b[0]))
  if (currEntries.length) {
    sections.push(
      <div key={keyPrefix + 'curr'} style={{ marginBottom: 16 }}>
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
      <div key={keyPrefix + 'cars'} style={{ marginBottom: 16 }}>
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
      <div key={keyPrefix + 'legends'} style={{ marginBottom: 16 }}>
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
      <div key={keyPrefix + 'fusions'} style={{ marginBottom: 16 }}>
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
      <div key={keyPrefix + 's6'} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>6️⃣ Stage 6</div>
        <div style={{ fontSize: 13, color: TEXT }}>{desc}</div>
      </div>
    )
  }

  return sections
}

// `stages` is the combo pack's resolved per-stage data (see app/lib/csr2Packs.js's
// resolveComboStages, attached server-side by /api/csr2/redeem) — a combo pack's
// OWN `data` has no currencies/cars/etc of its own, just {isCombo, stages: [name]},
// so without this a combo pack showed as if it had nothing in it at all.
function PackContents({ data, stages }) {
  if (!data) return null

  if (data.isCombo && stages?.length) {
    const blocks = stages.map((stage, i) => {
      const stageSections = buildPackSections(stage.data, 'stage' + i + '-')
      if (!stageSections.length) return null
      return (
        <div key={'stage' + i} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 10 }}>
            {i + 1}. {stage.name}
          </div>
          {stageSections}
        </div>
      )
    }).filter(Boolean)
    if (!blocks.length) return null
    return (
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Your pack includes (applied in order):</div>
        {blocks}
      </div>
    )
  }

  const sections = buildPackSections(data, '')
  if (!sections.length) return null
  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Your pack includes:</div>
      {sections}
    </div>
  )
}

// A combo pack's own `data` has no cars/currencies of its own — look across its
// resolved stages for the first one that does. Non-combo packs just use their
// own data directly, same as before combo packs existed.
function getEffectiveCarsSpec(pack) {
  if (pack?.data?.cars) return pack.data.cars
  return (pack?.stages || []).map(s => s.data?.cars).find(Boolean) || null
}

function hasAnyCurrencies(pack) {
  if (Object.values(pack?.data?.currencies || {}).some(v => v > 0)) return true
  return (pack?.stages || []).some(s => Object.values(s.data?.currencies || {}).some(v => v > 0))
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
  if (variant === 'danger') {
    return (
      <button onClick={onClick} disabled={disabled} style={{ ...base, background: disabled ? '#333' : RED, color: disabled ? '#666' : '#fff' }}>
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

// ─── Persistent FAQ (spec §1) — floats above every step, never hidden ─────────
const FAQ_ITEMS = [
  { q: 'How it works', a: "Enter your code, then your login — we auto-log in and mod the account. Don't log in manually while it's in progress." },
  { q: 'Is this safe?', a: "Credentials aren't stored — same trust model as handing them to a modder directly. Change your password afterward." },
  { q: 'Something went wrong with my order', a: 'Contact the seller on the platform you purchased from for compensation.' },
  { q: 'How long does this take?', a: 'A single device processes every order in sequence, so some wait time is possible.' },
]

function Faq() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 101, background: SURF, borderTop: `1px solid ${BORDER}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'transparent', border: 'none', color: MUTED, padding: '10px 16px', textAlign: 'left', fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>❓ FAQ</span><span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ maxHeight: 260, overflowY: 'auto', padding: '0 16px 14px' }}>
          {FAQ_ITEMS.map((it, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{it.q}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{it.a}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Report-an-error (spec §2) — appears once a code is entered ───────────────
function ReportErrorBar({ codeId, jobId }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    const message = text.trim()
    if (!message) return
    setSubmitting(true)
    setErr('')
    try {
      const res = await fetch('/api/csr2/error-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, jobId, message }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Could not submit'); return }
      // A local copy for the buyer's own records, alongside the uploaded one.
      const blob = new Blob([message], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'csr2-error-report.txt'
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
    } catch {
      setErr('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function close() {
    setOpen(false)
    setDone(false)
    setText('')
    setErr('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 101, background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: MUTED, cursor: 'pointer' }}
      >
        Report an error
      </button>
      {open && (
        <Modal>
          <ModalTitle>Report an Error</ModalTitle>
          <ModalSub>{done ? "Thanks — we've received your report." : 'Briefly describe what went wrong.'}</ModalSub>
          {!done && (
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder="What happened?"
              style={{ width: '100%', boxSizing: 'border-box', background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: TEXT, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
            />
          )}
          <ErrorNote>{err}</ErrorNote>
          <ModalActions>
            <Btn variant="secondary" onClick={close}>{done ? 'Close' : 'Cancel'}</Btn>
            {!done && <Btn onClick={submit} disabled={!text.trim() || submitting}>{submitting ? 'Submitting…' : 'Submit'}</Btn>}
          </ModalActions>
        </Modal>
      )}
    </>
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

const WHAT_TO_AVOID = [
  "Don't log into the account from any other device for at least 24 hours.",
  "Don't spend everything at once — gradual, natural-looking usage draws less attention.",
  "Don't contact support about the new balance — that's a common trigger for review.",
  "Do change the account password now that modding is complete.",
]

const POLL_MS = 2500

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function Csr2RedeemPage() {
  // 'code' -> 'confirm' -> ['cars'] -> 'accountMode' -> ['banStatus'] -> 'newAccountMessage' | 'credentials' -> 'status'
  const [step, setStep] = useState('code')

  // Redeem
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState('')
  const [codeId, setCodeId] = useState(null)
  const [pack, setPack] = useState(null)
  const [partial, setPartial] = useState(false)
  const [priorLedger, setPriorLedger] = useState(null)

  // Platform + safe mode + cars
  const [platform, setPlatform] = useState(null)
  const [safeMode, setSafeMode] = useState(false)
  const [carSelection, setCarSelection] = useState(null)
  const [carsList, setCarsList] = useState([])
  const [carsLoading, setCarsLoading] = useState(false)

  // Account mode
  const [accountMode, setAccountMode] = useState(null)
  const [accountModeSubmitting, setAccountModeSubmitting] = useState(false)
  const [accountModeError, setAccountModeError] = useState('')

  // Free-unban "is this banned?" (mandatory, non-skippable)
  const [accountBanned, setAccountBanned] = useState(null)
  const [banStatusSubmitting, setBanStatusSubmitting] = useState(false)
  const [banStatusError, setBanStatusError] = useState('')

  // Job
  const [jobId, setJobId] = useState(null)
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

  // Account confirmation
  const [confirmingAccount, setConfirmingAccount] = useState(false)
  const [confirmAccountError, setConfirmAccountError] = useState('')

  // GameCenter confirmation
  const [confirmingGamecenter, setConfirmingGamecenter] = useState(false)
  const [gamecenterError, setGamecenterError] = useState('')

  // Risk decision
  const [submittingRisk, setSubmittingRisk] = useState(false)
  const [riskError, setRiskError] = useState('')
  const [riskOverrideArmed, setRiskOverrideArmed] = useState(false)

  // Post-mod feedback / review
  const [feedbackText, setFeedbackText] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

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
      setPartial(!!data.partial)
      setPriorLedger(data.priorLedger || null)
      setStep('confirm')
    } catch {
      setRedeemError('Something went wrong. Please try again.')
    } finally {
      setRedeeming(false)
    }
  }

  // ── Confirm pack + platform -> cars (if any) or account mode ────────────
  function handleContinueFromConfirm() {
    if (platform !== 'ios') return
    setStep(getEffectiveCarsSpec(pack) ? 'cars' : 'accountMode')
  }

  useEffect(() => {
    if (step !== 'cars') return
    setCarsLoading(true)
    fetch('/api/csr2/cars')
      .then(r => r.json())
      .then(data => setCarsList(data.cars || []))
      .catch(() => setCarsList([]))
      .finally(() => setCarsLoading(false))
  }, [step])

  // ── Account mode -> create job (existing) or stop here (new) ────────────
  async function handleChooseAccountMode(mode) {
    setAccountMode(mode)
    setAccountModeSubmitting(true)
    setAccountModeError('')
    try {
      const res = await fetch('/api/csr2/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, platform, accountMode: mode, safeMode, carSelection }),
      })
      const data = await res.json()
      if (!res.ok) { setAccountModeError(data.error || 'Could not continue — please try again.'); return }
      if (data.needsNewAccount) { setStep('newAccountMessage'); return }
      setJobId(data.jobId)
      setStep(pack?.data?.freeUnban ? 'banStatus' : 'credentials')
    } catch {
      setAccountModeError('Something went wrong. Please try again.')
    } finally {
      setAccountModeSubmitting(false)
    }
  }

  // ── Free-unban "is this banned?" — mandatory before credentials ─────────
  async function handleSubmitBanStatus(banned) {
    if (!jobId) return
    setAccountBanned(banned)
    setBanStatusSubmitting(true)
    setBanStatusError('')
    try {
      const res = await fetch(`/api/csr2/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountBanned: banned }),
      })
      const data = await res.json()
      if (!res.ok) { setBanStatusError(data.error || 'Could not submit — please try again.'); return }
      setStep('credentials')
    } catch {
      setBanStatusError('Something went wrong. Please try again.')
    } finally {
      setBanStatusSubmitting(false)
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

  async function handleConfirmAccount(confirmed) {
    if (!jobId) return
    setConfirmingAccount(true)
    setConfirmAccountError('')
    try {
      const res = await fetch(`/api/csr2/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmAccount: confirmed }),
      })
      const data = await res.json()
      if (!res.ok) { setConfirmAccountError(data.error || 'Could not submit — please try again.'); return }
      preSubmitStatusRef.current = job?.status ?? null
      setResubmitting(true)
      pollJob()
    } catch {
      setConfirmAccountError('Something went wrong. Please try again.')
    } finally {
      setConfirmingAccount(false)
    }
  }

  async function handleGamecenterConfirm(confirmed) {
    if (!jobId) return
    setConfirmingGamecenter(true)
    setGamecenterError('')
    try {
      const res = await fetch(`/api/csr2/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gamecenterConfirm: confirmed }),
      })
      const data = await res.json()
      if (!res.ok) { setGamecenterError(data.error || 'Could not submit — please try again.'); return }
      preSubmitStatusRef.current = job?.status ?? null
      setResubmitting(true)
      pollJob()
    } catch {
      setGamecenterError('Something went wrong. Please try again.')
    } finally {
      setConfirmingGamecenter(false)
    }
  }

  async function handleRiskDecision(decision) {
    if (!jobId) return
    setSubmittingRisk(true)
    setRiskError('')
    try {
      const res = await fetch(`/api/csr2/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskDecision: decision }),
      })
      const data = await res.json()
      if (!res.ok) { setRiskError(data.error || 'Could not submit — please try again.'); return }
      setRiskOverrideArmed(false)
      preSubmitStatusRef.current = job?.status ?? null
      setResubmitting(true)
      pollJob()
    } catch {
      setRiskError('Something went wrong. Please try again.')
    } finally {
      setSubmittingRisk(false)
    }
  }

  async function handleSubmitFeedback() {
    if (!jobId || feedbackText.trim().length < 20) return
    setSubmittingFeedback(true)
    setFeedbackError('')
    try {
      const res = await fetch(`/api/csr2/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackText: feedbackText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setFeedbackError(data.error || 'Could not submit — please try again.'); return }
      pollJob()
    } catch {
      setFeedbackError('Something went wrong. Please try again.')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  async function handleSubmitReview() {
    if (!jobId) return
    setReviewSubmitting(true)
    try {
      await fetch(`/api/csr2/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewSubmitted: true }),
      })
      pollJob()
    } finally {
      setReviewSubmitting(false)
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
    // Some long waits (e.g. the save-load step) can run for many minutes with
    // the tab backgrounded, and browsers throttle/freeze setInterval in
    // inactive tabs — without this, the page can sit on a stale status
    // indefinitely even once brought back into focus. Re-poll immediately
    // the moment the tab becomes visible again, instead of waiting for the
    // (possibly still-throttled) interval to eventually catch up.
    const onVisible = () => { if (document.visibilityState === 'visible') pollJob() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [step, jobId, pollJob])

  // Keep the job id in the URL so reloading or reopening this tab resumes
  // watching the same order instead of losing it back to the code-entry step.
  useEffect(() => {
    if (!jobId) return
    const url = new URL(window.location.href)
    url.searchParams.set('job', jobId)
    window.history.replaceState(null, '', url.toString())
  }, [jobId])

  // On first load, resume an in-progress order from ?job=... instead of
  // starting over at the code-entry step.
  useEffect(() => {
    const existing = new URLSearchParams(window.location.search).get('job')
    if (existing) {
      setJobId(existing)
      setStep('status')
    }
  }, [])

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

          {partial && (
            <div style={{ padding: '10px 14px', background: '#2a1f0d', border: `1px solid ${AMBER}55`, borderRadius: 10, marginBottom: 14, fontSize: 12, color: AMBER }}>
              You&apos;re claiming the remaining balance on this code.
              {priorLedger?.account_last4 && (
                <> The first half was claimed on account ****{priorLedger.account_last4} on {new Date(priorLedger.redeemed_at).toLocaleDateString()}.</>
              )}
            </div>
          )}

          <div style={{ padding: '12px 14px', background: '#0d1f0d', border: `1px solid ${GREEN}33`, borderRadius: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>PACK</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{pack?.name}</div>
          </div>
          <PackContents data={pack?.data} stages={pack?.stages} />

          {hasAnyCurrencies(pack) && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={safeMode} onChange={e => setSafeMode(e.target.checked)} style={{ marginTop: 2 }} />
                <span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Safer side (recommended)</span>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    Delivers half the currencies now, the rest stays redeemable later on this same code — even on a different account or platform. Cars/fusions/Stage 6 are always delivered in full.
                  </div>
                </span>
              </label>
            </div>
          )}

          <div style={{ marginTop: 20, marginBottom: 6, fontSize: 13, fontWeight: 600, color: TEXT }}>Choose your platform</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <OptionCard label="iOS" sub="iPhone / iPad" selected={platform === 'ios'} onClick={() => setPlatform('ios')} />
            <OptionCard label="Android" sub="Phone / Emulator" badge="WIP" disabled onClick={() => {}} />
          </div>

          <ErrorNote>{jobCreateError}</ErrorNote>

          <ModalActions>
            <Btn variant="secondary" onClick={() => { setStep('code'); setPlatform(null); setJobCreateError('') }}>Back</Btn>
            <Btn onClick={handleContinueFromConfirm} disabled={platform !== 'ios'}>Continue</Btn>
          </ModalActions>
        </Modal>
      )}

      {step === 'cars' && (
        <Modal>
          <ModalTitle>Choose Your Cars</ModalTitle>
          <ModalSub>Fully random by default — hand-pick a few if you&apos;d like.</ModalSub>
          {carsLoading ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}><Spinner /></div>
          ) : (
            <CarPicker carsSpec={getEffectiveCarsSpec(pack)} carsList={carsList} value={carSelection} onChange={setCarSelection} />
          )}
          <ModalActions>
            <Btn variant="secondary" onClick={() => setStep('confirm')}>Back</Btn>
            <Btn onClick={() => setStep('accountMode')}>Continue</Btn>
          </ModalActions>
        </Modal>
      )}

      {step === 'accountMode' && (
        <Modal>
          <ModalTitle>Your Account</ModalTitle>
          <ModalSub>Do you already have a CSR2 account for this, or do you need one?</ModalSub>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <OptionCard label="I have one" sub="Log in and mod it" selected={accountMode === 'existing'} onClick={() => handleChooseAccountMode('existing')} />
            <OptionCard label="I need one" sub="No account yet" selected={accountMode === 'new'} onClick={() => handleChooseAccountMode('new')} />
          </div>
          <ErrorNote>{accountModeError}</ErrorNote>
          {accountModeSubmitting && <div style={{ textAlign: 'center', padding: '8px 0' }}><Spinner /></div>}
          <ModalActions>
            <Btn variant="secondary" onClick={() => setStep(getEffectiveCarsSpec(pack) ? 'cars' : 'confirm')}>Back</Btn>
          </ModalActions>
        </Modal>
      )}

      {step === 'newAccountMessage' && (
        <Modal>
          <ModalTitle>Need a New Account?</ModalTitle>
          <ModalSub>Please message me on the platform you purchased from to receive a new account.</ModalSub>
        </Modal>
      )}

      {step === 'banStatus' && (
        <Modal>
          <ModalTitle>Is This Account Currently Banned?</ModalTitle>
          <ModalSub>This pack includes a free unban — we need to know the account&apos;s current status before continuing.</ModalSub>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <OptionCard label="Yes, it's banned" selected={accountBanned === true} onClick={() => handleSubmitBanStatus(true)} />
            <OptionCard label="No, it's active" selected={accountBanned === false} onClick={() => handleSubmitBanStatus(false)} />
          </div>
          <ErrorNote>{banStatusError}</ErrorNote>
          {banStatusSubmitting && <div style={{ textAlign: 'center', padding: '8px 0' }}><Spinner /></div>}
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
            confirmingAccount, confirmAccountError, handleConfirmAccount,
            confirmingGamecenter, gamecenterError, handleGamecenterConfirm,
            submittingRisk, riskError, handleRiskDecision, riskOverrideArmed, setRiskOverrideArmed,
            feedbackText, setFeedbackText, submittingFeedback, feedbackError, handleSubmitFeedback,
            reviewSubmitting, handleSubmitReview,
          })}
        </Modal>
      )}

      {codeId && <ReportErrorBar codeId={codeId} jobId={jobId} />}
      <Faq />

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

  if (job.status === 'awaiting_account_confirm') {
    const info = job.account_confirm_data || {}
    return (
      <div>
        <ModalTitle>Confirm Your Account</ModalTitle>
        <ModalSub>We found this account on the device — please confirm it&apos;s yours before we continue.</ModalSub>
        <div style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: MUTED, fontSize: 13 }}>Account Name</span>
            <span style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>{info.name || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: MUTED, fontSize: 13 }}>Level</span>
            <span style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>{info.pllv ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: MUTED, fontSize: 13 }}>Save ID</span>
            <span style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>{info.folderId || '—'}</span>
          </div>
        </div>
        <ErrorNote>{ctx.confirmAccountError}</ErrorNote>
        <ModalActions>
          <Btn variant="secondary" onClick={() => ctx.handleConfirmAccount(false)} disabled={ctx.confirmingAccount}>
            Not My Account
          </Btn>
          <Btn onClick={() => ctx.handleConfirmAccount(true)} disabled={ctx.confirmingAccount}>
            {ctx.confirmingAccount ? 'Submitting…' : 'Yes, This Is Mine'}
          </Btn>
        </ModalActions>
      </div>
    )
  }

  if (job.status === 'awaiting_gamecenter_confirm') {
    return (
      <div>
        <ModalTitle>Confirm Your Account</ModalTitle>
        <ModalSub>This is the GameCenter account we signed into — is this yours?</ModalSub>
        {job.gamecenter_screenshot_url && (
          <img src={job.gamecenter_screenshot_url} alt="GameCenter account" style={{ width: '100%', borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 4 }} />
        )}
        <ErrorNote>{ctx.gamecenterError}</ErrorNote>
        <ModalActions>
          <Btn variant="secondary" onClick={() => ctx.handleGamecenterConfirm(false)} disabled={ctx.confirmingGamecenter}>
            Not Yours
          </Btn>
          <Btn onClick={() => ctx.handleGamecenterConfirm(true)} disabled={ctx.confirmingGamecenter}>
            {ctx.confirmingGamecenter ? 'Submitting…' : 'Yes, This Is Mine'}
          </Btn>
        </ModalActions>
      </div>
    )
  }

  if (job.status === 'awaiting_signin_approval') {
    // No buyer action here — the approval happens on their own device. We just
    // show what we're waiting on.
    return (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        {job.signin_approval_screenshot_url && (
          <img src={job.signin_approval_screenshot_url} alt="Sign-in approval" style={{ width: '100%', borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 16 }} />
        )}
        <Spinner />
        <div style={{ fontSize: 15, color: TEXT, fontWeight: 600 }}>Waiting for you to approve the sign-in…</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>Check your device for the approval prompt.</div>
      </div>
    )
  }

  if (job.status === 'awaiting_risk_decision') {
    const plan = job.riskPlan
    return (
      <div>
        <ModalTitle>Delivery Size</ModalTitle>
        <ModalSub>
          Based on this account&apos;s level{plan ? ` (${plan.level})` : ''}, here&apos;s what we recommend to keep ban risk low.
        </ModalSub>
        {job.account_banned && (
          <div style={{ padding: '10px 14px', background: '#2a1f0d', border: `1px solid ${AMBER}55`, borderRadius: 10, marginBottom: 14, fontSize: 12, color: AMBER }}>
            Since this account is banned, currencies are corrected toward a safe range as part of the unban — any amount held back stays redeemable later on this code.
          </div>
        )}
        {plan && (
          <div style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>SUGGESTED SAFE DELIVERY</div>
            {Object.entries(plan.plan.perResource).filter(([, v]) => v.desired > 0).map(([key, v]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                <span style={{ color: MUTED }}>{key}</span>
                <span style={{ color: TEXT }}>{Math.floor(v.safeDeliverable).toLocaleString()} / {Math.floor(v.desired).toLocaleString()}</span>
              </div>
            ))}
            {plan.repeat && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}`, fontSize: 12, color: MUTED }}>
                Combined risk with your last redemption ({Math.round(plan.repeat.daysSinceLastRedemption)} day{Math.round(plan.repeat.daysSinceLastRedemption) !== 1 ? 's' : ''} ago): <span style={{ color: TEXT, fontWeight: 600 }}>{plan.repeat.combinedTier}</span>
              </div>
            )}
          </div>
        )}
        <ErrorNote>{ctx.riskError}</ErrorNote>
        {!ctx.riskOverrideArmed ? (
          <ModalActions>
            <Btn variant="danger" onClick={() => ctx.setRiskOverrideArmed(true)} disabled={ctx.submittingRisk}>Override</Btn>
            <Btn onClick={() => ctx.handleRiskDecision('accept')} disabled={ctx.submittingRisk}>
              {ctx.submittingRisk ? 'Submitting…' : 'Accept Safe Amount'}
            </Btn>
          </ModalActions>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: RED, marginBottom: 12 }}>
              Delivering the full amount at this level significantly raises ban risk. Are you sure?
            </div>
            <ModalActions>
              <Btn variant="secondary" onClick={() => ctx.setRiskOverrideArmed(false)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => ctx.handleRiskDecision('override')} disabled={ctx.submittingRisk}>
                {ctx.submittingRisk ? 'Submitting…' : 'Yes, Deliver 100%'}
              </Btn>
            </ModalActions>
          </div>
        )}
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
    const rewards = job.rewards || []
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '4px 0 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Done</div>
          <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>Your pack has been applied to your account.</div>
        </div>

        {job.completion_screenshot_url && (
          <img src={job.completion_screenshot_url} alt="Completed account" style={{ width: '100%', borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 16 }} />
        )}

        <div style={{ background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: AMBER, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>TO AVOID A BAN</div>
          {WHAT_TO_AVOID.map((line, i) => (
            <div key={i} style={{ fontSize: 13, color: TEXT, padding: '3px 0' }}>• {line}</div>
          ))}
        </div>

        {rewards.length > 0 && (
          <div style={{ background: '#0d1f0d', border: `1px solid ${GREEN}33`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: GREEN }}>
            {rewards.some(r => r.kind === 'feedback') && <div>🎁 Reward earned: 1 free maxed car + 10K gold</div>}
            {rewards.some(r => r.kind === 'review') && <div>🎁 Reward earned: 1 free unban</div>}
          </div>
        )}

        {!job.feedback_rewarded ? (
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Feedback / Recommendations (20+ characters earns a reward)</FieldLabel>
            <textarea
              value={ctx.feedbackText}
              onChange={e => ctx.setFeedbackText(e.target.value)}
              rows={3}
              placeholder="How did it go? Anything we should improve?"
              style={{ width: '100%', boxSizing: 'border-box', background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: TEXT, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <ErrorNote>{ctx.feedbackError}</ErrorNote>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn onClick={ctx.handleSubmitFeedback} disabled={ctx.feedbackText.trim().length < 20 || ctx.submittingFeedback}>
                {ctx.submittingFeedback ? 'Submitting…' : 'Submit Feedback'}
              </Btn>
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
              Also consider messaging the seller on the platform you purchased from.
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: GREEN, marginBottom: 16 }}>✓ Feedback received — thank you!</div>
        )}

        {!job.review_submitted ? (
          <Btn variant="secondary" onClick={ctx.handleSubmitReview} disabled={ctx.reviewSubmitting} style={{ width: '100%' }}>
            {ctx.reviewSubmitting ? 'Submitting…' : 'Left a review on-site? Claim your free unban'}
          </Btn>
        ) : (
          <div style={{ fontSize: 13, color: GREEN }}>✓ Review reward claimed — thank you!</div>
        )}
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

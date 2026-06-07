'use client'
import { useState, useEffect, useRef } from 'react'

// ─── Colors ───────────────────────────────────────────────────────────────────
const BG      = '#0f0f0f'
const SURF    = '#1a1a1a'
const SURF2   = '#222222'
const BORDER  = '#2a2a2a'
const ACCENT  = '#7E6551'
const TEXT    = '#FDF4DC'
const MUTED   = '#a08570'
const GREEN   = '#4caf50'
const RED     = '#e05252'

// ─── Pack content formatter ───────────────────────────────────────────────────
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

  // Currencies
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

  // Cars
  if (cars) {
    let desc = ''
    if (cars.carMode === 'all') {
      desc = 'All available cars' + (cars.condition === 'maxed' ? ' · fully maxed' : '')
    } else if (cars.carMode === 'random') {
      desc = `${fmtN(cars.count)} random cars` + (cars.condition === 'maxed' ? ' · fully maxed' : '')
      if (cars.partial) desc += ` (buyer picks ${fmtN(cars.partial.count)})`
    } else if (cars.carMode === 'specific') {
      desc = 'Specific cars selected by operator'
    }
    sections.push(
      <div key="cars" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>🚗 Cars</div>
        <div style={{ fontSize: 13, color: TEXT }}>{desc}</div>
      </div>
    )
  }

  // Legends
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

  // Fusions
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

  // Stage 6
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

// ─── Shared button styles ─────────────────────────────────────────────────────
function Btn({ onClick, disabled, variant = 'primary', children, style = {} }) {
  const base = {
    padding: '11px 24px', borderRadius: 10, border: 'none', cursor: disabled ? 'default' : 'pointer',
    fontSize: 14, fontWeight: 600, transition: 'all 0.2s', ...style,
  }
  if (variant === 'primary') {
    return (
      <button onClick={onClick} disabled={disabled} style={{
        ...base,
        background: disabled ? '#333' : GREEN,
        color: disabled ? '#666' : '#fff',
      }}>{children}</button>
    )
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base,
      background: 'transparent',
      color: disabled ? '#555' : MUTED,
      border: `1px solid ${BORDER}`,
    }}>{children}</button>
  )
}

// ─── Option card (iOS/Android, Via Login/Token) ───────────────────────────────
function OptionCard({ label, sub, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, padding: '18px 16px', borderRadius: 12, cursor: 'pointer',
      border: `2px solid ${selected ? GREEN : BORDER}`,
      background: selected ? '#1a2e1a' : SURF2,
      textAlign: 'center', transition: 'all 0.15s',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: selected ? GREEN : TEXT, marginBottom: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: MUTED }}>{sub}</div>}
    </div>
  )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
function Modal({ children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: '20px 16px',
    }}>
      <div style={{
        background: SURF, border: `1px solid ${BORDER}`, borderRadius: 16,
        padding: '28px 28px 24px', width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}

function ModalTitle({ children }) {
  return <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 6 }}>{children}</div>
}

function ModalSub({ children }) {
  return <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>{children}</div>
}

function ModalActions({ children }) {
  return <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>{children}</div>
}

function ErrorNote({ children }) {
  if (!children) return null
  return (
    <div style={{
      background: '#2a1010', border: `1px solid ${RED}`, borderRadius: 8,
      padding: '9px 13px', fontSize: 13, color: '#f88', marginTop: 12,
    }}>{children}</div>
  )
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, marginBottom: 5 }}>{children}</div>
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: SURF2, border: `1px solid ${BORDER}`, borderRadius: 8,
        padding: '10px 12px', fontSize: 14, color: TEXT,
        outline: 'none', marginBottom: 14,
      }}
    />
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Csr2Page() {
  // Step 0: order ID, 1: platform, 2: android method, 3: credentials/upload, 4: success
  const [step, setStep] = useState(0)

  // Step 0 state
  const [orderId, setOrderId]           = useState('')
  const [validating, setValidating]     = useState(false)
  const [validResult, setValidResult]   = useState(null)
  // validResult: null | { ok: false, reason: 'order_not_found'|'pack_not_supported' } | { ok: true, pack }
  const debounceRef = useRef(null)

  // Step 1 state
  const [platform, setPlatform] = useState(null) // 'ios' | 'android'

  // Step 2 state (Android only)
  const [androidMethod, setAndroidMethod] = useState(null) // 'login' | 'token'

  // Step 3 credentials
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  // Step 3 token upload
  const [tokenFile, setTokenFile]   = useState(null)
  const [tokenError, setTokenError] = useState('')
  const fileInputRef = useRef(null)

  // ── Validate order ID with debounce ──────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const val = orderId.trim()
    if (!val) { setValidResult(null); return }
    debounceRef.current = setTimeout(() => doValidate(val), 700)
    return () => clearTimeout(debounceRef.current)
  }, [orderId])

  async function doValidate(id) {
    setValidating(true)
    setValidResult(null)
    try {
      const res = await fetch(`/api/csr2/verify?orderId=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!data.found) {
        setValidResult({ ok: false, reason: data.reason })
      } else if (data.reason === 'pack_not_supported') {
        setValidResult({ ok: false, reason: 'pack_not_supported' })
      } else {
        setValidResult({ ok: true, pack: data.pack })
      }
    } catch {
      setValidResult({ ok: false, reason: 'order_not_found' })
    } finally {
      setValidating(false)
    }
  }

  // ── Step handlers ─────────────────────────────────────────────────────────
  function handleConfirmOrder() {
    if (!validResult?.ok) return
    setStep(1)
  }

  function handleConfirmPlatform() {
    if (!platform) return
    if (platform === 'ios') setStep(3)
    else setStep(2)
  }

  function handleConfirmAndroidMethod() {
    if (!androidMethod) return
    setStep(3)
  }

  function handleConfirmCredentials() {
    if (!email.trim() || !password.trim()) return
    setStep(4)
  }

  function handleConfirmToken() {
    if (!tokenFile) return
    setStep(4)
  }

  function handleTokenFileChange(e) {
    setTokenError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.akc')) {
      setTokenError('Only .akc files are accepted.')
      setTokenFile(null)
      return
    }
    setTokenFile(file)
  }

  // Determine which step 3 sub-flow we're in
  const isIos           = platform === 'ios'
  const isAndroidLogin  = platform === 'android' && androidMethod === 'login'
  const isAndroidToken  = platform === 'android' && androidMethod === 'token'

  // ── Error messages ─────────────────────────────────────────────────────────
  function orderErrorMsg() {
    if (!validResult || validResult.ok) return null
    if (validResult.reason === 'order_not_found')
      return "Order ID doesn't exist. Please contact customer support, or wait a few minutes and try again."
    if (validResult.reason === 'pack_not_supported')
      return "This pack is currently not supported. Please contact customer support."
    return "Something went wrong. Please try again."
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* ── Step 0: Order ID ── */}
      {step === 0 && (
        <Modal>
          <ModalTitle>Enter Your Order ID</ModalTitle>
          <ModalSub>Paste the Order ID from your purchase confirmation.</ModalSub>

          <FieldLabel>Order ID</FieldLabel>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={orderId}
              onChange={e => { setOrderId(e.target.value); setValidResult(null) }}
              placeholder="e.g. 1234567890"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: SURF2, border: `1px solid ${validResult?.ok ? GREEN : validResult ? RED : BORDER}`,
                borderRadius: 8, padding: '10px 40px 10px 12px',
                fontSize: 14, color: TEXT, outline: 'none',
              }}
            />
            {validating && (
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: MUTED, fontSize: 12 }}>
                checking…
              </div>
            )}
            {validResult?.ok && !validating && (
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: GREEN, fontSize: 16 }}>✓</div>
            )}
          </div>

          <ErrorNote>{orderErrorMsg()}</ErrorNote>

          {/* Pack contents */}
          {validResult?.ok && (
            <div>
              <div style={{ marginTop: 18, padding: '12px 14px', background: '#0d1f0d', border: `1px solid ${GREEN}33`, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>PACK MATCHED</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{validResult.pack?.name}</div>
              </div>
              <PackContents data={validResult.pack?.data} />
            </div>
          )}

          <ModalActions>
            <Btn variant="secondary" onClick={() => window.close()}>Cancel</Btn>
            <Btn onClick={handleConfirmOrder} disabled={!validResult?.ok || validating}>
              Confirm
            </Btn>
          </ModalActions>
        </Modal>
      )}

      {/* ── Step 1: Platform ── */}
      {step === 1 && (
        <Modal>
          <ModalTitle>Choose Your Platform</ModalTitle>
          <ModalSub>Select the device your CSR2 account is on.</ModalSub>

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <OptionCard label="iOS" sub="iPhone / iPad" selected={platform === 'ios'} onClick={() => setPlatform('ios')} />
            <OptionCard label="Android" sub="Phone / Emulator" selected={platform === 'android'} onClick={() => setPlatform('android')} />
          </div>

          <ModalActions>
            <Btn variant="secondary" onClick={() => { setStep(0); setPlatform(null) }}>Back</Btn>
            <Btn onClick={handleConfirmPlatform} disabled={!platform}>Confirm</Btn>
          </ModalActions>
        </Modal>
      )}

      {/* ── Step 2: Android method ── */}
      {step === 2 && (
        <Modal>
          <ModalTitle>Account Access Method</ModalTitle>
          <ModalSub>How would you like us to access your account?</ModalSub>

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <OptionCard
              label="Via Login"
              sub="Provide your account email & password"
              selected={androidMethod === 'login'}
              onClick={() => setAndroidMethod('login')}
            />
            <OptionCard
              label="Login Token"
              sub="Upload your .akc token file (no password needed)"
              selected={androidMethod === 'token'}
              onClick={() => setAndroidMethod('token')}
            />
          </div>

          <ModalActions>
            <Btn variant="secondary" onClick={() => { setStep(1); setAndroidMethod(null) }}>Back</Btn>
            <Btn onClick={handleConfirmAndroidMethod} disabled={!androidMethod}>Confirm</Btn>
          </ModalActions>
        </Modal>
      )}

      {/* ── Step 3: iOS login ── */}
      {step === 3 && isIos && (
        <Modal>
          <ModalTitle>iOS Account Details</ModalTitle>
          <ModalSub>Enter your Apple ID and CSR2 account password.</ModalSub>

          <FieldLabel>Email</FieldLabel>
          <TextInput value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />

          <FieldLabel>Password</FieldLabel>
          <TextInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" />

          <ModalActions>
            <Btn variant="secondary" onClick={() => { setStep(1); setEmail(''); setPassword('') }}>Back</Btn>
            <Btn onClick={handleConfirmCredentials} disabled={!email.trim() || !password.trim()}>Confirm</Btn>
          </ModalActions>
        </Modal>
      )}

      {/* ── Step 3: Android login ── */}
      {step === 3 && isAndroidLogin && (
        <Modal>
          <ModalTitle>Android Account Details</ModalTitle>
          <ModalSub>Enter your Gmail address and CSR2 account password.</ModalSub>

          <FieldLabel>Gmail Address</FieldLabel>
          <TextInput value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" />

          <FieldLabel>Password</FieldLabel>
          <TextInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" />

          <ModalActions>
            <Btn variant="secondary" onClick={() => { setStep(2); setEmail(''); setPassword('') }}>Back</Btn>
            <Btn onClick={handleConfirmCredentials} disabled={!email.trim() || !password.trim()}>Confirm</Btn>
          </ModalActions>
        </Modal>
      )}

      {/* ── Step 3: Android token upload ── */}
      {step === 3 && isAndroidToken && (
        <Modal>
          <ModalTitle>Upload Account Token</ModalTitle>
          <ModalSub>Upload your .akc login token file. Only .akc files are accepted.</ModalSub>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${tokenFile ? GREEN : BORDER}`,
              borderRadius: 12, padding: '32px 20px', textAlign: 'center',
              cursor: 'pointer', background: tokenFile ? '#0d1f0d' : SURF2,
              transition: 'all 0.15s', marginBottom: 4,
            }}
          >
            {tokenFile ? (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                <div style={{ fontSize: 14, color: GREEN, fontWeight: 600 }}>{tokenFile.name}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Click to replace</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                <div style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>Click to select your .akc file</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Only .akc files accepted</div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".akc"
            onChange={handleTokenFileChange}
            style={{ display: 'none' }}
          />

          <ErrorNote>{tokenError}</ErrorNote>

          <ModalActions>
            <Btn variant="secondary" onClick={() => { setStep(2); setTokenFile(null); setTokenError('') }}>Back</Btn>
            <Btn onClick={handleConfirmToken} disabled={!tokenFile}>Confirm</Btn>
          </ModalActions>
        </Modal>
      )}

      {/* ── Step 4: Success (placeholder) ── */}
      {step === 4 && (
        <Modal>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
              {isIos ? 'iOS Login Completed' : 'Android Token Login Completed'}
            </div>
            <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>
              Your order has been received. You will be notified once the pack has been applied to your account.
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { Mail, Check, X, AlertCircle, Trash2, Send, Star, ArrowLeft, Settings, Gamepad2, Plus, ChevronDown } from 'lucide-react'

const STATUS_COLORS = {
  New: { bg: '#2196f322', color: '#2196f3' },
  Reviewing: { bg: '#e8a02022', color: '#e8a020' },
  Accepted: { bg: '#4caf5022', color: '#4caf50' },
  Declined: { bg: '#e0525222', color: '#e05252' },
  OfferMade: { bg: '#9c27b022', color: '#9c27b0' },
}

const PRIORITY_COLORS = {
  High: { bg: '#e8a02022', color: '#e8a020' },
  Normal: { bg: '#7E655122', color: '#7E6551' },
  Low: { bg: '#88888822', color: '#888' },
}

const FIELD_TYPES = ['Text', 'Number', 'Dropdown', 'Checkbox']
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

function getTypeColor(type) {
  const map = { Number: '#2196f3', Dropdown: '#9c27b0', Checkbox: '#4caf50', Text: '#7E6551' }
  return map[type] || '#7E6551'
}

function FieldBuilder({ listKey, configData, setConfigData, border, text, muted, bg, inputBg, sectionBg }) {
  const addField = () => {
    if (!configData.newFieldLabel?.trim()) return
    const field = {
      id: uid(), label: configData.newFieldLabel, type: configData.newFieldType || 'Text',
      options: configData.newFieldType === 'Dropdown' ? (configData.newFieldOptions || []) : [],
      tooltip: configData.newFieldTooltip || '', videoUrl: configData.newFieldVideoUrl || '',
    }
    setConfigData(prev => ({ ...prev, [listKey]: [...(prev[listKey] || []), field], newFieldLabel: '', newFieldType: 'Text', newFieldOptions: [], newFieldOption: '', newFieldTooltip: '', newFieldVideoUrl: '' }))
  }

  const removeField = (id) => {
    setConfigData(prev => ({ ...prev, [listKey]: prev[listKey].filter(f => f.id !== id) }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {(configData[listKey] || []).map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{f.label}</span>
              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: getTypeColor(f.type) + '22', color: getTypeColor(f.type) }}>{f.type}</span>
            </div>
            {f.tooltip && <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>💬 {f.tooltip}</div>}
            {f.videoUrl && <div style={{ fontSize: '11px', color: '#2196f3', marginTop: '1px' }}>🎥 Video attached</div>}
            {(f.options || []).length > 0 && <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>Options: {f.options.join(', ')}</div>}
          </div>
          <button onClick={() => removeField(id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={13} /></button>
        </div>
      ))}
      <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}` }}>
        <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '10px' }}>Add Field</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input value={configData.newFieldLabel || ''} onChange={e => setConfigData(prev => ({ ...prev, newFieldLabel: e.target.value }))}
            placeholder="Field name e.g. Server"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FIELD_TYPES.map(t => (
              <button key={t} onClick={() => setConfigData(prev => ({ ...prev, newFieldType: t, newFieldOptions: [] }))}
                style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${configData.newFieldType === t ? getTypeColor(t) : border}`, background: configData.newFieldType === t ? getTypeColor(t) + '22' : 'transparent', color: configData.newFieldType === t ? getTypeColor(t) : muted, fontSize: '12px', cursor: 'pointer' }}>
                {t}
              </button>
            ))}
          </div>
          {configData.newFieldType === 'Dropdown' && (
            <div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input value={configData.newFieldOption || ''} onChange={e => setConfigData(prev => ({ ...prev, newFieldOption: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && configData.newFieldOption?.trim()) setConfigData(prev => ({ ...prev, newFieldOptions: [...(prev.newFieldOptions || []), prev.newFieldOption.trim()], newFieldOption: '' })) }}
                  placeholder="Add option"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
                <button onClick={() => { if (configData.newFieldOption?.trim()) setConfigData(prev => ({ ...prev, newFieldOptions: [...(prev.newFieldOptions || []), prev.newFieldOption.trim()], newFieldOption: '' })) }}
                  style={{ padding: '8px 12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(configData.newFieldOptions || []).map((opt, i) => (
                  <span key={i} style={{ fontSize: '12px', padding: '3px 10px', background: '#9c27b022', color: '#9c27b0', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {opt}
                    <button onClick={() => setConfigData(prev => ({ ...prev, newFieldOptions: prev.newFieldOptions.filter((_, idx) => idx !== i) }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9c27b0', padding: 0, display: 'flex' }}><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <input value={configData.newFieldTooltip || ''} onChange={e => setConfigData(prev => ({ ...prev, newFieldTooltip: e.target.value }))}
            placeholder="Tooltip text (optional)"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
          <input value={configData.newFieldVideoUrl || ''} onChange={e => setConfigData(prev => ({ ...prev, newFieldVideoUrl: e.target.value }))}
            placeholder="Video URL (optional)"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
          <button onClick={addField}
            style={{ width: '100%', padding: '9px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Field
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Config Modal (outside to prevent remount) ────────────────────
function OffersConfigModal({ game, configData, setConfigData, configTab, setConfigTab, onSave, onClose, card, border, text, muted, bg, inputBg, sectionBg }) {

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
      <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '520px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>💬 {game?.name} — Offers Config</h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { key: 'direct', label: '💰 Sell Directly' },
              { key: 'help', label: '🤝 Help Selling' },
              { key: 'priority', label: '⭐ Priority Rules' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setConfigTab(tab.key)}
                style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', background: configTab === tab.key ? '#7E6551' : sectionBg, color: configTab === tab.key ? '#FDF4DC' : muted, fontWeight: configTab === tab.key ? '500' : '400' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {configTab === 'direct' && (
            <>
              <div style={{ padding: '10px 14px', background: '#2196f311', borderRadius: '8px', border: '1px solid #2196f333', fontSize: '12px', color: '#2196f3' }}>
                Fields shown when someone wants to sell directly to you.
              </div>
              <FieldBuilder listKey="directFields" configData={configData} setConfigData={setConfigData} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg} />
            </>
          )}
          {configTab === 'help' && (
            <>
              <div style={{ padding: '10px 14px', background: '#9c27b011', borderRadius: '8px', border: '1px solid #9c27b033', fontSize: '12px', color: '#9c27b0' }}>
                Fields shown when someone needs help selling their account.
              </div>
              <FieldBuilder listKey="helpFields" configData={configData} setConfigData={setConfigData} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg} />
            </>
          )}
          {configTab === 'priority' && (
            <>
              <div style={{ fontSize: '13px', color: muted }}>Rules are checked in order — first match wins.</div>
              {(configData.priorityRules || []).map((rule, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}` }}>
                  <div style={{ fontSize: '13px', color: text }}>
                    If <span style={{ color: '#7E6551', fontWeight: '500' }}>{rule.field}</span> {rule.operator} <span style={{ color: '#7E6551', fontWeight: '500' }}>{rule.value}</span> → <span style={{ fontWeight: '600', color: rule.priority === 'High' ? '#e8a020' : '#888' }}>{rule.priority} Priority</span>
                  </div>
                  <button onClick={() => setConfigData(prev => ({ ...prev, priorityRules: prev.priorityRules.filter((_, idx) => idx !== i) }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={14} /></button>
                </div>
              ))}
              <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}` }}>
                <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '10px' }}>Add Rule</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Field to check</label>
                    <select value={configData.newRuleField || ''} onChange={e => setConfigData(prev => ({ ...prev, newRuleField: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                      <option value="">Select field...</option>
                      <option value="price">Price</option>
                      {(configData.directFields || []).filter(f => f.type === 'Number').map(f => (
                        <option key={f.id} value={f.label}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={configData.newRuleOperator || '>='} onChange={e => setConfigData(prev => ({ ...prev, newRuleOperator: e.target.value }))}
                      style={{ width: '80px', flexShrink: 0, padding: '8px 6px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                      {['>=', '<=', '=', '>', '<'].map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                    <input type="number" value={configData.newRuleValue || ''} onChange={e => setConfigData(prev => ({ ...prev, newRuleValue: e.target.value }))}
                      placeholder="Value" style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
                    <select value={configData.newRulePriority || 'High'} onChange={e => setConfigData(prev => ({ ...prev, newRulePriority: e.target.value }))}
                      style={{ width: '90px', flexShrink: 0, padding: '8px 6px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                      <option value="High">High</option>
                      <option value="Normal">Normal</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <button onClick={() => {
                    if (!configData.newRuleField || !configData.newRuleValue) return
                    const rule = { field: configData.newRuleField, operator: configData.newRuleOperator || '>=', value: configData.newRuleValue, priority: configData.newRulePriority || 'High' }
                    setConfigData(prev => ({ ...prev, priorityRules: [...(prev.priorityRules || []), rule], newRuleField: '', newRuleValue: '' }))
                  }}
                    style={{ width: '100%', padding: '9px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Plus size={14} /> Add Rule
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <button onClick={onSave}
            style={{ width: '100%', padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Email Reply Modal ────────────────────────────────────────────
function EmailModal({ offer, onClose, onStatusUpdate, darkMode, card, border, text, muted, bg, inputBg, sectionBg }) {
  const [template, setTemplate] = useState('deny')
  const [reason, setReason] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [contactPlatform, setContactPlatform] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('offerContactPlatform') || ''
    return ''
  })
  const [contactId, setContactId] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('offerContactId') || ''
    return ''
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const buildMessage = () => {
    switch (template) {
      case 'deny':
        return `Hi,\n\nThank you for reaching out to us regarding your account.\n\nAfter carefully reviewing your offer, we have decided not to proceed.${reason ? ` The reason for this decision is: ${reason}.` : ''}\n\nWe appreciate your time and hope to work with you in the future.\n\nBest regards`
      case 'offer':
        return `Hi,\n\nThank you for submitting your account details.\n\nWe have reviewed your offer and would like to make a counter-offer of $${offerPrice || 'XX'}. If you are interested, please contact us on ${contactPlatform || '[Platform]'} at ${contactId || '[ID]'} to discuss further.\n\nLooking forward to hearing from you.\n\nBest regards`
      case 'accept':
        return `Hi,\n\nGreat news! We have reviewed your offer and decided to accept it.\n\nPlease message us on ${contactPlatform || '[Platform]'} at ${contactId || '[ID]'} to finalize the deal. We look forward to completing this transaction with you.\n\nBest regards`
      default: return ''
    }
  }

  const newStatus = template === 'deny' ? 'Declined' : template === 'accept' ? 'Accepted' : 'OfferMade'
  const message = buildMessage()

  const handleSend = async () => {
    setError('')
    if (typeof window !== 'undefined') {
      localStorage.setItem('offerContactPlatform', contactPlatform)
      localStorage.setItem('offerContactId', contactId)
    }
    setSending(true)
    try {
      // Send email if contact_email exists
      if (offer.contact_email) {
        const emailRes = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: offer.contact_email,
            subject: template === 'deny' ? 'Regarding Your Account Offer' : template === 'offer' ? 'Counter Offer for Your Account' : 'Your Account Offer Has Been Accepted',
            message,
          }),
        })
        const emailData = await emailRes.json()
        if (emailData.error) {
          setError(`Email failed: ${emailData.error}`)
          setSending(false)
          return
        }
      }

      // Update offer status
      await fetch(`/api/offers/${offer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, priority: offer.priority }),
      })

      onStatusUpdate(offer.id, newStatus)
      setSent(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '20px' }}>
      <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '560px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>Reply to Offer</h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
          </div>
          <div style={{ fontSize: '12px', color: muted, marginTop: '4px' }}>
            {offer.contact_email
              ? <>To: <span style={{ color: text }}>{offer.contact_email}</span></>
              : <span style={{ color: '#e8a020' }}>⚠ No email — status will be updated but email won't be sent</span>
            }
          </div>
        </div>

        {sent ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', background: '#4caf5022', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={22} color="#4caf50" />
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>
              {offer.contact_email ? 'Email Sent!' : 'Status Updated!'}
            </div>
            <div style={{ fontSize: '13px', color: muted, marginBottom: '20px' }}>
              Offer marked as <strong>{newStatus}</strong>.
              {offer.contact_email && ' Email sent successfully.'}
            </div>
            <button onClick={onClose} style={{ padding: '10px 24px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Template */}
              <div>
                <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '8px' }}>Response Template</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { key: 'deny', label: '❌ Deny', color: '#e05252' },
                    { key: 'offer', label: '💬 Make Offer', color: '#9c27b0' },
                    { key: 'accept', label: '✓ Accept', color: '#4caf50' },
                  ].map(t => (
                    <button key={t.key} onClick={() => setTemplate(t.key)}
                      style={{ padding: '10px 8px', borderRadius: '8px', border: `1px solid ${template === t.key ? t.color : border}`, background: template === t.key ? t.color + '15' : 'transparent', color: template === t.key ? t.color : muted, fontSize: '12px', cursor: 'pointer', fontWeight: template === t.key ? '600' : '400' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {template === 'deny' && (
                <div>
                  <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Reason <span style={{ fontWeight: '300' }}>(optional)</span></label>
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. account level doesn't meet our requirements"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
                </div>
              )}

              {template === 'offer' && (
                <div>
                  <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Your Offer Price (USD)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: muted, fontSize: '13px' }}>$</span>
                    <input type="number" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} placeholder="0.00"
                      style={{ width: '100%', padding: '10px 12px 10px 26px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
                  </div>
                </div>
              )}

              {(template === 'offer' || template === 'accept') && (
                <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}` }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '10px' }}>Your Contact Info</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Platform (e.g. Discord)</label>
                      <input value={contactPlatform} onChange={e => setContactPlatform(e.target.value)} placeholder="Discord"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Your Username / ID</label>
                      <input value={contactId} onChange={e => setContactId(e.target.value)} placeholder="e.g. antlerzone"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: muted, marginTop: '6px' }}>Saved automatically for future replies.</div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Message Preview</label>
                <pre style={{ margin: 0, padding: '14px', background: sectionBg, border: `1px solid ${border}`, borderRadius: '8px', fontSize: '12px', color: text, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: 'inherit' }}>
                  {message}
                </pre>
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: '#e0525211', border: '1px solid #e0525233', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={14} color="#e05252" />
                  <span style={{ fontSize: '13px', color: '#e05252' }}>{error}</span>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0, display: 'flex', gap: '10px' }}>
              <button onClick={handleCopy}
                style={{ padding: '10px 16px', background: 'transparent', color: copied ? '#4caf50' : muted, border: `1px solid ${copied ? '#4caf5044' : border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button onClick={handleSend} disabled={sending}
                style={{ flex: 1, padding: '10px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: sending ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: sending ? 0.7 : 1 }}>
                <Send size={13} /> {sending ? 'Sending...' : offer.contact_email ? 'Send Email & Update Status' : 'Update Status'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Offers Component ────────────────────────────────────────
export default function Offers({ darkMode, games, gameConfigs, saveGameConfig }) {
  const [selectedGame, setSelectedGame] = useState(null)
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('direct')
  const [selectedOffer, setSelectedOffer] = useState(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailOffer, setEmailOffer] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configuringGame, setConfiguringGame] = useState(null)
  const [configTab, setConfigTab] = useState('direct')
  const [configData, setConfigData] = useState({})
  const [linkCopied, setLinkCopied] = useState(false)

  const card = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text = darkMode ? '#FDF4DC' : '#151515'
  const muted = darkMode ? '#a08570' : '#7E6551'
  const bg = darkMode ? '#151515' : '#FDF4DC'
  const inputBg = darkMode ? '#2a2a2a' : '#fff'
  const sectionBg = darkMode ? '#252525' : '#f9f4ea'

  useEffect(() => { loadOffers() }, [])

  const loadOffers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/offers')
      const data = await res.json()
      if (Array.isArray(data)) setOffers(data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const getGameConfig = (gameId) => {
    const config = gameConfigs.find(c => c.game_id === gameId && c.section === 'offers')
    return config?.config || { directFields: [], helpFields: [], priorityRules: [] }
  }

  const isConfigured = (gameId) => {
    const config = getGameConfig(gameId)
    return (config.directFields || []).length > 0 || (config.helpFields || []).length > 0
  }

  const openConfigModal = (game, e) => {
    if (e) e.stopPropagation()
    const existing = getGameConfig(game.id)
    setConfiguringGame(game)
    setConfigData({
      directFields: existing.directFields || [],
      helpFields: existing.helpFields || [],
      priorityRules: existing.priorityRules || [],
      newFieldLabel: '', newFieldType: 'Text', newFieldOptions: [],
      newFieldOption: '', newFieldTooltip: '', newFieldVideoUrl: '',
      newRuleField: '', newRuleOperator: '>=', newRuleValue: '', newRulePriority: 'High',
    })
    setConfigTab('direct')
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    if (!configuringGame) return
    await saveGameConfig(configuringGame.id, 'offers', {
      directFields: configData.directFields,
      helpFields: configData.helpFields,
      priorityRules: configData.priorityRules,
    })
    setShowConfigModal(false)
    setConfiguringGame(null)
  }

  const deleteOffer = async (id) => {
    try {
      await fetch(`/api/offers/${id}`, { method: 'DELETE' })
      setOffers(prev => prev.filter(o => o.id !== id))
      if (selectedOffer?.id === id) setSelectedOffer(null)
    } catch (err) { console.error(err) }
  }

  const handleStatusUpdate = (id, newStatus) => {
    setOffers(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
  }

  const offerGames = games.filter(g => (g.sections || []).includes('offers'))

  // Offers for selected game (or custom)
  const gameOffers = selectedGame
    ? selectedGame.id === 'custom'
      ? offers.filter(o => !o.game_id || !games.find(g => g.id === o.game_id))
      : offers.filter(o => o.game_id === selectedGame.id)
    : []

  const filteredOffers = gameOffers
    .filter(o => o.offer_type === (activeTab === 'direct' ? 'direct' : 'help'))
    .filter(o => statusFilter === 'All' || o.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'priority') {
        const order = { High: 0, Normal: 1, Low: 2 }
        return (order[a.priority] || 1) - (order[b.priority] || 1)
      }
      return 0
    })

  const getOfferCount = (gameId) => {
    if (gameId === 'custom') return offers.filter(o => !o.game_id || !games.find(g => g.id === o.game_id)).length
    return offers.filter(o => o.game_id === gameId).length
  }

  const newCount = offers.filter(o => o.status === 'New').length

  const copyBuyLink = () => {
    const url = `${window.location.origin}/buy`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  // ─── VIEW 1: Game Grid ─────────────────────────────────────────
  if (!selectedGame) {
    return (
      <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Offers</h1>
            <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>
              {offers.length} total offers
              {newCount > 0 && <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#2196f322', color: '#2196f3', borderRadius: '10px', fontSize: '12px' }}>{newCount} new</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={copyBuyLink}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: linkCopied ? '#4caf5022' : 'transparent', color: linkCopied ? '#4caf50' : muted, border: `1px solid ${linkCopied ? '#4caf5044' : border}`, borderRadius: '10px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
              {linkCopied ? '✓ Copied!' : '🔗 Share Offer Page'}
            </button>
            <a href="/buy" target="_blank"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#7E6551', color: '#FDF4DC', borderRadius: '10px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
              👁 Preview
            </a>
          </div>
        </div>

        {offerGames.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>💬</span>
            <div style={{ fontSize: '17px', fontWeight: '600', color: text, marginBottom: '8px' }}>No games configured for offers</div>
            <div style={{ fontSize: '13px', color: muted }}>Add a game and enable the Offers section to get started</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {offerGames.map(game => {
              const count = getOfferCount(game.id)
              const configured = isConfigured(game.id)
              const newForGame = offers.filter(o => o.game_id === game.id && o.status === 'New').length
              return (
                <div key={game.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                  {/* Gear icon */}
                  <button onClick={e => openConfigModal(game, e)} title="Configure offer fields"
                    style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}>
                    <Settings size={13} />
                  </button>
                  <div onClick={() => setSelectedGame(game)} style={{ cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '100px', background: game.image ? `url(${game.image}) center/cover no-repeat` : '#2196f322', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!game.image && <span style={{ fontSize: '32px' }}>💬</span>}
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: text }}>{game.name}</div>
                        {newForGame > 0 && <span style={{ fontSize: '11px', padding: '2px 8px', background: '#2196f322', color: '#2196f3', borderRadius: '10px' }}>{newForGame} new</span>}
                      </div>
                      {configured ? (
                        <div style={{ fontSize: '11px', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={10} /> Configured • {count} offer{count !== 1 ? 's' : ''}
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#e8a020', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Settings size={10} /> Configure fields first
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Custom Game tile */}
            {(() => {
              const customCount = getOfferCount('custom')
              const newCustom = offers.filter(o => (!o.game_id || !games.find(g => g.id === o.game_id)) && o.status === 'New').length
              return (
                <div onClick={() => setSelectedGame({ id: 'custom', name: 'Custom / Other', image: '' })}
                  style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', opacity: 0.85 }}>
                  <div style={{ width: '100%', height: '100px', background: sectionBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '32px' }}>🎮</span>
                  </div>
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: text }}>Custom / Other</div>
                      {newCustom > 0 && <span style={{ fontSize: '11px', padding: '2px 8px', background: '#2196f322', color: '#2196f3', borderRadius: '10px' }}>{newCustom} new</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: muted }}>{customCount} offer{customCount !== 1 ? 's' : ''} — games not in your list</div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {showConfigModal && configuringGame && (
          <OffersConfigModal
            game={configuringGame} configData={configData} setConfigData={setConfigData}
            configTab={configTab} setConfigTab={setConfigTab}
            onSave={handleSaveConfig} onClose={() => setShowConfigModal(false)}
            card={card} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
          />
        )}
      </div>
    )
  }

  // ─── VIEW 2: Offers List ───────────────────────────────────────
  const totalDirect = gameOffers.filter(o => o.offer_type === 'direct').length
  const totalHelp = gameOffers.filter(o => o.offer_type === 'help').length

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
      <button onClick={() => { setSelectedGame(null); setSelectedOffer(null) }}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '13px', marginBottom: '24px', padding: 0 }}>
        <ArrowLeft size={15} /> Back to Games
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: selectedGame.image ? `url(${selectedGame.image}) center/cover no-repeat` : '#2196f322', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!selectedGame.image && <span>💬</span>}
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>{selectedGame.name}</h1>
            <p style={{ fontSize: '13px', color: muted, marginTop: '2px' }}>{gameOffers.length} offers total</p>
          </div>
        </div>
        {selectedGame.id !== 'custom' && (
          <button onClick={e => openConfigModal(selectedGame, e)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', cursor: 'pointer', fontSize: '14px' }}>
            <Settings size={15} /> Config
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[{ key: 'direct', label: '💰 Direct Offers', count: totalDirect }, { key: 'help', label: '🤝 Help Requests', count: totalHelp }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: '7px 16px', borderRadius: '20px', border: `1px solid ${activeTab === tab.key ? '#7E6551' : border}`, background: activeTab === tab.key ? '#7E6551' : 'transparent', color: activeTab === tab.key ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', fontWeight: activeTab === tab.key ? '500' : '400', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {tab.label}
            <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : border, color: activeTab === tab.key ? '#FDF4DC' : muted }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['All', 'New', 'Reviewing', 'OfferMade', 'Accepted', 'Declined'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${statusFilter === s ? '#7E6551' : border}`, background: statusFilter === s ? '#7E6551' : 'transparent', color: statusFilter === s ? '#FDF4DC' : muted, fontSize: '12px', cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="priority">By priority</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: muted }}>Loading offers...</div>
      ) : filteredOffers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: card, borderRadius: '12px', border: `1px solid ${border}` }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📭</span>
          <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>No offers yet</div>
          <div style={{ fontSize: '13px', color: muted }}>Share your /buy page to start receiving offers</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredOffers.map(offer => (
            <div key={offer.id}
              style={{ background: card, border: `1px solid ${offer.status === 'New' ? '#2196f344' : border}`, borderRadius: '12px', padding: '16px 20px', cursor: 'pointer', transition: 'border 0.15s' }}
              onClick={() => setSelectedOffer(selectedOffer?.id === offer.id ? null : offer)}
              onMouseEnter={e => e.currentTarget.style.border = `1px solid #7E6551`}
              onMouseLeave={e => e.currentTarget.style.border = `1px solid ${offer.status === 'New' ? '#2196f344' : border}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {offer.priority === 'High' && <Star size={12} color="#e8a020" fill="#e8a020" />}
                    <span style={{ fontSize: '14px', fontWeight: '500', color: text }}>
                      {offer.fields?.customGameName || offer.game_name || 'Unknown Game'}
                    </span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: PRIORITY_COLORS[offer.priority]?.bg, color: PRIORITY_COLORS[offer.priority]?.color }}>{offer.priority}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: muted, flexWrap: 'wrap' }}>
                    {offer.price > 0 && <span style={{ color: '#4caf50', fontWeight: '500' }}>${offer.price}</span>}
                    {offer.contact_discord && <span>Discord: {offer.contact_discord}</span>}
                    {offer.contact_email && <span>{offer.contact_email}</span>}
                    <span>{new Date(offer.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: STATUS_COLORS[offer.status]?.bg, color: STATUS_COLORS[offer.status]?.color, fontWeight: '500' }}>
                    {offer.status}
                  </span>
                  <button onClick={e => { e.stopPropagation(); setEmailOffer(offer); setShowEmailModal(true) }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }} title="Reply">
                    <Mail size={15} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteOffer(offer.id) }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {selectedOffer?.id === offer.id && (
                <div style={{ borderTop: `1px solid ${border}`, paddingTop: '14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }} onClick={e => e.stopPropagation()}>
                  {offer.fields && Object.keys(offer.fields).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                      {Object.entries(offer.fields).map(([key, value]) => {
                        const config = getGameConfig(offer.game_id)
                        const allFields = [...(config.directFields || []), ...(config.helpFields || [])]
                        const fieldDef = allFields.find(f => f.id === key)
                        if (key === 'customGameName') return null
                        return (
                          <div key={key} style={{ padding: '8px 12px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}` }}>
                            <div style={{ fontSize: '11px', color: muted, marginBottom: '2px' }}>{fieldDef?.label || key}</div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{value || '—'}</div>
                          </div>
                        )
                      })}
                      {offer.price > 0 && (
                        <div style={{ padding: '8px 12px', background: '#4caf5011', borderRadius: '8px', border: '1px solid #4caf5033' }}>
                          <div style={{ fontSize: '11px', color: muted, marginBottom: '2px' }}>Asking Price</div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#4caf50' }}>${offer.price}</div>
                        </div>
                      )}
                    </div>
                  )}
                  {offer.message && (
                    <div style={{ padding: '10px 14px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}` }}>
                      <div style={{ fontSize: '11px', color: muted, marginBottom: '4px' }}>Message</div>
                      <div style={{ fontSize: '13px', color: text, lineHeight: 1.6 }}>{offer.message}</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => {
                      fetch(`/api/offers/${offer.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Reviewing', priority: offer.priority }) })
                      handleStatusUpdate(offer.id, 'Reviewing')
                    }}
                      style={{ padding: '7px 14px', background: '#e8a02022', color: '#e8a020', border: '1px solid #e8a02044', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                      Mark Reviewing
                    </button>
                    <button onClick={() => { setEmailOffer(offer); setShowEmailModal(true) }}
                      style={{ padding: '7px 14px', background: '#7E655122', color: '#7E6551', border: '1px solid #7E655144', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Mail size={12} /> Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showEmailModal && emailOffer && (
        <EmailModal
          offer={emailOffer}
          onClose={() => { setShowEmailModal(false); setEmailOffer(null) }}
          onStatusUpdate={handleStatusUpdate}
          darkMode={darkMode} card={card} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
        />
      )}

      {showConfigModal && configuringGame && (
        <OffersConfigModal
          game={configuringGame} configData={configData} setConfigData={setConfigData}
          configTab={configTab} setConfigTab={setConfigTab}
          onSave={handleSaveConfig} onClose={() => setShowConfigModal(false)}
          card={card} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
        />
      )}
    </div>
  )
}
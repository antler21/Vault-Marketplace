'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, Send, Check, AlertCircle, Video, Info } from 'lucide-react'

export default function BuyPage() {
  const [games, setGames] = useState([])
  const [gameConfigs, setGameConfigs] = useState([])
  const [activeTab, setActiveTab] = useState('direct')
  const [selectedGameId, setSelectedGameId] = useState('')
  const [fields, setFields] = useState({})
  const [price, setPrice] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactDiscord, setContactDiscord] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [tooltipVisible, setTooltipVisible] = useState({})

  useEffect(() => {
    fetch('/api/games').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setGames(data)
    })
    fetch('/api/game-configs').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setGameConfigs(data)
    })
  }, [])

  const getConfig = (gameId, section) => {
    const config = gameConfigs.find(c => c.game_id === gameId && c.section === 'offers')
    return config?.config || null
  }

  const directGames = games.filter(g => (g.sections || []).includes('offers'))
  const helpGames = games.filter(g => (g.sections || []).includes('offers'))

  const currentGames = activeTab === 'direct' ? directGames : helpGames

  const selectedGame = games.find(g => g.id === selectedGameId)
  const selectedConfig = selectedGameId ? getConfig(selectedGameId, 'offers') : null
  const currentFields = selectedConfig
    ? (activeTab === 'direct' ? selectedConfig.directFields : selectedConfig.helpFields) || []
    : []

  const handleGameChange = (gameId) => {
    setSelectedGameId(gameId)
    setFields({})
    setError('')
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSelectedGameId('')
    setFields({})
    setError('')
  }

  const applyPriorityRules = (gameId, submittedFields, submittedPrice) => {
    const config = getConfig(gameId, 'offers')
    if (!config || !(config.priorityRules || []).length) return 'Normal'
    for (const rule of config.priorityRules) {
      let fieldValue = rule.field === 'price' ? parseFloat(submittedPrice) : parseFloat(submittedFields[rule.field] || 0)
      if (isNaN(fieldValue)) continue
      const ruleValue = parseFloat(rule.value)
      let matches = false
      switch (rule.operator) {
        case '>=': matches = fieldValue >= ruleValue; break
        case '<=': matches = fieldValue <= ruleValue; break
        case '>': matches = fieldValue > ruleValue; break
        case '<': matches = fieldValue < ruleValue; break
        case '=': matches = fieldValue === ruleValue; break
      }
      if (matches) return rule.priority
    }
    return 'Normal'
  }

  const handleSubmit = async () => {
    if (!selectedGameId && !fields['customGameName']) { setError('Please select a game or enter a game name'); return }
    if (!contactEmail && !contactDiscord) { setError('Please provide at least one contact method (email or Discord)'); return }
    setSubmitting(true)
    setError('')
    try {
      const gameId = (!selectedGameId || selectedGameId === 'custom') ? null : selectedGameId
      const gameName = selectedGame?.name || fields['customGameName'] || 'Custom / Other'
      const priority = gameId ? applyPriorityRules(gameId, fields, price) : 'Normal'
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId, gameName, offerType: activeTab,
          fields, price: parseFloat(price) || 0,
          contactEmail, contactDiscord, message, priority,
        }),
      })
      const data = await res.json()
      if (data.error) { setError('Failed to submit. Please try again.'); return }
      setSubmitted(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const cream = '#FDF4DC'
  const brown = '#7E6551'
  const dark = '#151515'
  const border = '#e8d9b8'
  const muted = '#9a7e6a'
  const card = '#fff'
  const sectionBg = '#f9f4ea'

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '20px', padding: '48px 40px', maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', background: '#4caf5022', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Check size={28} color="#4caf50" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: dark, marginBottom: '10px' }}>Offer Submitted!</div>
          <div style={{ fontSize: '14px', color: muted, lineHeight: 1.6, marginBottom: '28px' }}>
            Thanks for reaching out. We'll review your offer and get back to you via your provided contact details.
          </div>
          <button onClick={() => { setSubmitted(false); setFields({}); setPrice(''); setContactEmail(''); setContactDiscord(''); setMessage(''); setSelectedGameId('') }}
            style={{ padding: '12px 28px', background: brown, color: cream, border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Submit Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: cream, padding: '40px 20px' }}>
      <div style={{ maxWidth: '580px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: dark, marginBottom: '8px' }}>Sell Your Account</div>
          <div style={{ fontSize: '15px', color: muted }}>Choose how you'd like to proceed below</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px' }}>
          <button onClick={() => handleTabChange('direct')}
            style={{ padding: '16px', borderRadius: '12px', border: `2px solid ${activeTab === 'direct' ? brown : border}`, background: activeTab === 'direct' ? brown + '15' : card, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: activeTab === 'direct' ? brown : dark, marginBottom: '4px' }}>💰 Sell Directly</div>
            <div style={{ fontSize: '12px', color: muted, lineHeight: 1.5 }}>I want to sell my account directly. You'll review my offer and contact me.</div>
          </button>
          <button onClick={() => handleTabChange('help')}
            style={{ padding: '16px', borderRadius: '12px', border: `2px solid ${activeTab === 'help' ? brown : border}`, background: activeTab === 'help' ? brown + '15' : card, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: activeTab === 'help' ? brown : dark, marginBottom: '4px' }}>🤝 Need Help Selling</div>
            <div style={{ fontSize: '12px', color: muted, lineHeight: 1.5 }}>I need help finding a buyer. Submit your account and we'll assist you.</div>
          </button>
        </div>

        {/* Info Banner */}
        <div style={{ padding: '12px 16px', background: brown + '11', border: `1px solid ${brown}33`, borderRadius: '10px', marginBottom: '24px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <Info size={15} color={brown} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ fontSize: '13px', color: brown, lineHeight: 1.6 }}>
            {activeTab === 'direct'
              ? 'We are actively buying accounts for specific games listed below. Fill in your account details and we\'ll make you an offer.'
              : 'Not sure if we\'re buying your game? Submit anyway — we\'ll help you find the right buyer or sell it on your behalf.'}
          </div>
        </div>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Game Selector */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '500', color: dark, display: 'block', marginBottom: '8px' }}>
              {activeTab === 'direct' ? 'Which game are you selling?' : 'Which game is your account for?'}
            </label>
            <div style={{ position: 'relative' }}>
              <select value={selectedGameId} onChange={e => handleGameChange(e.target.value)}
                style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', border: `1px solid ${border}`, background: sectionBg, color: selectedGameId ? dark : muted, fontSize: '14px', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
                <option value="">— Select a game —</option>
                {currentGames.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                {activeTab === 'help' && <option value="custom">Custom / Other Game</option>}
              </select>
              <ChevronDown size={16} color={muted} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Custom game name for Help tab */}
          {activeTab === 'help' && selectedGameId === 'custom' && (
            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', color: dark, display: 'block', marginBottom: '8px' }}>Game Name</label>
              <input value={fields['customGameName'] || ''} onChange={e => setFields(prev => ({ ...prev, customGameName: e.target.value }))}
                placeholder="Enter the game name"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${border}`, background: sectionBg, color: dark, fontSize: '14px', outline: 'none' }} />
            </div>
          )}

          {/* Dynamic Fields */}
          {currentFields.map(field => (
            <div key={field.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: dark }}>{field.label}</label>
                {field.tooltip && (
                  <div style={{ position: 'relative' }}>
                    <button
                      onMouseEnter={() => setTooltipVisible(prev => ({ ...prev, [field.id]: true }))}
                      onMouseLeave={() => setTooltipVisible(prev => ({ ...prev, [field.id]: false }))}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                      <Info size={14} color={muted} />
                    </button>
                    {tooltipVisible[field.id] && (
                      <div style={{ position: 'absolute', left: '50%', bottom: '24px', transform: 'translateX(-50%)', background: dark, color: cream, fontSize: '12px', padding: '8px 12px', borderRadius: '8px', whiteSpace: 'nowrap', zIndex: 50, maxWidth: '220px', whiteSpace: 'normal', lineHeight: 1.5 }}>
                        {field.tooltip}
                      </div>
                    )}
                  </div>
                )}
                {field.videoUrl && (
                  <a href={field.videoUrl} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2196f3', textDecoration: 'none' }}>
                    <Video size={12} /> Watch guide
                  </a>
                )}
              </div>
              {field.type === 'Dropdown' ? (
                <div style={{ position: 'relative' }}>
                  <select value={fields[field.id] || ''} onChange={e => setFields(prev => ({ ...prev, [field.id]: e.target.value }))}
                    style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', border: `1px solid ${border}`, background: sectionBg, color: fields[field.id] ? dark : muted, fontSize: '14px', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
                    <option value="">— Select {field.label} —</option>
                    {(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                  </select>
                  <ChevronDown size={16} color={muted} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              ) : field.type === 'Checkbox' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div onClick={() => setFields(prev => ({ ...prev, [field.id]: fields[field.id] === 'true' ? 'false' : 'true' }))}
                    style={{ width: '44px', height: '24px', borderRadius: '12px', background: fields[field.id] === 'true' ? brown : border, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: '4px', left: fields[field.id] === 'true' ? '24px' : '4px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </div>
                  <span style={{ fontSize: '14px', color: dark }}>{fields[field.id] === 'true' ? 'Yes' : 'No'}</span>
                </div>
              ) : field.type === 'Number' ? (
                <input type="number" value={fields[field.id] || ''} onChange={e => setFields(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${border}`, background: sectionBg, color: dark, fontSize: '14px', outline: 'none' }} />
              ) : (
                <input type="text" value={fields[field.id] || ''} onChange={e => setFields(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${border}`, background: sectionBg, color: dark, fontSize: '14px', outline: 'none' }} />
              )}
            </div>
          ))}

          {/* Price */}
          {(selectedGameId || activeTab === 'help') && (
            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', color: dark, display: 'block', marginBottom: '8px' }}>
                {activeTab === 'direct' ? 'Your Asking Price (USD)' : 'Your Price / What you\'re looking for (USD)'}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: muted }}>$</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '12px 14px 12px 28px', borderRadius: '10px', border: `1px solid ${border}`, background: sectionBg, color: dark, fontSize: '14px', outline: 'none' }} />
              </div>
            </div>
          )}

          {/* Message */}
          {(selectedGameId || (activeTab === 'help' && selectedGameId)) && (
            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', color: dark, display: 'block', marginBottom: '8px' }}>Additional Message <span style={{ color: muted, fontWeight: '400' }}>(optional)</span></label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Any additional details about your account..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${border}`, background: sectionBg, color: dark, fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          )}

          {/* Contact */}
          <div style={{ background: sectionBg, borderRadius: '12px', padding: '16px', border: `1px solid ${border}` }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: dark, marginBottom: '12px' }}>Contact Details <span style={{ color: muted, fontWeight: '400', fontSize: '12px' }}>— at least one required</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '5px' }}>Email Address</label>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="your@email.com"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${border}`, background: card, color: dark, fontSize: '13px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '5px' }}>Discord Username</label>
                <input type="text" value={contactDiscord} onChange={e => setContactDiscord(e.target.value)} placeholder="username#0000 or @username"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${border}`, background: card, color: dark, fontSize: '13px', outline: 'none' }} />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: '#e0525211', border: '1px solid #e0525233', borderRadius: '8px' }}>
              <AlertCircle size={14} color="#e05252" />
              <span style={{ fontSize: '13px', color: '#e05252' }}>{error}</span>
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting}
            style={{ width: '100%', padding: '14px', background: submitting ? muted : brown, color: cream, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' }}>
            <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Offer'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: muted }}>
          We'll review your submission and respond within 24-48 hours
        </div>
      </div>
    </div>
  )
}
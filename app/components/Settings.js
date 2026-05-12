'use client'
import { useState } from 'react'
import { User, RefreshCw, LayoutDashboard, Moon, Sun, Check } from 'lucide-react'

const REFRESH_INTERVALS = [
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '60 minutes', value: 60 },
]

const DATE_PRESETS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
]

const CURRENCIES = [
  { symbol: '$', label: 'USD' },
  { symbol: '€', label: 'EUR' },
  { symbol: '£', label: 'GBP' },
  { symbol: '₱', label: 'PHP' },
  { symbol: 'S$', label: 'SGD' },
  { symbol: 'A$', label: 'AUD' },
  { symbol: 'C$', label: 'CAD' },
  { symbol: '¥', label: 'JPY' },
  { symbol: '₩', label: 'KRW' },
  { symbol: 'R$', label: 'BRL' },
  { symbol: 'MYR', label: 'MYR' },
  { symbol: '฿', label: 'THB' },
]

export default function Settings({ darkMode, setDarkMode, currency, setCurrency, autoRefreshInterval, setAutoRefreshInterval, profileName, setProfileName, defaultDateFilter, setDefaultDateFilter }) {
  const [localName, setLocalName] = useState(profileName || 'Admin')
  const [saved, setSaved] = useState(false)

  const card = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text = darkMode ? '#FDF4DC' : '#151515'
  const muted = darkMode ? '#a08570' : '#7E6551'
  const bg = darkMode ? '#151515' : '#FDF4DC'
  const inputBg = darkMode ? '#2a2a2a' : '#fff'
  const sectionBg = darkMode ? '#252525' : '#f9f4ea'

  const handleSave = () => {
    setProfileName(localName)
    localStorage.setItem('profileName', localName)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Section = ({ icon: Icon, title, children }) => (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icon size={16} color={muted} />
        <span style={{ fontSize: '14px', fontWeight: '600', color: text }}>{title}</span>
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  )

  const Row = ({ label, sub, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${border}` }}>
      <div>
        <div style={{ fontSize: '14px', color: text }}>{label}</div>
        {sub && <div style={{ fontSize: '12px', color: muted, marginTop: '2px' }}>{sub}</div>}
      </div>
      <div>{children}</div>
    </div>
  )

  const Toggle = ({ value, onChange }) => (
    <div onClick={onChange}
      style={{ width: '40px', height: '22px', borderRadius: '11px', cursor: 'pointer', background: value ? '#7E6551' : border, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '3px', left: value ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </div>
  )

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset', maxWidth: '680px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Settings</h1>
        <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>Manage your preferences</p>
      </div>

      {/* General */}
      <Section icon={User} title="General">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div style={{ paddingBottom: '16px', borderBottom: `1px solid ${border}`, marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '8px' }}>Profile Name</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                placeholder="Admin"
                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '14px', outline: 'none' }}
              />
              <button onClick={handleSave}
                style={{ padding: '10px 18px', background: saved ? '#4caf50' : '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.2s' }}>
                {saved ? <><Check size={14} /> Saved!</> : 'Save'}
              </button>
            </div>
          </div>

          <div style={{ paddingBottom: '16px', borderBottom: `1px solid ${border}`, marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '8px' }}>Display Currency</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CURRENCIES.map(c => (
                <button key={c.symbol} onClick={() => { setCurrency(c.symbol); localStorage.setItem('currency', c.symbol) }}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${currency === c.symbol ? '#7E6551' : border}`, background: currency === c.symbol ? '#7E6551' : 'transparent', color: currency === c.symbol ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', fontWeight: currency === c.symbol ? '500' : '400' }}>
                  {c.symbol} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', color: text }}>Dark Mode</div>
                <div style={{ fontSize: '12px', color: muted, marginTop: '2px' }}>Switch between light and dark theme</div>
              </div>
              <Toggle value={darkMode} onChange={() => setDarkMode(!darkMode)} />
            </div>
          </div>
        </div>
      </Section>

      {/* Orders */}
      <Section icon={RefreshCw} title="Orders & Auto-refresh">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div style={{ paddingBottom: '16px', borderBottom: `1px solid ${border}`, marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '8px' }}>Auto-refresh Interval</label>
            <div style={{ fontSize: '12px', color: muted, marginBottom: '10px' }}>How often to automatically check for new orders when auto-refresh is enabled</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {REFRESH_INTERVALS.map(interval => (
                <button key={interval.value} onClick={() => { setAutoRefreshInterval(interval.value); localStorage.setItem('autoRefreshInterval', String(interval.value)) }}
                  style={{ padding: '7px 16px', borderRadius: '20px', border: `1px solid ${autoRefreshInterval === interval.value ? '#7E6551' : border}`, background: autoRefreshInterval === interval.value ? '#7E6551' : 'transparent', color: autoRefreshInterval === interval.value ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', fontWeight: autoRefreshInterval === interval.value ? '500' : '400' }}>
                  {interval.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '12px 14px', background: sectionBg, borderRadius: '8px', fontSize: '12px', color: muted }}>
            💡 You can toggle auto-refresh on/off from the Orders page. The interval set here applies globally.
          </div>
        </div>
      </Section>

      {/* Dashboard */}
      <Section icon={LayoutDashboard} title="Dashboard">
        <div>
          <label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '8px' }}>Default Date Filter</label>
          <div style={{ fontSize: '12px', color: muted, marginBottom: '10px' }}>The date range shown by default when you open the Dashboard</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {DATE_PRESETS.map(preset => (
              <button key={preset.value} onClick={() => { setDefaultDateFilter(preset.value); localStorage.setItem('defaultDateFilter', preset.value) }}
                style={{ padding: '7px 16px', borderRadius: '20px', border: `1px solid ${defaultDateFilter === preset.value ? '#7E6551' : border}`, background: defaultDateFilter === preset.value ? '#7E6551' : 'transparent', color: defaultDateFilter === preset.value ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', fontWeight: defaultDateFilter === preset.value ? '500' : '400' }}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

    </div>
  )
}
'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { ArrowLeft, Flag, ExternalLink, Check, X, Gamepad2, ChevronDown, ChevronUp, Eye, EyeOff, Copy, Play, Settings, GripVertical, Crosshair, Pencil } from 'lucide-react'

const scrollbarStyle = `
  .posting-scroll::-webkit-scrollbar { width: 6px; }
  .posting-scroll::-webkit-scrollbar-track { background: transparent; }
  .posting-scroll::-webkit-scrollbar-thumb { background: #7E655166; border-radius: 10px; }
  .posting-scroll::-webkit-scrollbar-thumb:hover { background: #7E6551aa; }
`

const POSTING_TABS = [
  { key: 'accounts', label: 'Accounts',       emoji: '🎮' },
  { key: 'gacha',    label: 'Gacha Accounts', emoji: '🎰' },
  { key: 'services', label: 'Services',        emoji: '⚡' },
]

export default function Posting({ darkMode, accounts, games, gameConfigs, platforms, updateAccount, saveGameConfig }) {
  const [activeTab, setActiveTab]               = useState('accounts')
  const [selectedGame, setSelectedGame]         = useState(null)
  const [expandedAccount, setExpandedAccount]   = useState(null)
  const [expandedSheet, setExpandedSheet]       = useState(null)
  const [showPosted, setShowPosted]             = useState(false)
  const [scriptStatus, setScriptStatus]         = useState({})
  const [copiedKey, setCopiedKey]               = useState(null)
  const [manualValues, setManualValues]         = useState({})
  const [editingSheetKey, setEditingSheetKey]   = useState(null) // `${accountId}_${platformName}_${fieldLabel}`

  // Posting config modal
  const [showConfigModal, setShowConfigModal]   = useState(false)
  const [configGame, setConfigGame]             = useState(null)
  const [configPlatformTab, setConfigPlatformTab] = useState(null)
  const [configFields, setConfigFields]         = useState({}) // { [platformId]: { [fieldLabel]: { selector, fillMethod } } }

  const getTemplateUrl = (platform, game) =>
    (platform?.gameTemplates || []).find(t => String(t.gameId) === String(game?.id))?.url || ''
  const [showTestModal, setShowTestModal]         = useState(false)
  const [testSelections, setTestSelections]       = useState({}) // { [fieldLabel]: selectedOptionLabel }

  const card      = darkMode ? '#1e1e1e' : '#fff'
  const border    = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text      = darkMode ? '#FDF4DC' : '#151515'
  const muted     = darkMode ? '#a08570' : '#7E6551'
  const bg        = darkMode ? '#151515' : '#FDF4DC'
  const inputBg   = darkMode ? '#2a2a2a' : '#fff'
  const sectionBg = darkMode ? '#252525' : '#f9f4ea'
  const inputStyle = { width: '100%', padding: '8px 11px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }

  // ── Extension bridge for config modal panel picker ────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.source !== window) return
      const msg = e.data
      if (!msg || !msg.__vaultExtension) return
      if (msg.type === 'VAULT_PANEL_RESULT') {
        const { results, platformId } = msg
        setConfigFields(prev => {
          const platformPrev = prev[platformId] || {}
          const updated = { ...platformPrev }
          for (const [fieldLabel, pick] of Object.entries(results)) {
            updated[fieldLabel] = {
              ...(platformPrev[fieldLabel] || {}),
              selector: pick.selector || platformPrev[fieldLabel]?.selector || '',
              pickType: pick.pickType || platformPrev[fieldLabel]?.pickType || 'text',
              ...(pick.options && Object.keys(pick.options).length > 0 ? { pickedOptions: pick.options } : {}),
            }
          }
          return { ...prev, [platformId]: updated }
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const openPanelPicker = (platform) => {
    const url = getTemplateUrl(platform, configGame)
    if (!url) { alert('Add a Game URL in Platforms → Edit for this game first.'); return }
    const platformCfg = configFields[platform.id] || {}
    const fields = getConfigFields(configGame, platform).map(f => {
      const cfg = platformCfg[f.label] || {}
      return {
        label: f.label,
        source: f.source,
        currentSelector: cfg.selector || null,
        currentPickType: cfg.pickType || null,
        currentOptions: cfg.pickedOptions || null,
      }
    })
    window.postMessage({ __vaultExtension: true, type: 'OPEN_PANEL_PICKER', fields, platformId: platform.id, url }, '*')
  }

  // ── Helpers ───────────────────────────────────────────────────────
  // ── Title Rules ──────────────────────────────────────────────────────────
  const applyTitleRules = (title, rules) => {
    if (!title || !rules) return title || ''
    let t = title
    const emojiRx = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu
    if (rules.noEmojis) {
      t = t.replace(emojiRx, '').replace(/\s+/g, ' ').trim()
    } else if (rules.emojiLimit !== '' && rules.emojiLimit !== undefined) {
      const limit = parseInt(rules.emojiLimit)
      if (!isNaN(limit)) { let c = 0; t = t.replace(emojiRx, m => { c++; return c <= limit ? m : '' }) }
    }
    if (rules.stripSpecial) t = t.replace(/[#@*!$%^&()+=[\]{};':"\|,.<>/?`~]/g, '').replace(/\s+/g, ' ').trim()
    if (rules.maxCaps !== '' && rules.maxCaps !== undefined) {
      const limit = parseInt(rules.maxCaps)
      if (!isNaN(limit)) { let c = 0; t = t.split('').map(ch => { if (ch >= 'A' && ch <= 'Z') { c++; return c <= limit ? ch : ch.toLowerCase() } return ch }).join('') }
    }
    if (rules.charLimit !== '' && rules.charLimit !== undefined) {
      const limit = parseInt(rules.charLimit)
      if (!isNaN(limit) && t.length > limit) t = t.slice(0, limit).trimEnd()
    }
    return t
  }

  const getGameConfig = (gameId) =>
    gameConfigs?.find(c => c.game_id === gameId && c.section === 'accounts')?.config || {}

  const getPostingConfig = (gameId, platformId) =>
    gameConfigs?.find(c => c.game_id === gameId && c.section === `posting_${platformId}`)?.config || {}

  const getThumbnail = (account) => {
    const images = account.images || []
    return images.length ? (images[account.thumbnailIndex || 0]?.url || images[0]?.url || null) : null
  }

  const getSummaryFields = (gameId) => {
    const config = getGameConfig(gameId)
    return (config.summaryFields || []).map(id => (config.customFields || []).find(f => f.id === id)).filter(Boolean)
  }

  const resolveFieldValue = (accountFieldId, account, platform) => {
    if (!accountFieldId) return null
    let value = ''
    if (accountFieldId === '__title') value = account.title || ''
    else if (accountFieldId === '__soldFor') value = `${account.soldFor || 0} ${account.soldForCurrency || 'USD'}`
    else if (accountFieldId === '__boughtFor') value = `${account.boughtFor || 0} ${account.boughtForCurrency || 'USD'}`
    else value = account.fields?.[accountFieldId] ?? ''
    // Apply title rules for title field
    if (accountFieldId === '__title' && platform?.titleRules) {
      value = applyTitleRules(value, platform.titleRules)
    }
    return value
  }

  // Build posting sheet using platform field definitions + per-game-platform selector config
  const checkTitleRules = (title, rules) => {
    if (!title || !rules) return []
    const violations = []
    const emojiRx = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu
    const emojiCount = (title.match(emojiRx) || []).length
    const capsCount = (title.match(/[A-Z]/g) || []).length
    if (rules.noEmojis && emojiCount > 0) violations.push(`No emojis allowed (has ${emojiCount})`)
    if (rules.emojiLimit !== '' && rules.emojiLimit !== undefined && emojiCount > parseInt(rules.emojiLimit)) violations.push(`Max ${rules.emojiLimit} emojis (has ${emojiCount})`)
    if (rules.maxCaps !== '' && rules.maxCaps !== undefined && capsCount > parseInt(rules.maxCaps)) violations.push(`Max ${rules.maxCaps} caps (has ${capsCount})`)
    if (rules.charLimit !== '' && rules.charLimit !== undefined && title.length > parseInt(rules.charLimit)) violations.push(`Max ${rules.charLimit} chars (has ${title.length})`)
    if (rules.stripSpecial && /[#@*!$%^&()+=[\]{};':"\|,.<>/?`~]/.test(title)) violations.push('Special characters not allowed')
    return violations
  }

  const buildPostingSheet = (account, platform) => {
    const gameTemplate = (platform.gameTemplates || []).find(t => t.gameId === account.gameId)
    const postingCfg = getPostingConfig(account.gameId, platform.id)
    const rows = []

    // Always inject title row at the top
    const rawTitle = account.title || ''
    const processedTitle = platform?.titleRules ? applyTitleRules(rawTitle, platform.titleRules) : rawTitle
    const titleViolations = platform?.titleRules ? checkTitleRules(rawTitle, platform.titleRules) : []
    rows.push({
      label: 'Account Title',
      selector: postingCfg['Account Title']?.selector || '',
      fillMethod: postingCfg['Account Title']?.fillMethod || 'Type',
      resolvedValue: processedTitle,
      rawValue: rawTitle,
      isMapped: true,
      isTitle: true,
      source: 'account',
      violations: titleViolations,
    })

    const gameConfig = getGameConfig(account.gameId)

    const addField = (field, source) => {
      // Skip if this field is also mapped to __title (already shown above)
      if (field.accountFieldId === '__title') return
      const cfg = postingCfg[field.label] || {}
      const resolved = field.accountFieldId ? resolveFieldValue(field.accountFieldId, account, platform) : null

      // Get the account custom field definition to find its type and options
      const accountCustomField = (gameConfig.customFields || []).find(f => String(f.id) === String(field.accountFieldId))
      const accountFieldOptions = accountCustomField?.options || []  // options from Dropdown/Radio field
      const accountFieldType = accountCustomField?.type || 'Text'

      rows.push({
        label: field.label,
        selector: cfg.selector || '',
        fillMethod: cfg.fillMethod || field.fillMethod || 'Type',
        resolvedValue: resolved,
        isMapped: !!field.accountFieldId,
        pickType: cfg.pickType || 'text',
        pickedOptions: cfg.pickedOptions || null,  // { label: selector } from extension picker
        accountFieldOptions,   // options from account's custom field definition
        accountFieldType,      // type of the account field (Dropdown, Radio, etc.)
        source,
        violations: [],
      })
    }

    for (const field of (platform.globalFields || [])) addField(field, 'global')
    if (gameTemplate) for (const field of (gameTemplate.fields || [])) addField(field, 'template')

    // Inject HTML template row if the game template has one
    if (gameTemplate?.htmlTemplate) {
      const placeholderMap = gameTemplate.placeholderMap || {}
      // Resolve all placeholders from account data
      const resolvedValues = {}
      Object.entries(placeholderMap).forEach(([placeholder, mapping]) => {
        if (mapping.accountFieldId) {
          resolvedValues[placeholder] = resolveFieldValue(mapping.accountFieldId, account, platform) || ''
        }
      })
      // Render the HTML with resolved values
      const renderTemplate = (html, values) =>
        html.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match)
      const renderedHtml = renderTemplate(gameTemplate.htmlTemplate, resolvedValues)

      rows.push({
        label: 'HTML Description',
        selector: postingCfg['HTML Description']?.selector || '',
        fillMethod: postingCfg['HTML Description']?.fillMethod || 'Type',
        resolvedValue: renderedHtml,
        rawHtml: gameTemplate.htmlTemplate,
        placeholderMap,
        resolvedPlaceholders: resolvedValues,
        isMapped: true,
        isHtml: true,
        source: 'template',
        violations: [],
        accountFieldOptions: [],
        accountFieldType: 'HTML',
        pickType: 'text',
        pickedOptions: null,
      })
    }

    return rows
  }

  // Get all fields for config modal (global + game template, combined)
  const getConfigFields = (game, platform) => {
    const gameTemplate = (platform.gameTemplates || []).find(t => t.gameId === game.id)
    const fields = []
    for (const f of (platform.globalFields || [])) fields.push({ ...f, source: 'Global' })
    if (gameTemplate) for (const f of (gameTemplate.fields || [])) fields.push({ ...f, source: game.name })
    return fields
  }

  const copyToClipboard = async (value, key) => {
    try { await navigator.clipboard.writeText(value); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1500) }
    catch (err) { console.error('Copy failed:', err) }
  }

  const getManualKey = (account, platformName, fieldLabel) => `${account.id}_${platformName}_${fieldLabel}`
  const getFieldValue = (account, platformName, row) => {
    const manual = manualValues[getManualKey(account, platformName, row.label)]
    if (manual !== undefined) return manual  // user override always wins
    if (row.isMapped && row.resolvedValue !== null) return row.resolvedValue
    return ''
  }
  const setManualValue = (account, platformName, fieldLabel, value) =>
    setManualValues(prev => ({ ...prev, [getManualKey(account, platformName, fieldLabel)]: value }))

  // ── Game visibility per tab ───────────────────────────────────────
  const gamesForTab = useMemo(() => {
    const sectionMap = { accounts: ['accounts'], gacha: ['gacha', 'accounts'], services: ['services'] }
    const needed = sectionMap[activeTab] || []
    return games.filter(g => (g.sections || []).some(s => needed.includes(s)))
  }, [games, activeTab])

  const getTabLabel = (game) => {
    const sections = game.sections || []
    if (activeTab === 'accounts') {
      const count = accounts.filter(a => a.gameId === game.id && a.status === 'Available').length
      return `${count} Account${count !== 1 ? 's' : ''}`
    }
    if (activeTab === 'gacha') {
      const acctCount = sections.includes('accounts') ? accounts.filter(a => a.gameId === game.id && a.status === 'Available').length : null
      const gachaConfig = gameConfigs?.find(c => c.game_id === game.id && c.section === 'gacha')?.config
      const gachaCount = (gachaConfig?.groups || []).reduce((s, g) => s + (g.products || []).length, 0)
      const parts = []
      if (acctCount !== null) parts.push(`${acctCount} Account${acctCount !== 1 ? 's' : ''}`)
      parts.push(`${gachaCount} Gacha`)
      return parts.join(' / ')
    }
    if (activeTab === 'services') {
      const svcConfig = gameConfigs?.find(c => c.game_id === game.id && c.section === 'services')?.config
      const count = (svcConfig?.services || []).length
      return `${count} Service${count !== 1 ? 's' : ''} Offered`
    }
    return ''
  }

  // ── For accounts tab: accounts needing posting ────────────────────
  const gameAccounts = useMemo(() => {
    if (!selectedGame) return []
    return accounts
      .filter(a => a.gameId === selectedGame.id && a.status === 'Available' && (a.targetPlatforms || []).length > 0)
      .sort((a, b) => (b.postingPriority || 0) - (a.postingPriority || 0))
  }, [accounts, selectedGame])

  const needsPosting = gameAccounts.filter(a => (a.targetPlatforms || []).some(p => !p.posted))
  const fullyPosted  = gameAccounts.filter(a => (a.targetPlatforms || []).every(p => p.posted) && (a.targetPlatforms || []).length > 0)
  const displayAccounts = showPosted ? [...needsPosting, ...fullyPosted] : needsPosting

  const getGameStats = (gameId) => {
    const accs = accounts.filter(a => a.gameId === gameId && a.status === 'Available' && (a.targetPlatforms || []).length > 0)
    const totalSlots = accs.reduce((s, a) => s + (a.targetPlatforms || []).length, 0)
    const postedSlots = accs.reduce((s, a) => s + (a.targetPlatforms || []).filter(p => p.posted).length, 0)
    return { total: accs.length, pending: accs.filter(a => (a.targetPlatforms || []).some(p => !p.posted)).length, postedSlots, totalSlots, highPriority: accs.filter(a => a.postingPriority === 1).length }
  }

  // ── Actions ───────────────────────────────────────────────────────
  const markPosted = async (account, platformName, posted) => {
    const newTargets = (account.targetPlatforms || []).map(p => p.platformName === platformName ? { ...p, posted } : p)
    await updateAccount({ ...account, targetPlatforms: newTargets })
  }
  const markAllPosted   = async (account) => await updateAccount({ ...account, targetPlatforms: (account.targetPlatforms || []).map(p => ({ ...p, posted: true })) })
  const markAllUnposted = async (account) => await updateAccount({ ...account, targetPlatforms: (account.targetPlatforms || []).map(p => ({ ...p, posted: false })) })

  const launchScript = async (account, platformName, platform, sheetRows) => {
    const gameConfig = getGameConfig(account.gameId)
    const scriptUrl = gameConfig.scriptUrl
    if (!scriptUrl) return
    const key = `${account.id}_${platformName}`
    setScriptStatus(prev => ({ ...prev, [key]: 'running' }))
    try {
      if (platform?.url) {
        const url = platform.url.match(/^https?:\/\//) ? platform.url : `https://${platform.url}`
        window.open(url, '_blank')
      }
      const fields = {}
      for (const row of sheetRows) fields[row.label] = getFieldValue(account, platformName, row)
      const payload = {
        accountId: account.id, title: account.title || '', platform: platformName, fields,
        // selectors: CSS selector or '__text__:Value' for text-based matching
        // Script should handle __text__: by finding element where textContent === Value
        selectors: Object.fromEntries(sheetRows.map(r => [r.label, r.selector])),
        fillMethods: Object.fromEntries(sheetRows.map(r => [r.label, r.fillMethod])),
        images: (account.images || []).map(img => img.url).filter(Boolean),
        price: account.soldFor || 0, currency: account.soldForCurrency || 'USD',
      }
      const res = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        setScriptStatus(prev => ({ ...prev, [key]: 'done' }))
        await markPosted(account, platformName, true)
        setTimeout(() => setScriptStatus(prev => { const n = { ...prev }; delete n[key]; return n }), 3000)
      } else {
        setScriptStatus(prev => ({ ...prev, [key]: 'error' }))
        setTimeout(() => setScriptStatus(prev => { const n = { ...prev }; delete n[key]; return n }), 4000)
      }
    } catch (err) {
      console.error('Script launch error:', err)
      setScriptStatus(prev => ({ ...prev, [key]: 'error' }))
      setTimeout(() => setScriptStatus(prev => { const n = { ...prev }; delete n[key]; return n }), 4000)
    }
  }

  // ── Posting Config Modal ──────────────────────────────────────────
  const openConfigModal = (game) => {
    setConfigGame(game)
    const allowedPlatforms = getAllowedPlatforms(game)
    const loaded = {}
    for (const p of allowedPlatforms) {
      loaded[p.id] = getPostingConfig(game.id, p.id)
    }
    setConfigFields(loaded)
    setConfigPlatformTab(allowedPlatforms[0]?.id || null)
    setShowConfigModal(true)
  }

  const saveConfigModal = async () => {
    const allowedPlatforms = getAllowedPlatforms(configGame)
    for (const p of allowedPlatforms) {
      await saveGameConfig(configGame.id, `posting_${p.id}`, configFields[p.id] || {})
    }
    setShowConfigModal(false)
  }

  const getAllowedPlatforms = (game) => {
    if (!game) return []
    const ids = game.allowedPlatformIds || []
    return ids.length > 0 ? platforms.filter(p => ids.includes(p.id)) : platforms
  }

  const isPostingConfigured = (game) => {
    const allowedPlatforms = getAllowedPlatforms(game)
    return allowedPlatforms.some(p => {
      const cfg = getPostingConfig(game.id, p.id)
      return Object.keys(cfg).filter(k => k !== '__gameUrl').length > 0
    })
  }

  const scriptUrl = selectedGame ? getGameConfig(selectedGame.id).scriptUrl || '' : ''

  // ── VIEW 1: Game Grid + Sub-tabs ──────────────────────────────────
  if (!selectedGame) {
    return (
      <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
        <style>{scrollbarStyle}</style>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Posting</h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>Manage and launch posts across all games and platforms</p>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
          {POSTING_TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: activeTab === tab.key ? '#7E6551' : 'transparent', color: activeTab === tab.key ? '#FDF4DC' : muted, fontSize: '13px', fontWeight: activeTab === tab.key ? '600' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { if (activeTab !== tab.key) { e.currentTarget.style.background = '#7E655122'; e.currentTarget.style.color = '#7E6551' } }}
              onMouseLeave={e => { if (activeTab !== tab.key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = darkMode ? '#a08570' : '#7E6551' } }}>
              <span style={{ fontSize: '15px' }}>{tab.emoji}</span> {tab.label}
            </button>
          ))}
        </div>

        {gamesForTab.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
            <span style={{ fontSize: '48px', marginBottom: '16px' }}>{POSTING_TABS.find(t => t.key === activeTab)?.emoji}</span>
            <div style={{ fontSize: '17px', fontWeight: '600', color: text, marginBottom: '8px' }}>No games in this tab</div>
            <div style={{ fontSize: '13px', color: muted }}>Go to Games and enable the {POSTING_TABS.find(t => t.key === activeTab)?.label} section for a game.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {gamesForTab.map(game => {
              const stats = getGameStats(game.id)
              const configured = isPostingConfigured(game)
              const scriptUrl = getGameConfig(game.id).scriptUrl || ''
              const progress = stats.totalSlots > 0 ? Math.round((stats.postedSlots / stats.totalSlots) * 100) : 0

              return (
                <div key={game.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100px', background: game.image ? `url(${game.image}) center/cover no-repeat` : '#7E655122', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}
                    onClick={() => setSelectedGame(game)}>
                    {!game.image && <Gamepad2 size={32} color="#7E6551" />}
                    {stats.highPriority > 0 && (
                      <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#e8a020', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', color: '#fff', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Flag size={9} /> {stats.highPriority} HIGH
                      </div>
                    )}
                    {scriptUrl && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', color: '#4caf50' }}>⚡ Script</div>
                    )}
                  </div>
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: text, cursor: 'pointer' }} onClick={() => setSelectedGame(game)}>{game.name}</div>
                      <button onClick={() => openConfigModal(game)} title="Configure posting selectors"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', border: `1px solid ${configured ? '#7E6551' : border}`, background: configured ? '#7E655115' : 'transparent', color: configured ? '#7E6551' : muted, fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>
                        <Settings size={11} /> {configured ? 'Configured' : 'Configure'}
                      </button>
                    </div>
                    <div style={{ fontSize: '12px', color: muted, marginBottom: '10px' }}>{getTabLabel(game)}</div>
                    {activeTab === 'accounts' && (
                      <>
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', color: muted }}>Posting progress</span>
                            <span style={{ fontSize: '11px', color: progress === 100 ? '#4caf50' : text, fontWeight: '500' }}>{progress}%</span>
                          </div>
                          <div style={{ height: '5px', background: border, borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#4caf50' : '#7E6551', borderRadius: '3px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div style={{ padding: '8px 10px', background: sectionBg, borderRadius: '8px', textAlign: 'center', cursor: 'pointer' }} onClick={() => setSelectedGame(game)}>
                            <div style={{ fontSize: '18px', fontWeight: '600', color: stats.pending > 0 ? '#e8a020' : '#4caf50' }}>{stats.pending}</div>
                            <div style={{ fontSize: '11px', color: muted }}>Need posting</div>
                          </div>
                          <div style={{ padding: '8px 10px', background: sectionBg, borderRadius: '8px', textAlign: 'center', cursor: 'pointer' }} onClick={() => setSelectedGame(game)}>
                            <div style={{ fontSize: '18px', fontWeight: '600', color: text }}>{stats.total}</div>
                            <div style={{ fontSize: '11px', color: muted }}>Total accounts</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Posting Config Modal ── */}
        {showConfigModal && configGame && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
            <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '600px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>⚙️ Posting Config — {configGame.name}</h2>
                  <button onClick={() => setShowConfigModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
                </div>
                <p style={{ fontSize: '12px', color: muted, marginTop: '4px' }}>Configure CSS selectors for each field per platform. These are used by the auto-fill script.</p>
                {/* Platform sub-tabs */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {getAllowedPlatforms(configGame).map(p => (
                    <button key={p.id} onClick={() => setConfigPlatformTab(p.id)}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: configPlatformTab === p.id ? '#7E6551' : sectionBg, color: configPlatformTab === p.id ? '#FDF4DC' : muted, fontWeight: configPlatformTab === p.id ? '500' : '400' }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(() => {
                  const platform = platforms.find(p => p.id === configPlatformTab)
                  if (!platform) return <div style={{ fontSize: '13px', color: muted }}>No platform selected.</div>
                  const fields = getConfigFields(configGame, platform)
                  if (fields.length === 0) return (
                    <div style={{ fontSize: '13px', color: muted, padding: '20px', textAlign: 'center' }}>
                      No fields configured for {platform.name}.<br />
                      <span style={{ fontSize: '12px' }}>Go to Platforms → Edit → add Global Fields or Game Templates first.</span>
                    </div>
                  )

                  const platformCfg = configFields[platform.id] || {}

                  return (
                    <>
                      {/* Field rows */}
                      {fields.map(field => {
                        const fieldCfg = platformCfg[field.label] || {}
                        const FILL_METHODS = ['Type Text', 'Select Option', 'Click']
                        const PICK_LABELS = { text: '📝 Text', dropdown: '📋 Dropdown', radio: '🔘 Radio', checkbox: '☑️ Checkbox', richtext: '✍️ Rich Text' }

                        return (
                          <div key={field.label} style={{ background: sectionBg, borderRadius: '10px', padding: '12px', border: `1px solid ${border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{field.label}</span>
                                <span style={{ fontSize: '11px', color: muted }}>({field.source})</span>
                                {field.accountFieldId && <span style={{ fontSize: '11px', color: '#4caf50' }}>● auto-mapped</span>}
                                {fieldCfg.pickType && (
                                  <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '8px', background: '#7E655115', color: '#7E6551', border: '1px solid #7E655133' }}>
                                    {PICK_LABELS[fieldCfg.pickType] || fieldCfg.pickType}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  value={fieldCfg.selector || ''}
                                  onChange={e => setConfigFields(prev => ({ ...prev, [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), selector: e.target.value } } }))}
                                  placeholder={fieldCfg.selector ? '' : 'CSS Selector — use 🎯 Pick to configure'}
                                  style={inputStyle}
                                />
                                <select
                                  value={fieldCfg.pickType || 'text'}
                                  onChange={e => setConfigFields(prev => ({ ...prev, [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), pickType: e.target.value } } }))}
                                  style={{ padding: '0 4px', height: '36px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: muted, fontSize: '11px', cursor: 'pointer', outline: 'none', flexShrink: 0 }}>
                                  {[{v:'text',l:'📝 Text'},{v:'dropdown',l:'📋 Dropdown'},{v:'radio',l:'🔘 Radio'},{v:'checkbox',l:'☑️ Checkbox'},{v:'richtext',l:'✍️ Rich Text'}].map(t => (
                                    <option key={t.v} value={t.v}>{t.l}</option>
                                  ))}
                                </select>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {FILL_METHODS.map(m => (
                                  <button key={m}
                                    onClick={() => setConfigFields(prev => ({ ...prev, [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), fillMethod: m } } }))}
                                    style={{ flex: 1, padding: '5px', borderRadius: '7px', border: `1px solid ${(fieldCfg.fillMethod || 'Type') === m ? '#7E6551' : border}`, background: (fieldCfg.fillMethod || 'Type') === m ? '#7E655115' : 'transparent', color: (fieldCfg.fillMethod || 'Type') === m ? '#7E6551' : muted, fontSize: '11px', cursor: 'pointer' }}>
                                    {m}
                                  </button>
                                ))}
                              </div>

                              {/* ── Value mapping (dropdown / radio) ── */}
                              {(() => {
                                const hasScraped = (fieldCfg.scrapedOptions?.length > 0)
                                const hasPicked  = fieldCfg.pickedOptions && Object.keys(fieldCfg.pickedOptions).length > 0
                                if (!hasScraped && !hasPicked) return null
                                const gameConfig  = configGame ? getGameConfig(configGame.id) : {}
                                const customField = (gameConfig.customFields || []).find(cf => cf.id === field.accountFieldId)
                                const appOptions  = customField?.options || []
                                const platformOpts = hasScraped
                                  ? fieldCfg.scrapedOptions.map(o => o.value || o.label)
                                  : Object.keys(fieldCfg.pickedOptions)
                                const valueMap = fieldCfg.valueMap || {}
                                return (
                                  <div>
                                    {appOptions.length > 0 && (
                                      <div style={{ background: '#e8a02008', border: `1px solid #e8a02033`, borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
                                        <div style={{ fontSize: '11px', color: '#e8a020', fontWeight: '500', marginBottom: '8px' }}>⚡ Value Mapping — match your values to platform values</div>
                                        {appOptions.map(appVal => (
                                          <div key={appVal} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                                            <span style={{ fontSize: '11px', color: text, minWidth: '80px', flexShrink: 0, background: sectionBg, padding: '3px 7px', borderRadius: '5px', border: `1px solid ${border}` }}>{appVal}</span>
                                            <span style={{ fontSize: '11px', color: muted }}>→</span>
                                            <select value={valueMap[appVal] || ''}
                                              onChange={e => setConfigFields(prev => ({
                                                ...prev,
                                                [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), valueMap: { ...(prev[platform.id]?.[field.label]?.valueMap || {}), [appVal]: e.target.value } } }
                                              }))}
                                              style={{ flex: 1, padding: '3px 7px', borderRadius: '5px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '11px', outline: 'none' }}>
                                              <option value="">— not mapped —</option>
                                              {platformOpts.map(pv => <option key={pv} value={pv}>{pv}</option>)}
                                            </select>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {hasPicked && (
                                      <div style={{ background: '#2196f308', border: `1px solid #2196f333`, borderRadius: '8px', padding: '10px' }}>
                                        <div style={{ fontSize: '11px', color: '#2196f3', fontWeight: '500', marginBottom: '6px' }}>🔘 Option selectors picked <span style={{ color: muted, fontWeight: 400 }}>— names are editable</span></div>
                                        {Object.entries(fieldCfg.pickedOptions).map(([lbl, sel]) => (
                                          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <input
                                              defaultValue={lbl}
                                              onBlur={e => {
                                                const newLbl = e.target.value.trim()
                                                if (!newLbl || newLbl === lbl) return
                                                const newOpts = {}
                                                for (const [k, v] of Object.entries(fieldCfg.pickedOptions)) newOpts[k === lbl ? newLbl : k] = v
                                                setConfigFields(prev => ({ ...prev, [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), pickedOptions: newOpts } } }))
                                              }}
                                              style={{ fontSize: '11px', color: text, minWidth: '80px', flexShrink: 0, background: inputBg, border: `1px solid ${border}`, borderRadius: '5px', padding: '2px 6px', outline: 'none', width: '100px' }}
                                            />
                                            <code style={{ fontSize: '10px', color: '#2196f3', background: '#2196f311', padding: '2px 6px', borderRadius: '4px', flex: 1, wordBreak: 'break-all' }}>{sel}</code>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )
                })()}
              </div>

              <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowTestModal(true)}
                    style={{ flex: 1, padding: '11px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                    🧪 Test
                  </button>
                  <button onClick={() => { const p = platforms.find(p => p.id === configPlatformTab); if (p) openPanelPicker(p) }}
                    style={{ flex: 1, padding: '11px', background: 'transparent', color: '#7E6551', border: `1px solid #7E6551`, borderRadius: '10px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                    🎯 Pick
                  </button>
                  <button onClick={saveConfigModal}
                    style={{ flex: 2, padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Test Modal ── */}
        {showTestModal && configGame && (() => {
          const platform = platforms.find(p => p.id === configPlatformTab)
          if (!platform) return null
          const fields = getConfigFields(configGame, platform)
          const platformCfg = configFields[platform.id] || {}
          const gameConfig = getGameConfig(configGame.id)
          const url = getTemplateUrl(platform, configGame) || platform.url || ''
          const finalUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
          const BUILTIN_MAP = { '__title': 'Account Title', '__soldFor': 'Selling Price', '__boughtFor': 'Cost Price' }

          const testRows = fields.map(field => {
            const cfg = platformCfg[field.label] || {}
            const mappedLabel = (() => {
              if (!field.accountFieldId) return null
              if (BUILTIN_MAP[field.accountFieldId]) return BUILTIN_MAP[field.accountFieldId]
              const custom = (gameConfig.customFields || []).find(f => String(f.id) === String(field.accountFieldId))
              return custom?.label || 'mapped'
            })()
            const isMulti = cfg.pickType === 'radio' || cfg.pickType === 'checkbox' || cfg.pickType === 'dropdown'
            const options = isMulti && cfg.pickedOptions ? Object.keys(cfg.pickedOptions) : []
            return {
              label: field.label, source: field.source,
              selector: cfg.selector || '',
              triggerSelector: cfg.selector || '',
              pickType: cfg.pickType || 'text',
              fillMethod: cfg.fillMethod || 'Type Text',
              pickedOptions: cfg.pickedOptions || null,
              scrapedOptions: cfg.scrapedOptions || null,
              valueMap: cfg.valueMap || {},
              mappedTo: mappedLabel, isMulti, options
            }
          }).filter(row => row.selector || (row.pickedOptions && Object.keys(row.pickedOptions).length > 0))

          if (testRows.length === 0) return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '20px' }}>
              <div style={{ background: card, borderRadius: '16px', padding: '32px', border: `1px solid ${border}`, textAlign: 'center', minWidth: '300px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>No fields configured yet</div>
                <div style={{ fontSize: '13px', color: muted, marginBottom: '20px' }}>Use <strong>🎯 Pick</strong> to scan fields on the platform first.</div>
                <button onClick={() => setShowTestModal(false)} style={{ padding: '10px 24px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>Got it</button>
              </div>
            </div>
          )

          const buildFillPayload = () => ({
            mode: 'fill',
            url: finalUrl,
            fields: testRows.map(row => {
              const chosenOpt = testSelections[row.label] || row.options[0]
              return {
                label: row.label,
                selector: row.selector,
                pickType: row.pickType,
                fillMethod: row.fillMethod,
                // Radio: selector of chosen option
                selectedOption: chosenOpt || null,
                selectedSelector: (row.pickType === 'radio' || row.pickType === 'dropdown')
                  ? (row.pickedOptions?.[chosenOpt] || null)
                  : null,
                // Dropdown: trigger selector to open the menu first
                triggerSelector: row.pickType === 'dropdown' ? row.triggerSelector : null,
                // Checkbox: whether to check it
                doCheck: row.pickType === 'checkbox' ? (testSelections[row.label] === 'yes') : false,
                // Text value
                value: testSelections[row.label] || row.mappedTo || `(test ${row.label})`,
                valueMap: row.valueMap,
              }
            })
          })

          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '20px' }}>
              <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '660px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>🧪 Test — {configGame.name} on {platform.name}</h2>
                      <p style={{ fontSize: '12px', color: muted, marginTop: '3px' }}>
                        For multi-pick fields, choose which option to test. Then click Launch Test.
                      </p>
                    </div>
                    <button onClick={() => setShowTestModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
                  </div>
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: '#4caf5015', border: '1px solid #4caf5033', borderRadius: '8px', fontSize: '12px', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⌨️</span>
                    <span>After the page opens, press <strong>F3</strong> to trigger auto-fill. Press <strong>Esc</strong> to cancel.</span>
                  </div>
                </div>

                {/* Field rows */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {testRows.map(row => (
                    <div key={row.label} style={{ background: sectionBg, borderRadius: '10px', padding: '12px', border: `1px solid ${border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{row.label}</span>
                          <span style={{ fontSize: '10px', color: muted }}>({row.source})</span>
                        </div>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: '#7E655115', color: '#7E6551' }}>{row.pickType}</span>
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: border, color: muted }}>{row.fillMethod}</span>
                        </div>
                      </div>

                      {/* Radio / Dropdown — option buttons */}
                      {(row.pickType === 'radio' || row.pickType === 'dropdown') && row.options.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', color: muted, marginBottom: '6px' }}>Choose which option to test:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {row.options.map(opt => {
                              const isSelected = (testSelections[row.label] || row.options[0]) === opt
                              const sel = row.pickedOptions?.[opt] || ''
                              return (
                                <button key={opt} onClick={() => setTestSelections(prev => ({ ...prev, [row.label]: opt }))}
                                  style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid ${isSelected ? '#7E6551' : border}`, background: isSelected ? '#7E6551' : 'transparent', color: isSelected ? '#FDF4DC' : muted, fontSize: '12px', cursor: 'pointer', fontWeight: isSelected ? '500' : '400', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                                  <span>{opt}</span>
                                  <code style={{ fontSize: '9px', opacity: 0.7, fontWeight: '400' }}>{sel.startsWith('__text__:') ? `text:"${sel.slice(9)}"` : sel.slice(0, 28) + (sel.length > 28 ? '…' : '')}</code>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Checkbox — Yes / No */}
                      {row.pickType === 'checkbox' && (
                        <div>
                          <div style={{ fontSize: '11px', color: muted, marginBottom: '6px' }}>Check or skip?</div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {['yes', 'no'].map(v => {
                              const isSelected = (testSelections[row.label] || 'yes') === v
                              return (
                                <button key={v} onClick={() => setTestSelections(prev => ({ ...prev, [row.label]: v }))}
                                  style={{ padding: '7px 20px', borderRadius: '8px', border: `1px solid ${isSelected ? '#7E6551' : border}`, background: isSelected ? '#7E6551' : 'transparent', color: isSelected ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', fontWeight: isSelected ? '600' : '400', textTransform: 'capitalize' }}>
                                  {v === 'yes' ? '✓ Check it' : '– Skip'}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Text / Rich Text — type a test value */}
                      {(row.pickType === 'text' || row.pickType === 'richtext') && (
                        <div>
                          <div style={{ fontSize: '11px', color: muted, marginBottom: '5px' }}>
                            Test value {row.mappedTo && <span style={{ color: '#4caf50' }}>(mapped to: <strong>{row.mappedTo}</strong>)</span>}:
                          </div>
                          <input
                            value={testSelections[row.label] ?? (row.mappedTo || '')}
                            onChange={e => setTestSelections(prev => ({ ...prev, [row.label]: e.target.value }))}
                            placeholder={`Enter test value for ${row.label}…`}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                          />
                          {row.selector && <code style={{ fontSize: '10px', color: '#a0c4ff', display: 'block', marginTop: '4px' }}>{row.selector}</code>}
                        </div>
                      )}

                      {/* Other types — just show selector */}
                      {row.pickType !== 'text' && row.pickType !== 'richtext' && row.pickType !== 'radio' && row.pickType !== 'dropdown' && row.pickType !== 'checkbox' && (
                        <code style={{ fontSize: '11px', color: '#a0c4ff', wordBreak: 'break-all' }}>
                          {row.selector ? (row.selector.startsWith('__text__:') ? `text: "${row.selector.slice(9)}"` : row.selector) : <span style={{ color: muted, fontStyle: 'italic' }}>no selector set</span>}
                        </code>
                      )}
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0, display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowTestModal(false)}
                    style={{ flex: 1, padding: '11px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => {
                    const payload = buildFillPayload()
                    setShowTestModal(false)
                    // Send to extension via postMessage — extension opens the URL and waits for F3
                    window.postMessage({ __vaultExtension: true, type: 'START_FILL', payload }, '*')
                  }} style={{ flex: 2, padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    🚀 Launch Test
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── VIEW 2: Account List ──────────────────────────────────────────
  const gameConfig = getGameConfig(selectedGame.id)
  const summaryFields = getSummaryFields(selectedGame.id)
  const stats = getGameStats(selectedGame.id)

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
      <style>{`${scrollbarStyle} @keyframes posting-spin { to { transform: rotate(360deg) } } @keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <button onClick={() => { setSelectedGame(null); setExpandedAccount(null); setExpandedSheet(null) }}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '13px', marginBottom: '24px', padding: 0 }}>
        <ArrowLeft size={15} /> Back to Games
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: selectedGame.image ? `url(${selectedGame.image}) center/cover no-repeat` : '#7E655122', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {!selectedGame.image && <Gamepad2 size={20} color="#7E6551" />}
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '600', color: text }}>{selectedGame.name}</h1>
            <p style={{ fontSize: '13px', color: muted, marginTop: '2px' }}>{stats.pending} need posting · {stats.total - stats.pending} fully posted</p>
            {scriptUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: '#4caf50' }}>⚡ Script:</span>
                <code style={{ fontSize: '11px', color: '#4caf50', background: '#4caf5011', padding: '2px 8px', borderRadius: '6px', wordBreak: 'break-all' }}>{scriptUrl}</code>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => openConfigModal(selectedGame)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: isPostingConfigured(selectedGame) ? '#7E655115' : 'transparent', color: isPostingConfigured(selectedGame) ? '#7E6551' : muted, border: `1px solid ${isPostingConfigured(selectedGame) ? '#7E6551' : border}`, borderRadius: '10px', cursor: 'pointer', fontSize: '13px' }}>
            <Settings size={14} /> Configure
          </button>
          <button onClick={() => setShowPosted(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', color: showPosted ? '#7E6551' : muted, border: `1px solid ${showPosted ? '#7E6551' : border}`, borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px' }}>
            {showPosted ? <Eye size={14} /> : <EyeOff size={14} />}
            {showPosted ? 'Hide posted' : 'Show posted'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', color: muted }}>Overall posting progress</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: text }}>{stats.postedSlots} / {stats.totalSlots} slots</span>
        </div>
        <div style={{ height: '8px', background: border, borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: stats.totalSlots > 0 ? `${(stats.postedSlots / stats.totalSlots) * 100}%` : '0%', background: '#7E6551', borderRadius: '4px', transition: 'width 0.4s' }} />
        </div>
      </div>

      {displayAccounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: card, borderRadius: '12px', border: `1px solid ${border}` }}>
          <span style={{ fontSize: '40px', display: 'block', marginBottom: '14px' }}>✅</span>
          <div style={{ fontSize: '16px', fontWeight: '600', color: text, marginBottom: '6px' }}>All accounts posted!</div>
          <div style={{ fontSize: '13px', color: muted }}>Every account has been posted on all platforms.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayAccounts.map(account => {
            const targets = account.targetPlatforms || []
            const postedCount = targets.filter(p => p.posted).length
            const isFullyPosted = postedCount === targets.length
            const isExpanded = expandedAccount === account.id
            const thumbnail = getThumbnail(account)

            return (
              <div key={account.id} style={{ background: card, border: `1px solid ${isFullyPosted ? '#4caf5033' : border}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => setExpandedAccount(isExpanded ? null : account.id)}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: thumbnail ? `url(${thumbnail}) center/cover no-repeat` : '#7E655122', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {!thumbnail && <Gamepad2 size={18} color="#7E6551" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {account.postingPriority === 1 && (
                        <span style={{ fontSize: '10px', background: '#e8a020', color: '#fff', padding: '1px 6px', borderRadius: '6px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                          <Flag size={8} /> HIGH
                        </span>
                      )}
                      <span style={{ fontSize: '14px', fontWeight: '600', color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {account.title || 'Untitled Account'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {summaryFields.map(f => (
                        <span key={f.id} style={{ fontSize: '12px', color: muted }}>{f.label}: <span style={{ color: text }}>{account.fields?.[f.id] || '—'}</span></span>
                      ))}
                      <span style={{ fontSize: '12px', color: '#4caf50', fontWeight: '500' }}>{account.soldForCurrency} {account.soldFor || 0}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {targets.map(t => (
                      <span key={t.platformName} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: t.posted ? '#4caf5022' : '#e8a02022', color: t.posted ? '#4caf50' : '#e8a020', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {t.posted && <Check size={9} />}{t.platformName}
                      </span>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: isFullyPosted ? '#4caf50' : text }}>{postedCount}/{targets.length}</div>
                    <div style={{ fontSize: '11px', color: muted }}>posted</div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} color={muted} /> : <ChevronDown size={16} color={muted} />}
                </div>

                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${border}`, background: sectionBg }}>
                    <div style={{ display: 'flex', gap: '8px', padding: '12px 16px 0', flexWrap: 'wrap' }}>
                      <button onClick={() => markAllPosted(account)} style={{ padding: '6px 14px', background: '#4caf5022', color: '#4caf50', border: '1px solid #4caf5044', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}><Check size={12} /> Mark all posted</button>
                      <button onClick={() => markAllUnposted(account)} style={{ padding: '6px 14px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Reset all</button>
                    </div>

                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {targets.map(target => {
                        const key = `${account.id}_${target.platformName}`
                        const status = scriptStatus[key]
                        const platform = platforms.find(p => p.name === target.platformName)
                        const postingCfg = platform ? getPostingConfig(account.gameId, platform.id) : {}
                        const platformUrl = getTemplateUrl(platform, { id: account.gameId }) || postingCfg.__gameUrl || platform?.url || ''
                        const sheetRows = platform ? buildPostingSheet(account, platform) : []
                        const hasSheet = sheetRows.length > 0
                        const sheetKey = `${account.id}_${target.platformName}`
                        const isSheetOpen = expandedSheet === sheetKey
                        const isConfigured = platform ? Object.keys(postingCfg).filter(k => k !== '__gameUrl').length > 0 : false

                        return (
                          <div key={target.platformName} style={{ background: card, borderRadius: '10px', border: `1px solid ${target.posted ? '#4caf5033' : border}`, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>
                              <div onClick={() => markPosted(account, target.platformName, !target.posted)}
                                style={{ width: '36px', height: '20px', borderRadius: '10px', background: target.posted ? '#4caf50' : border, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                                <div style={{ position: 'absolute', top: '3px', left: target.posted ? '19px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{target.platformName}</span>
                                  {target.posted && <span style={{ fontSize: '11px', color: '#4caf50' }}>✓ Posted</span>}
                                  {!isConfigured && hasSheet && <span style={{ fontSize: '11px', color: '#e8a020' }}>⚠ No selectors</span>}
                                </div>
                                {platformUrl && (
                                  <a href={platformUrl.match(/^https?:\/\//) ? platformUrl : `https://${platformUrl}`} target="_blank" rel="noreferrer"
                                    style={{ fontSize: '11px', color: '#2196f3', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                                    onClick={e => e.stopPropagation()}>
                                    <ExternalLink size={10} /> Open page
                                  </a>
                                )}
                              </div>

                              {hasSheet && (
                                <button onClick={() => setExpandedSheet(isSheetOpen ? null : sheetKey)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: isSheetOpen ? '#7E655122' : 'transparent', color: isSheetOpen ? '#7E6551' : muted, border: `1px solid ${isSheetOpen ? '#7E6551' : border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>
                                  {isSheetOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Posting Sheet
                                </button>
                              )}

                              {!isConfigured && (
                                <button onClick={() => openConfigModal(selectedGame)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: '#e8a02015', color: '#e8a020', border: '1px solid #e8a02033', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>
                                  <Settings size={12} /> Open Config
                                </button>
                              )}

                              {scriptUrl && (
                                <button onClick={() => launchScript(account, target.platformName, platform, sheetRows)} disabled={status === 'running'}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: status === 'running' ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '500', flexShrink: 0, background: status === 'done' ? '#4caf50' : status === 'error' ? '#e05252' : status === 'running' ? '#7E655188' : '#7E6551', color: '#FDF4DC', opacity: status === 'running' ? 0.8 : 1 }}>
                                  {status === 'running' && <div style={{ width: '12px', height: '12px', border: '2px solid #FDF4DC44', borderTop: '2px solid #FDF4DC', borderRadius: '50%', animation: 'posting-spin 0.8s linear infinite' }} />}
                                  {status === 'done' && <Check size={12} />}
                                  {status === 'error' && <X size={12} />}
                                  {!status && <Play size={12} />}
                                  {status === 'running' ? 'Running...' : status === 'done' ? 'Done!' : status === 'error' ? 'Error' : 'Run Script'}
                                </button>
                              )}

                              {!scriptUrl && !target.posted && (
                                <button onClick={() => markPosted(account, target.platformName, true)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', background: '#4caf5022', color: '#4caf50', border: '1px solid #4caf5044', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>
                                  <Check size={12} /> Mark Posted
                                </button>
                              )}
                            </div>

                            {isSheetOpen && hasSheet && (
                              <div style={{ borderTop: `1px solid ${border}`, padding: '14px', background: sectionBg, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: muted, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Posting Sheet — {target.platformName}
                                </div>
                                {sheetRows.map((row, i) => {
                                  const fieldValue = getFieldValue(account, target.platformName, row)
                                  const copyKey = `${sheetKey}_${row.label}`
                                  const editKey = `${account.id}_${target.platformName}_${row.label}`
                                  const wasCopied = copiedKey === copyKey
                                  const isEditing = editingSheetKey === editKey
                                  const hasViolations = row.violations?.length > 0
                                  const optionKeys = row.pickedOptions ? Object.keys(row.pickedOptions) : []
                                  const accountOptions = row.accountFieldOptions || []
                                  const displayOptions = accountOptions.length > 0 ? accountOptions : optionKeys
                                  const isMultiField = (
                                    (row.pickType === 'radio' || row.pickType === 'dropdown') && optionKeys.length > 0
                                  ) || (['Dropdown', 'Radio'].includes(row.accountFieldType) && accountOptions.length > 0)
                                  const isHtmlField = row.isHtml

                                  return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: card, borderRadius: '8px', border: `1px solid ${hasViolations ? '#e0525244' : isEditing ? '#7E655166' : row.isMapped && row.resolvedValue !== null ? '#4caf5022' : border}` }}>
                                      <div style={{ minWidth: '130px', flexShrink: 0 }}>
                                        <div style={{ fontSize: '12px', fontWeight: '500', color: hasViolations ? '#e05252' : text }}>{row.label}</div>
                                        <div style={{ fontSize: '10px', color: muted, marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                          {row.selector && (
                                            row.selector.startsWith('__text__:')
                                              ? <span style={{ fontSize: '10px', color: '#9c27b0', background: '#9c27b011', padding: '1px 5px', borderRadius: '3px' }}>text: "{row.selector.slice(9)}"</span>
                                              : <span style={{ fontFamily: 'monospace', background: sectionBg, padding: '1px 4px', borderRadius: '3px' }}>{row.selector}</span>
                                          )}
                                          <span>{row.fillMethod}</span>
                                        </div>
                                        {row.isMapped && row.resolvedValue !== null && <div style={{ fontSize: '10px', color: hasViolations ? '#e05252' : '#4caf50', marginTop: '2px' }}>{hasViolations ? '⚠ violations' : '● auto-filled'}</div>}
                                        {hasViolations && row.violations.map((v, vi) => (
                                          <div key={vi} style={{ fontSize: '10px', color: '#e05252', background: '#e0525210', padding: '2px 5px', borderRadius: '4px', marginTop: '2px' }}>⚠ {v}</div>
                                        ))}
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        {isHtmlField ? (
                                          // HTML template field — show rendered preview + copy raw HTML
                                          <div>
                                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                                              <button onClick={() => setEditingSheetKey(isEditing ? null : editKey)}
                                                style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', border: `1px solid ${border}`, background: isEditing ? '#7E655122' : 'transparent', color: isEditing ? '#7E6551' : muted, cursor: 'pointer' }}>
                                                {isEditing ? 'Close' : '👁 Preview'}
                                              </button>
                                              <button onClick={() => copyToClipboard(row.resolvedValue, copyKey)}
                                                style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', border: `1px solid ${border}`, background: 'transparent', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <Copy size={10} /> Copy HTML
                                              </button>
                                            </div>
                                            {isEditing && (
                                              <div style={{ border: `1px solid ${border}`, borderRadius: '8px', padding: '12px', background: '#fff', maxHeight: '300px', overflow: 'auto', fontSize: '13px', marginBottom: '6px' }}
                                                dangerouslySetInnerHTML={{ __html: row.resolvedValue }} />
                                            )}
                                            {!isEditing && (
                                              <div style={{ fontSize: '12px', color: muted, padding: '6px 10px', background: '#4caf5011', border: '1px solid #4caf5022', borderRadius: '6px' }}>
                                                ✓ HTML template ready — {row.resolvedValue?.length || 0} chars · Click Preview to see rendered output
                                              </div>
                                            )}
                                          </div>
                                        ) : isEditing && isMultiField ? (
                                          // Dropdown → <select>, Radio → buttons
                                          row.accountFieldType === 'Dropdown' ? (
                                            <select
                                              autoFocus
                                              value={fieldValue}
                                              onChange={e => { setManualValue(account, target.platformName, row.label, e.target.value); setEditingSheetKey(null) }}
                                              style={{ width: '100%', padding: '7px 10px', background: inputBg, border: `1px solid #7E6551`, borderRadius: '6px', color: text, fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                                              {displayOptions.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                              ))}
                                            </select>
                                          ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                              {displayOptions.map(opt => {
                                                const isSelected = fieldValue === opt
                                                return (
                                                  <button key={opt}
                                                    onClick={() => { setManualValue(account, target.platformName, row.label, opt); setEditingSheetKey(null) }}
                                                    style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid ${isSelected ? '#7E6551' : border}`, background: isSelected ? '#7E6551' : inputBg, color: isSelected ? '#FDF4DC' : text, fontSize: '12px', cursor: 'pointer', fontWeight: isSelected ? '500' : '400' }}>
                                                    {opt}
                                                  </button>
                                                )
                                              })}
                                            </div>
                                          )
                                        ) : isEditing ? (
                                          <div>
                                            <input autoFocus value={fieldValue}
                                              onChange={e => setManualValue(account, target.platformName, row.label, e.target.value)}
                                              onBlur={() => setEditingSheetKey(null)}
                                              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingSheetKey(null) }}
                                              placeholder={row.rawValue || `Enter ${row.label}...`}
                                              style={{ width: '100%', padding: '6px 10px', background: inputBg, border: `1px solid ${hasViolations ? '#e0525266' : '#7E6551'}`, borderRadius: '6px', color: text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                            {platform?.titleRules?.charLimit && row.isTitle && (
                                              <div style={{ fontSize: '10px', color: fieldValue?.length > parseInt(platform.titleRules.charLimit) ? '#e05252' : muted, marginTop: '3px', textAlign: 'right' }}>
                                                {fieldValue?.length || 0} / {platform.titleRules.charLimit}
                                              </div>
                                            )}
                                          </div>
                                        ) : hasViolations ? (
                                          <div style={{ fontSize: '13px', color: text, padding: '6px 10px', background: '#e0525208', border: '1px solid #e0525244', borderRadius: '6px', wordBreak: 'break-word', cursor: 'pointer' }}
                                            onClick={() => setEditingSheetKey(editKey)}>
                                            {fieldValue || <span style={{ color: muted, fontStyle: 'italic' }}>empty</span>}
                                          </div>
                                        ) : row.isMapped && row.resolvedValue !== null ? (
                                          <div style={{ fontSize: '13px', color: text, padding: '6px 10px', background: '#4caf5011', border: '1px solid #4caf5022', borderRadius: '6px', wordBreak: 'break-word' }}>
                                            {fieldValue || <span style={{ color: muted, fontStyle: 'italic' }}>empty</span>}
                                            {row.isTitle && platform?.titleRules && Object.values(platform.titleRules).some(v => v !== '' && v !== false) && (
                                              <div style={{ fontSize: '10px', color: '#7E6551', marginTop: '3px' }}>✓ Rules applied — {fieldValue?.length || 0} chars</div>
                                            )}
                                          </div>
                                        ) : (
                                          <input value={fieldValue} onChange={e => setManualValue(account, target.platformName, row.label, e.target.value)} placeholder={`Enter ${row.label}...`}
                                            style={{ width: '100%', padding: '6px 10px', background: inputBg, border: `1px solid ${border}`, borderRadius: '6px', color: text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                        <button onClick={() => setEditingSheetKey(isEditing ? null : editKey)} title="Edit"
                                          style={{ padding: '5px 8px', background: isEditing ? '#7E655122' : 'transparent', color: isEditing ? '#7E6551' : muted, border: `1px solid ${isEditing ? '#7E6551' : border}`, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                          <Pencil size={11} />
                                        </button>
                                        <button onClick={() => copyToClipboard(fieldValue, copyKey)} disabled={!fieldValue} title="Copy"
                                          style={{ padding: '5px 8px', background: wasCopied ? '#4caf5022' : 'transparent', color: wasCopied ? '#4caf50' : muted, border: `1px solid ${wasCopied ? '#4caf5044' : border}`, borderRadius: '6px', cursor: fieldValue ? 'pointer' : 'not-allowed', opacity: fieldValue ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}>
                                          {wasCopied ? <Check size={11} /> : <Copy size={11} />}
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                  {platformUrl && (
                                    <a href={platformUrl.match(/^https?:\/\//) ? platformUrl : `https://${platformUrl}`} target="_blank" rel="noreferrer"
                                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#2196f322', color: '#2196f3', border: '1px solid #2196f344', borderRadius: '8px', fontSize: '12px', fontWeight: '500', textDecoration: 'none' }}>
                                      <ExternalLink size={12} /> Open {target.platformName}
                                    </a>
                                  )}
                                  {!target.posted && (
                                    <button onClick={() => markPosted(account, target.platformName, true)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#4caf5022', color: '#4caf50', border: '1px solid #4caf5044', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                                      <Check size={12} /> Mark as Posted
                                    </button>
                                  )}
                                  {scriptUrl && (
                                    <button onClick={() => launchScript(account, target.platformName, platform, sheetRows)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                                      <Play size={12} /> Run Script
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Config modal also accessible from account view */}
      {showConfigModal && configGame && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
          <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '600px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>⚙️ Posting Config — {configGame.name}</h2>
                <button onClick={() => setShowConfigModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
              </div>
              <p style={{ fontSize: '12px', color: muted, marginTop: '4px' }}>Configure CSS selectors for each field per platform.</p>
              <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                {getAllowedPlatforms(configGame).map(p => (
                  <button key={p.id} onClick={() => setConfigPlatformTab(p.id)}
                    style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: configPlatformTab === p.id ? '#7E6551' : sectionBg, color: configPlatformTab === p.id ? '#FDF4DC' : muted, fontWeight: configPlatformTab === p.id ? '500' : '400' }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const platform = platforms.find(p => p.id === configPlatformTab)
                if (!platform) return <div style={{ fontSize: '13px', color: muted }}>No platform selected.</div>
                const fields = getConfigFields(configGame, platform)
                if (fields.length === 0) return (
                  <div style={{ fontSize: '13px', color: muted, padding: '20px', textAlign: 'center' }}>
                    No fields configured for {platform.name}.<br />
                    <span style={{ fontSize: '12px' }}>Go to Platforms → Edit → add Global Fields or Game Templates first.</span>
                  </div>
                )
                const platformCfg = configFields[platform.id] || {}
                const FILL_METHODS = ['Type Text', 'Select Option', 'Click']
                return (
                  <>
                    {fields.map(field => {
                      const fieldCfg = platformCfg[field.label] || {}
                      const PICK_LABELS = { text: '📝 Text', dropdown: '📋 Dropdown', radio: '🔘 Radio', checkbox: '☑️ Checkbox', richtext: '✍️ Rich Text' }
                      return (
                        <div key={field.label} style={{ background: sectionBg, borderRadius: '10px', padding: '12px', border: `1px solid ${border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{field.label}</span>
                              <span style={{ fontSize: '11px', color: muted }}>({field.source})</span>
                              {field.accountFieldId && <span style={{ fontSize: '11px', color: '#4caf50' }}>● auto-mapped</span>}
                              {fieldCfg.pickType && (
                                <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '8px', background: '#7E655115', color: '#7E6551', border: '1px solid #7E655133' }}>
                                  {PICK_LABELS[fieldCfg.pickType] || fieldCfg.pickType}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input value={fieldCfg.selector || ''}
                                onChange={e => setConfigFields(prev => ({ ...prev, [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), selector: e.target.value } } }))}
                                placeholder={fieldCfg.selector ? '' : 'CSS Selector — use 🎯 Pick to configure'}
                                style={inputStyle} />
                              <select
                                value={fieldCfg.pickType || 'text'}
                                onChange={e => setConfigFields(prev => ({ ...prev, [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), pickType: e.target.value } } }))}
                                style={{ padding: '0 4px', height: '36px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: muted, fontSize: '11px', cursor: 'pointer', outline: 'none', flexShrink: 0 }}>
                                {[{v:'text',l:'📝 Text'},{v:'dropdown',l:'📋 Dropdown'},{v:'radio',l:'🔘 Radio'},{v:'checkbox',l:'☑️ Checkbox'},{v:'richtext',l:'✍️ Rich Text'}].map(t => (
                                  <option key={t.v} value={t.v}>{t.l}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {FILL_METHODS.map(m => (
                                <button key={m} onClick={() => setConfigFields(prev => ({ ...prev, [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), fillMethod: m } } }))}
                                  style={{ flex: 1, padding: '5px', borderRadius: '7px', border: `1px solid ${(fieldCfg.fillMethod || 'Type') === m ? '#7E6551' : border}`, background: (fieldCfg.fillMethod || 'Type') === m ? '#7E655115' : 'transparent', color: (fieldCfg.fillMethod || 'Type') === m ? '#7E6551' : muted, fontSize: '11px', cursor: 'pointer' }}>
                                  {m}
                                </button>
                              ))}
                            </div>
                            {/* Value mapping / picked options */}
                            {(() => {
                              const hasScraped = (fieldCfg.scrapedOptions?.length > 0)
                              const hasPicked  = fieldCfg.pickedOptions && Object.keys(fieldCfg.pickedOptions).length > 0
                              if (!hasScraped && !hasPicked) return null
                              const gameConfig2  = configGame ? getGameConfig(configGame.id) : {}
                              const customField = (gameConfig2.customFields || []).find(cf => cf.id === field.accountFieldId)
                              const appOptions  = customField?.options || []
                              const platformOpts = hasScraped
                                ? fieldCfg.scrapedOptions.map(o => o.value || o.label)
                                : Object.keys(fieldCfg.pickedOptions)
                              const valueMap = fieldCfg.valueMap || {}
                              return (
                                <div>
                                  {appOptions.length > 0 && (
                                    <div style={{ background: '#e8a02008', border: `1px solid #e8a02033`, borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
                                      <div style={{ fontSize: '11px', color: '#e8a020', fontWeight: '500', marginBottom: '8px' }}>⚡ Value Mapping</div>
                                      {appOptions.map(appVal => (
                                        <div key={appVal} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                                          <span style={{ fontSize: '11px', color: text, minWidth: '80px', flexShrink: 0, background: sectionBg, padding: '3px 7px', borderRadius: '5px', border: `1px solid ${border}` }}>{appVal}</span>
                                          <span style={{ fontSize: '11px', color: muted }}>→</span>
                                          <select value={valueMap[appVal] || ''}
                                            onChange={e => setConfigFields(prev => ({ ...prev, [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), valueMap: { ...(prev[platform.id]?.[field.label]?.valueMap || {}), [appVal]: e.target.value } } } }))}
                                            style={{ flex: 1, padding: '3px 7px', borderRadius: '5px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '11px', outline: 'none' }}>
                                            <option value="">— not mapped —</option>
                                            {platformOpts.map(pv => <option key={pv} value={pv}>{pv}</option>)}
                                          </select>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {hasPicked && (
                                    <div style={{ background: '#2196f308', border: `1px solid #2196f333`, borderRadius: '8px', padding: '10px' }}>
                                      <div style={{ fontSize: '11px', color: '#2196f3', fontWeight: '500', marginBottom: '6px' }}>🔘 Option selectors picked <span style={{ color: muted, fontWeight: 400 }}>— names are editable</span></div>
                                      {Object.entries(fieldCfg.pickedOptions).map(([lbl, sel]) => (
                                        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                          <input
                                            defaultValue={lbl}
                                            onBlur={e => {
                                              const newLbl = e.target.value.trim()
                                              if (!newLbl || newLbl === lbl) return
                                              const newOpts = {}
                                              for (const [k, v] of Object.entries(fieldCfg.pickedOptions)) newOpts[k === lbl ? newLbl : k] = v
                                              setConfigFields(prev => ({ ...prev, [platform.id]: { ...(prev[platform.id] || {}), [field.label]: { ...(prev[platform.id]?.[field.label] || {}), pickedOptions: newOpts } } }))
                                            }}
                                            style={{ fontSize: '11px', color: text, flexShrink: 0, background: inputBg, border: `1px solid ${border}`, borderRadius: '5px', padding: '2px 6px', outline: 'none', width: '100px' }}
                                          />
                                          <code style={{ fontSize: '10px', color: '#2196f3', background: '#2196f311', padding: '2px 6px', borderRadius: '4px', flex: 1, wordBreak: 'break-all' }}>{sel}</code>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowTestModal(true)}
                  style={{ flex: 1, padding: '11px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                  🧪 Test
                </button>
                <button onClick={() => { const p = platforms.find(p => p.id === configPlatformTab); if (p) openPanelPicker(p) }}
                  style={{ flex: 1, padding: '11px', background: 'transparent', color: '#7E6551', border: `1px solid #7E6551`, borderRadius: '10px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                  🎯 Pick
                </button>
                <button onClick={saveConfigModal} style={{ flex: 2, padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Test Modal (View 2) ── */}
      {showTestModal && configGame && (() => {
        const platform = platforms.find(p => p.id === configPlatformTab)
        if (!platform) return null
        const fields = getConfigFields(configGame, platform)
        const platformCfg = configFields[platform.id] || {}
        const gameConfig = getGameConfig(configGame.id)
        const url = getTemplateUrl(platform, configGame) || platform.url || ''
        const finalUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
        const BUILTIN_MAP = { '__title': 'Account Title', '__soldFor': 'Selling Price', '__boughtFor': 'Cost Price' }

        const testRows = fields.map(field => {
          const cfg = platformCfg[field.label] || {}
          const mappedLabel = (() => {
            if (!field.accountFieldId) return null
            if (BUILTIN_MAP[field.accountFieldId]) return BUILTIN_MAP[field.accountFieldId]
            const custom = (gameConfig.customFields || []).find(f => String(f.id) === String(field.accountFieldId))
            return custom?.label || 'mapped'
          })()
          const isMulti = cfg.pickType === 'radio' || cfg.pickType === 'checkbox' || cfg.pickType === 'dropdown'
          const options = isMulti && cfg.pickedOptions ? Object.keys(cfg.pickedOptions) : []
          return {
            label: field.label, source: field.source,
            selector: cfg.selector || '',
            triggerSelector: cfg.selector || '',
            pickType: cfg.pickType || 'text',
            fillMethod: cfg.fillMethod || 'Type Text',
            pickedOptions: cfg.pickedOptions || null,
            scrapedOptions: cfg.scrapedOptions || null,
            valueMap: cfg.valueMap || {},
            mappedTo: mappedLabel, isMulti, options
          }
        }).filter(row => row.selector || (row.pickedOptions && Object.keys(row.pickedOptions).length > 0))

        if (testRows.length === 0) return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '20px' }}>
            <div style={{ background: card, borderRadius: '16px', padding: '32px', border: `1px solid ${border}`, textAlign: 'center', minWidth: '300px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>No fields configured yet</div>
              <div style={{ fontSize: '13px', color: muted, marginBottom: '20px' }}>Use <strong>🎯 Pick</strong> to scan fields on the platform first.</div>
              <button onClick={() => setShowTestModal(false)} style={{ padding: '10px 24px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>Got it</button>
            </div>
          </div>
        )

        const buildFillPayload = () => ({
          mode: 'fill',
          url: finalUrl,
          fields: testRows.map(row => {
            const chosenOpt = testSelections[row.label] || row.options[0]
            return {
              label: row.label,
              selector: row.selector,
              pickType: row.pickType,
              fillMethod: row.fillMethod,
              selectedOption: chosenOpt || null,
              selectedSelector: (row.pickType === 'radio' || row.pickType === 'dropdown')
                ? (row.pickedOptions?.[chosenOpt] || null)
                : null,
              triggerSelector: row.pickType === 'dropdown' ? row.triggerSelector : null,
              doCheck: row.pickType === 'checkbox' ? (testSelections[row.label] === 'yes') : false,
              value: testSelections[row.label] || row.mappedTo || `(test ${row.label})`,
              valueMap: row.valueMap,
            }
          })
        })

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '20px' }}>
            <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '660px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>🧪 Test — {configGame.name} on {platform.name}</h2>
                    <p style={{ fontSize: '12px', color: muted, marginTop: '3px' }}>Choose option values to test, then Launch Test.</p>
                  </div>
                  <button onClick={() => setShowTestModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
                </div>
                <div style={{ marginTop: '10px', padding: '8px 12px', background: '#4caf5015', border: '1px solid #4caf5033', borderRadius: '8px', fontSize: '12px', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⌨️</span>
                  <span>After the page opens, press <strong>F3</strong> to trigger auto-fill. Press <strong>Esc</strong> to cancel.</span>
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {testRows.map(row => (
                  <div key={row.label} style={{ background: sectionBg, borderRadius: '10px', padding: '12px', border: `1px solid ${border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{row.label}</span>
                        <span style={{ fontSize: '10px', color: muted }}>({row.source})</span>
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: '#7E655115', color: '#7E6551' }}>{row.pickType}</span>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: border, color: muted }}>{row.fillMethod}</span>
                      </div>
                    </div>
                    {(row.pickType === 'radio' || row.pickType === 'dropdown') && row.options.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: muted, marginBottom: '6px' }}>Choose which option to test:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {row.options.map(opt => {
                            const isSelected = (testSelections[row.label] || row.options[0]) === opt
                            const sel = row.pickedOptions?.[opt] || ''
                            return (
                              <button key={opt} onClick={() => setTestSelections(prev => ({ ...prev, [row.label]: opt }))}
                                style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid ${isSelected ? '#7E6551' : border}`, background: isSelected ? '#7E6551' : 'transparent', color: isSelected ? '#FDF4DC' : muted, fontSize: '12px', cursor: 'pointer', fontWeight: isSelected ? '500' : '400', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                                <span>{opt}</span>
                                <code style={{ fontSize: '9px', opacity: 0.7, fontWeight: '400' }}>{sel.startsWith('__text__:') ? `text:"${sel.slice(9)}"` : sel.slice(0, 28) + (sel.length > 28 ? '…' : '')}</code>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {row.pickType === 'checkbox' && (
                      <div>
                        <div style={{ fontSize: '11px', color: muted, marginBottom: '6px' }}>Check or skip?</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {['yes', 'no'].map(v => {
                            const isSelected = (testSelections[row.label] || 'yes') === v
                            return (
                              <button key={v} onClick={() => setTestSelections(prev => ({ ...prev, [row.label]: v }))}
                                style={{ padding: '7px 20px', borderRadius: '8px', border: `1px solid ${isSelected ? '#7E6551' : border}`, background: isSelected ? '#7E6551' : 'transparent', color: isSelected ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', fontWeight: isSelected ? '600' : '400', textTransform: 'capitalize' }}>
                                {v === 'yes' ? '✓ Check it' : '– Skip'}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {(row.pickType === 'text' || row.pickType === 'richtext') && (
                      <div>
                        <div style={{ fontSize: '11px', color: muted, marginBottom: '5px' }}>
                          Test value {row.mappedTo && <span style={{ color: '#4caf50' }}>(mapped to: <strong>{row.mappedTo}</strong>)</span>}:
                        </div>
                        <input
                          value={testSelections[row.label] ?? (row.mappedTo || '')}
                          onChange={e => setTestSelections(prev => ({ ...prev, [row.label]: e.target.value }))}
                          placeholder={`Enter test value for ${row.label}…`}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {row.selector && <code style={{ fontSize: '10px', color: '#a0c4ff', display: 'block', marginTop: '4px' }}>{row.selector}</code>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0, display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowTestModal(false)}
                  style={{ flex: 1, padding: '11px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => {
                  const payload = buildFillPayload()
                  setShowTestModal(false)
                  window.postMessage({ __vaultExtension: true, type: 'START_FILL', payload }, '*')
                }} style={{ flex: 2, padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  🚀 Launch Test
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { Plus, X, Pencil, Settings, Check, Upload, Link, ChevronDown, ChevronUp, Gamepad2 } from 'lucide-react'
import FieldEditor from './FieldEditor'

const SECTIONS = [
  { key: 'accounts', label: 'Accounts', color: '#4caf50', emoji: '🎮' },
  { key: 'offers',   label: 'Offers',   color: '#2196f3', emoji: '💬' },
  { key: 'services', label: 'Services', color: '#9c27b0', emoji: '⚡' },
  { key: 'tools',    label: 'Tools',    color: '#e8a020', emoji: '🔧' },
  { key: 'gacha',    label: 'Gacha',    color: '#e05252', emoji: '🎰' },
]

export default function Games({ darkMode, games, gameConfigs, platforms, addGame, updateGame, deleteGame, saveGameConfig }) {
  const [showGameModal, setShowGameModal] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  const [newGame, setNewGame] = useState({ name: '', image: '', imageUrl: '', sections: [], allowedPlatformIds: [], scriptEnabled: false, scriptSections: [], scannerType: '' })
  const [imageMode, setImageMode] = useState('url')
  const [expandedGame, setExpandedGame] = useState(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [dataListCategory, setDataListCategory] = useState({}) // { [gameId]: categoryId }
  const [showDataPreview, setShowDataPreview] = useState({}) // { [gameId]: bool }
  const [configGame, setConfigGame] = useState(null)
  const [configSection, setConfigSection] = useState(null)
  const [configData, setConfigData] = useState({})

  const card    = darkMode ? '#1e1e1e' : '#fff'
  const border  = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text    = darkMode ? '#FDF4DC' : '#151515'
  const muted   = darkMode ? '#a08570' : '#7E6551'
  const bg      = darkMode ? '#151515' : '#FDF4DC'
  const inputBg = darkMode ? '#2a2a2a' : '#fff'
  const sectionBg = darkMode ? '#252525' : '#f9f4ea'

  const getConfig = (gameId, section) =>
    gameConfigs.find(c => c.game_id === gameId && c.section === section)?.config || null

  const isConfigured = (gameId, section) => {
    const config = getConfig(gameId, section)
    if (!config) return false
    if (section === 'accounts') return (config.customFields || []).length > 0
    if (section === 'offers')   return (config.directFields || []).length > 0 || (config.helpFields || []).length > 0
    if (section === 'services') return (config.services || []).length > 0
    if (section === 'gacha')    return (config.groups || []).length > 0
    if (section === 'tools')    return !!(config.instructions)
    return false
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setNewGame(prev => ({ ...prev, image: reader.result }))
    reader.readAsDataURL(file)
  }

  const handleOpenAdd = () => {
    setEditingGame(null)
    setNewGame({ name: '', image: '', imageUrl: '', sections: [], allowedPlatformIds: [], scriptEnabled: false, scriptSections: [], scannerType: '' })
    setImageMode('url')
    setShowGameModal(true)
  }

  const handleOpenEdit = (game) => {
    setEditingGame(game.id)
    setNewGame({ name: game.name, image: game.image || '', imageUrl: game.image || '', sections: [...(game.sections || [])], allowedPlatformIds: [...(game.allowed_platform_ids || [])], titleCharLimit: game.title_char_limit || '', dataLists: game.data_lists || [], scriptEnabled: game.script_enabled || false, scriptSections: [...(game.script_sections || [])], scannerType: game.scanner_type || '' })
    setImageMode('url')
    setShowGameModal(true)
  }

  const handleSaveGame = async () => {
    if (!newGame.name.trim()) return
    const imageToUse = newGame.image || newGame.imageUrl || ''
    if (editingGame) {
      await updateGame({ id: editingGame, name: newGame.name, image: imageToUse, sections: newGame.sections, allowedPlatformIds: newGame.allowedPlatformIds, titleCharLimit: newGame.titleCharLimit || null, dataLists: newGame.dataLists || [], scriptEnabled: newGame.scriptEnabled, scriptSections: newGame.scriptEnabled ? newGame.scriptSections : [], scannerType: newGame.scannerType || null })
    } else {
      await addGame({ name: newGame.name, image: imageToUse, sections: newGame.sections, allowedPlatformIds: newGame.allowedPlatformIds, titleCharLimit: newGame.titleCharLimit || null, dataLists: newGame.dataLists || [], scriptEnabled: newGame.scriptEnabled, scriptSections: newGame.scriptEnabled ? newGame.scriptSections : [], scannerType: newGame.scannerType || null })
    }
    setShowGameModal(false)
    setEditingGame(null)
  }

  const toggleSection = (key) => {
    setNewGame(prev => {
      const has = prev.sections.includes(key)
      return { ...prev, sections: has ? prev.sections.filter(s => s !== key) : [...prev.sections, key] }
    })
  }

  const togglePlatform = (id) => {
    setNewGame(prev => {
      const has = (prev.allowedPlatformIds || []).includes(id)
      return { ...prev, allowedPlatformIds: has ? prev.allowedPlatformIds.filter(p => p !== id) : [...(prev.allowedPlatformIds || []), id] }
    })
  }

  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

  const openConfig = (game, sectionKey) => {
    const existing = getConfig(game.id, sectionKey)
    setConfigGame(game)
    setConfigSection(sectionKey)

    if (sectionKey === 'accounts') {
      setConfigData({
        customFields: existing?.customFields || [],
        summaryFields: existing?.summaryFields || [],
        scriptUrl: existing?.scriptUrl || '',
        activeTab: 'fields',
      })
    } else if (sectionKey === 'offers') {
      setConfigData({
        directFields: existing?.directFields || [],
        helpFields: existing?.helpFields || [],
        priorityRules: existing?.priorityRules || [],
        activeTab: 'direct',
        newRuleField: '', newRuleOperator: '>=', newRuleValue: '', newRulePriority: 'High',
      })
    } else if (sectionKey === 'services') {
      setConfigData({
        services: existing?.services || [],
        newServiceName: '', newServiceDescription: '', newServicePrice: '',
        newSupplierName: '', newSupplierLink: '', expandedService: null,
      })
    } else if (sectionKey === 'gacha') {
      setConfigData({
        groups: existing?.groups || [],
        newGroupName: '', expandedGroup: null,
        newProductTitle: '', newProductPrice: '',
        newSupplierName: '', newSupplierLink: '',
      })
    } else if (sectionKey === 'tools') {
      setConfigData({
        platform: existing?.platform || 'PC',
        instructions: existing?.instructions || '',
        steps: existing?.steps || [],
        scriptUrl: existing?.scriptUrl || '',
        newStep: '',
      })
    }
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    let config = {}
    if (configSection === 'accounts') {
      config = { customFields: configData.customFields, summaryFields: configData.summaryFields, scriptUrl: configData.scriptUrl }
    } else if (configSection === 'offers') {
      config = { directFields: configData.directFields, helpFields: configData.helpFields, priorityRules: configData.priorityRules }
    } else if (configSection === 'services') {
      config = { services: configData.services }
    } else if (configSection === 'gacha') {
      config = { groups: configData.groups }
    } else if (configSection === 'tools') {
      config = { platform: configData.platform, instructions: configData.instructions, steps: configData.steps, scriptUrl: configData.scriptUrl }
    }
    await saveGameConfig(configGame.id, configSection, config)
    setShowConfigModal(false)
  }

  const toggleSummaryField = (id) => {
    setConfigData(prev => {
      const already = (prev.summaryFields || []).includes(id)
      if (already) return { ...prev, summaryFields: prev.summaryFields.filter(s => s !== id) }
      if ((prev.summaryFields || []).length >= 3) return prev
      return { ...prev, summaryFields: [...(prev.summaryFields || []), id] }
    })
  }

  const inputStyle  = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }
  const labelStyle  = { fontSize: '12px', color: muted, display: 'block', marginBottom: '5px' }

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Games</h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>{games.length} games — click a section badge to configure</p>
        </div>
        <button onClick={handleOpenAdd}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
          <Plus size={16} /> Add Game
        </button>
      </div>

      {/* Game grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {games.map(game => (
          <div key={game.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '120px', background: game.image ? `url(${game.image}) center/cover no-repeat` : '#7E655122', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!game.image && <Gamepad2 size={32} color="#7E6551" />}
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: text }}>{game.name}</div>
                  {game.script_enabled && (game.script_sections || []).length > 0 && (
                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: '#7E655120', color: '#7E6551', border: '1px solid #7E655140', fontWeight: '500' }}>
                      AIO · {(game.script_sections || []).map(k => SECTIONS.find(s => s.key === k)?.label).filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleOpenEdit(game)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }}><Pencil size={14} /></button>
                  <button onClick={() => deleteGame(game.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }}><X size={14} /></button>
                </div>
              </div>
              {(game.sections || []).length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {SECTIONS.filter(s => (game.sections || []).includes(s.key)).map(section => {
                    const configured = isConfigured(game.id, section.key)
                    return (
                      <span key={section.key}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', border: `1px solid ${configured ? section.color + '44' : border}`, background: configured ? section.color + '15' : sectionBg, color: configured ? section.color : muted, fontSize: '12px', cursor: 'pointer' }}>
                        <span>{section.emoji}</span>
                        <span>{section.label}</span>
                        {configured && <Check size={10} />}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: muted }}>No sections — edit to add</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Add/Edit Game Modal ─────────────────────────────────── */}
      {showGameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '460px', border: `1px solid ${border}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px 28px 16px', borderBottom: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '17px', fontWeight: '600', color: text }}>{editingGame ? 'Edit Game' : 'Add New Game'}</h2>
                <button onClick={() => setShowGameModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
              </div>
            </div>
            <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Game Name</label>
                <input value={newGame.name} onChange={e => setNewGame(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. League of Legends" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Cover Image</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  {['url', 'upload'].map(mode => (
                    <button key={mode} onClick={() => setImageMode(mode)}
                      style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `1px solid ${border}`, background: imageMode === mode ? '#7E6551' : inputBg, color: imageMode === mode ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      {mode === 'url' ? <><Link size={12} /> Paste URL</> : <><Upload size={12} /> Upload</>}
                    </button>
                  ))}
                </div>
                {imageMode === 'url'
                  ? <input value={newGame.imageUrl || ''} onChange={e => setNewGame(prev => ({ ...prev, imageUrl: e.target.value }))} placeholder="https://example.com/image.jpg" style={inputStyle} />
                  : <input type="file" accept="image/*" onChange={handleImageUpload} style={inputStyle} />
                }
                {(newGame.image || newGame.imageUrl) && (
                  <img src={newGame.image || newGame.imageUrl} alt="preview" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', marginTop: '8px' }} />
                )}
              </div>
              <div>
                <label style={labelStyle}>Sections — where does this game appear?</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SECTIONS.map(s => (
                    <button key={s.key} onClick={() => toggleSection(s.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '20px', border: `1px solid ${newGame.sections.includes(s.key) ? s.color : border}`, background: newGame.sections.includes(s.key) ? s.color + '15' : 'transparent', color: newGame.sections.includes(s.key) ? s.color : muted, fontSize: '13px', cursor: 'pointer', fontWeight: newGame.sections.includes(s.key) ? '500' : '400' }}>
                      {newGame.sections.includes(s.key) && <Check size={11} />}
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>AIO Tool Script</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: newGame.scriptEnabled ? '10px' : '0' }}>
                  <div onClick={() => setNewGame(prev => ({ ...prev, scriptEnabled: !prev.scriptEnabled }))}
                    style={{ width: '40px', height: '22px', borderRadius: '11px', background: newGame.scriptEnabled ? '#7E6551' : border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: '3px', left: newGame.scriptEnabled ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </div>
                  <span style={{ fontSize: '13px', color: newGame.scriptEnabled ? text : muted }}>
                    {newGame.scriptEnabled ? 'Script enabled' : 'No script'}
                  </span>
                </div>
                {newGame.scriptEnabled && (
                  <div>
                    <div style={{ fontSize: '12px', color: muted, marginBottom: '6px' }}>Which tabs does this script appear under in the AIO Tool? (select all that apply)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {SECTIONS.filter(s => s.key !== 'offers').map(s => {
                        const selected = (newGame.scriptSections || []).includes(s.key)
                        return (
                          <button key={s.key} onClick={() => setNewGame(prev => {
                            const has = (prev.scriptSections || []).includes(s.key)
                            return { ...prev, scriptSections: has ? prev.scriptSections.filter(k => k !== s.key) : [...(prev.scriptSections || []), s.key] }
                          })}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '20px', border: `1px solid ${selected ? s.color : border}`, background: selected ? s.color + '15' : 'transparent', color: selected ? s.color : muted, fontSize: '13px', cursor: 'pointer', fontWeight: selected ? '500' : '400' }}>
                            {selected && <Check size={11} />}
                            {s.emoji} {s.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {newGame.scriptEnabled && (
                <div>
                  <label style={labelStyle}>Scanner Type <span style={{ fontWeight: '300', color: muted }}>(e.g. lol, valorant, tft)</span></label>
                  <input value={newGame.scannerType || ''} onChange={e => setNewGame(prev => ({ ...prev, scannerType: e.target.value }))}
                    placeholder="lol" style={{ width: '100%', padding: '8px 12px', background: bg, border: `1px solid ${border}`, borderRadius: '8px', color: text, fontSize: '13px', outline: 'none' }} />
                  <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>Tells the AIO Tool which scan logic to use for this game</div>
                </div>
              )}

              {platforms && platforms.length > 0 && (
                <div>
                  <label style={labelStyle}>Allowed Platforms <span style={{ fontWeight: '300', color: muted }}>(leave empty = all platforms)</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {platforms.map(p => {
                      const selected = (newGame.allowedPlatformIds || []).includes(p.id)
                      return (
                        <button key={p.id} onClick={() => togglePlatform(p.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '20px', border: `1px solid ${selected ? '#7E6551' : border}`, background: selected ? '#7E655115' : 'transparent', color: selected ? '#7E6551' : muted, fontSize: '13px', cursor: 'pointer', fontWeight: selected ? '500' : '400' }}>
                          {selected && <Check size={11} />}{p.name}
                        </button>
                      )
                    })}
                  </div>
                  {(newGame.allowedPlatformIds || []).length === 0 && (
                    <div style={{ fontSize: '11px', color: muted, marginTop: '5px' }}>All platforms allowed</div>
                  )}
                </div>
              )}
              <div>
                <label style={labelStyle}>Title Character Limit <span style={{ fontWeight: '300', color: muted }}>(max chars for account title)</span></label>
                <input
                  type="number" min="1" max="500"
                  value={newGame.titleCharLimit || ''}
                  onChange={e => setNewGame(prev => ({ ...prev, titleCharLimit: e.target.value }))}
                  placeholder="e.g. 128"
                  style={{ ...inputStyle, width: '160px' }}
                />
                {newGame.titleCharLimit && (
                  <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>Titles will be limited to {newGame.titleCharLimit} characters</div>
                )}
              </div>

              {/* Data Lists — only when script set + checker ran */}
              {(() => {
                const accountsCfg = getConfig(editingGame, 'accounts')
                const checkerData = getConfig(editingGame, 'checker_last_run')
                const hasScript = !!(accountsCfg?.scriptUrl)
                const hasCheckerData = !!(checkerData?.dataKeys && Object.keys(checkerData.dataKeys).length > 0)
                const dataKeys = checkerData?.dataKeys || {}
                const gameId = editingGame || 'new'
                const selectedCatId = dataListCategory[gameId]
                const selectedCat = (newGame.dataLists || []).find(l => l.id === selectedCatId)
                const previewOpen = showDataPreview[gameId]

                if (!hasScript) return (
                  <div style={{ padding: '12px', background: sectionBg, borderRadius: '10px', border: `1px solid ${border}` }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '3px' }}>Data Lists</div>
                    <div style={{ fontSize: '12px', color: muted }}>Requires a Script URL — set one in Accounts → Configure → Script tab.</div>
                  </div>
                )

                if (!hasCheckerData) return (
                  <div style={{ padding: '12px', background: sectionBg, borderRadius: '10px', border: `1px solid ${border}` }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '3px' }}>Data Lists</div>
                    <div style={{ fontSize: '12px', color: muted }}>Script configured ✓ — run the checker on an account first to unlock Data Lists.</div>
                  </div>
                )

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={labelStyle}>Data Lists</label>

                    {/* Checker data preview */}
                    <div style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: card }}>
                        <div style={{ fontSize: '12px', color: muted }}>
                          Last run: {checkerData.lastRun ? new Date(checkerData.lastRun).toLocaleDateString() : 'unknown'} · {Object.keys(dataKeys).length} data keys found
                        </div>
                        <button onClick={() => setShowDataPreview(prev => ({ ...prev, [gameId]: !previewOpen }))}
                          style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', border: `1px solid ${border}`, background: 'transparent', color: muted, cursor: 'pointer' }}>
                          {previewOpen ? '▲ Hide' : '▼ Preview data'}
                        </button>
                      </div>
                      {previewOpen && (
                        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {Object.entries(dataKeys).map(([key, info]) => (
                            <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '500', color: text, minWidth: '120px' }}>{key}</span>
                              <span style={{ fontSize: '12px', color: '#7E6551', fontWeight: '600' }}>{info.count?.toLocaleString()}</span>
                              {info.sample?.length > 0 && (
                                <span style={{ fontSize: '11px', color: muted }}>e.g. {info.sample.slice(0,3).join(', ')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add category row */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input id={`cat-name-${gameId}`} placeholder="Category name e.g. Rare Skins"
                        style={{ ...inputStyle, flex: 1, fontSize: '12px' }} />
                      <select id={`cat-source-${gameId}`}
                        style={{ ...inputStyle, fontSize: '12px', padding: '6px 8px', width: '160px' }}>
                        {Object.keys(dataKeys).map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button onClick={() => {
                        const nameEl = document.getElementById(`cat-name-${gameId}`)
                        const sourceEl = document.getElementById(`cat-source-${gameId}`)
                        const name = nameEl?.value.trim()
                        const source = sourceEl?.value
                        if (!name || !source) return
                        const nl = { id: Date.now().toString(), name, source, items: [] }
                        setNewGame(prev => ({ ...prev, dataLists: [...(prev.dataLists || []), nl] }))
                        setDataListCategory(prev => ({ ...prev, [gameId]: nl.id }))
                        if (nameEl) nameEl.value = ''
                      }}
                        style={{ padding: '6px 12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        + Add Category
                      </button>
                    </div>

                    {/* Category list + item editor */}
                    {(newGame.dataLists || []).length > 0 && (
                      <div style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Category selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '12px', color: muted, flexShrink: 0 }}>Category:</label>
                          <select value={selectedCatId || ''}
                            onChange={e => setDataListCategory(prev => ({ ...prev, [gameId]: e.target.value }))}
                            style={{ ...inputStyle, fontSize: '13px', flex: 1 }}>
                            {(newGame.dataLists || []).map(l => (
                              <option key={l.id} value={l.id}>{l.name} ({l.source})</option>
                            ))}
                          </select>
                          {selectedCat && (
                            <button onClick={() => {
                              setNewGame(prev => ({ ...prev, dataLists: prev.dataLists.filter(l => l.id !== selectedCatId) }))
                              setDataListCategory(prev => ({ ...prev, [gameId]: null }))
                            }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={14} /></button>
                          )}
                        </div>

                        {selectedCat && (
                          <>
                            {/* Add item to selected category */}
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input id={`item-name-${selectedCat.id}`}
                                placeholder={`Add ${selectedCat.source} name e.g. "Elementalist Lux"`}
                                onKeyDown={e => {
                                  if (e.key !== 'Enter') return
                                  const val = e.target.value.trim()
                                  if (!val || selectedCat.items.some(i => i.name.toLowerCase()===val.toLowerCase())) return
                                  const tier = parseInt(document.getElementById(`item-tier-${selectedCat.id}`)?.value || '1')
                                  setNewGame(prev => ({ ...prev, dataLists: prev.dataLists.map(l => l.id===selectedCat.id ? {...l, items: [...l.items, {name: val, tier}]} : l) }))
                                  e.target.value = ''
                                }}
                                style={{ ...inputStyle, flex: 1, fontSize: '12px' }} />
                              <select id={`item-tier-${selectedCat.id}`} defaultValue="1"
                                style={{ ...inputStyle, fontSize: '12px', padding: '5px 6px', width: '65px' }}>
                                <option value="1">★</option>
                                <option value="2">★★</option>
                                <option value="3">★★★</option>
                              </select>
                              <button onClick={() => {
                                const input = document.getElementById(`item-name-${selectedCat.id}`)
                                const tierEl = document.getElementById(`item-tier-${selectedCat.id}`)
                                const val = input?.value.trim()
                                const tier = parseInt(tierEl?.value || '1')
                                if (!val || selectedCat.items.some(i => i.name.toLowerCase()===val.toLowerCase())) return
                                setNewGame(prev => ({ ...prev, dataLists: prev.dataLists.map(l => l.id===selectedCat.id ? {...l, items: [...l.items, {name: val, tier}]} : l) }))
                                if (input) input.value = ''
                              }} style={{ padding: '5px 10px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '12px' }}>Add</button>
                            </div>

                            {/* Data List Preview for selected category */}
                            <div>
                              <div style={{ fontSize: '11px', color: muted, marginBottom: '6px', fontWeight: '500' }}>
                                Data List Preview: {selectedCat.name} ({selectedCat.items.length} items)
                              </div>
                              {selectedCat.items.length === 0 ? (
                                <div style={{ fontSize: '12px', color: muted, fontStyle: 'italic' }}>No items yet — add above</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '200px', overflowY: 'auto' }}>
                                  {[...selectedCat.items]
                                    .sort((a,b) => (b.tier||1) - (a.tier||1))
                                    .map((item, idx) => (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: card, borderRadius: '6px' }}>
                                        <span style={{ color: '#e8a020', fontSize: '11px', minWidth: '28px' }}>{'★'.repeat(item.tier||1)}</span>
                                        <span style={{ fontSize: '12px', color: text, flex: 1 }}>{item.name}</span>
                                        <button onClick={() => setNewGame(prev => ({ ...prev, dataLists: prev.dataLists.map(l => l.id===selectedCat.id ? {...l, items: l.items.filter(i => i.name!==item.name)} : l) }))}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: '2px' }}><X size={10} /></button>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              <button onClick={handleSaveGame}
                style={{ width: '100%', padding: '12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                {editingGame ? 'Save Changes' : 'Add Game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Config Modal ────────────────────────────────────────── */}
      {showConfigModal && configGame && configSection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '540px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '20px 28px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>
                  {SECTIONS.find(s => s.key === configSection)?.emoji} {configGame.name} — {SECTIONS.find(s => s.key === configSection)?.label} Config
                </h2>
                <button onClick={() => setShowConfigModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
              </div>

              {/* Sub-tabs */}
              {(configSection === 'accounts' || configSection === 'offers') && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                  {configSection === 'accounts' && ['fields', 'summary', 'script'].map(tab => (
                    <button key={tab} onClick={() => setConfigData(prev => ({ ...prev, activeTab: tab }))}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: configData.activeTab === tab ? '#7E6551' : sectionBg, color: configData.activeTab === tab ? '#FDF4DC' : muted, fontWeight: configData.activeTab === tab ? '500' : '400' }}>
                      {tab === 'fields' ? 'Custom Fields' : tab === 'summary' ? 'Summary Fields' : 'Script'}
                    </button>
                  ))}
                  {configSection === 'offers' && ['direct', 'help', 'priority'].map(tab => (
                    <button key={tab} onClick={() => setConfigData(prev => ({ ...prev, activeTab: tab }))}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: configData.activeTab === tab ? '#7E6551' : sectionBg, color: configData.activeTab === tab ? '#FDF4DC' : muted, fontWeight: configData.activeTab === tab ? '500' : '400' }}>
                      {tab === 'direct' ? '💰 Sell Directly' : tab === 'help' ? '🤝 Help Selling' : '⭐ Priority Rules'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: '20px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* ── Accounts ── */}


              {configSection === 'accounts' && configData.activeTab === 'fields' && (
                <FieldEditor
                  fields={configData.customFields || []}
                  onFieldsChange={(newFields) => {
                    const removedIds = (configData.customFields || [])
                      .filter(f => !newFields.find(nf => nf.id === f.id)).map(f => f.id)
                    setConfigData(prev => ({
                      ...prev,
                      customFields: newFields,
                      summaryFields: (prev.summaryFields || []).filter(id => !removedIds.includes(id)),
                    }))
                  }}
                  border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
                  showTooltip={false} showVideoUrl={false}
                />
              )}
              {configSection === 'accounts' && configData.activeTab === 'summary' && (
                <div>
                  <div style={{ fontSize: '13px', color: muted, marginBottom: '12px' }}>Select up to 3 fields to show as summary on account cards.</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(configData.customFields || []).map(f => {
                      const selected = (configData.summaryFields || []).includes(f.id)
                      return (
                        <button key={f.id} onClick={() => toggleSummaryField(f.id)}
                          style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${selected ? '#7E6551' : border}`, background: selected ? '#7E6551' : 'transparent', color: selected ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {selected && <Check size={11} />}{f.label}
                        </button>
                      )
                    })}
                  </div>
                  {(configData.customFields || []).length === 0 && <div style={{ fontSize: '13px', color: muted }}>Add custom fields first.</div>}
                  <div style={{ fontSize: '11px', color: muted, marginTop: '8px' }}>{(configData.summaryFields || []).length}/3 selected</div>
                </div>
              )}
              {configSection === 'accounts' && configData.activeTab === 'script' && (
                <div>
                  <label style={labelStyle}>Script URL</label>
                  <input value={configData.scriptUrl || ''} onChange={e => setConfigData(prev => ({ ...prev, scriptUrl: e.target.value }))} placeholder="e.g. http://localhost:7432/lol/data" style={inputStyle} />
                  <div style={{ fontSize: '11px', color: muted, marginTop: '6px' }}>URL of the local script to run for this game when posting.</div>
                </div>
              )}

              {/* ── Offers ── */}
              {configSection === 'offers' && configData.activeTab === 'direct' && (
                <>
                  <div style={{ padding: '10px 14px', background: '#2196f311', borderRadius: '8px', border: '1px solid #2196f333', fontSize: '12px', color: '#2196f3' }}>
                    Fields shown when someone wants to sell directly to you.
                  </div>
                  <FieldEditor
                    fields={configData.directFields || []}
                    onFieldsChange={(newFields) => setConfigData(prev => ({ ...prev, directFields: newFields }))}
                    border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
                    showTooltip={true} showVideoUrl={true}
                  />
                </>
              )}
              {configSection === 'offers' && configData.activeTab === 'help' && (
                <>
                  <div style={{ padding: '10px 14px', background: '#9c27b011', borderRadius: '8px', border: '1px solid #9c27b033', fontSize: '12px', color: '#9c27b0' }}>
                    Fields shown when someone needs help selling their account.
                  </div>
                  <FieldEditor
                    fields={configData.helpFields || []}
                    onFieldsChange={(newFields) => setConfigData(prev => ({ ...prev, helpFields: newFields }))}
                    border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
                    showTooltip={true} showVideoUrl={true}
                  />
                </>
              )}
              {configSection === 'offers' && configData.activeTab === 'priority' && (
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
                        <label style={labelStyle}>Field to check</label>
                        <select value={configData.newRuleField || ''} onChange={e => setConfigData(prev => ({ ...prev, newRuleField: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                          <option value="">Select field...</option>
                          <option value="price">Price</option>
                          {(configData.directFields || []).filter(f => f.type === 'Number').map(f => (
                            <option key={f.id} value={f.label}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select value={configData.newRuleOperator || '>='} onChange={e => setConfigData(prev => ({ ...prev, newRuleOperator: e.target.value }))} style={{ ...inputStyle, width: '80px', flex: 'none', cursor: 'pointer' }}>
                          {['>=', '<=', '=', '>', '<'].map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                        <input type="number" value={configData.newRuleValue || ''} onChange={e => setConfigData(prev => ({ ...prev, newRuleValue: e.target.value }))} placeholder="Value" style={{ ...inputStyle, flex: 1 }} />
                        <select value={configData.newRulePriority || 'High'} onChange={e => setConfigData(prev => ({ ...prev, newRulePriority: e.target.value }))} style={{ ...inputStyle, width: '100px', flex: 'none', cursor: 'pointer' }}>
                          <option value="High">High</option>
                          <option value="Normal">Normal</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                      <button onClick={() => {
                        if (!configData.newRuleField || !configData.newRuleValue) return
                        const rule = { field: configData.newRuleField, operator: configData.newRuleOperator || '>=', value: configData.newRuleValue, priority: configData.newRulePriority || 'High' }
                        setConfigData(prev => ({ ...prev, priorityRules: [...(prev.priorityRules || []), rule], newRuleField: '', newRuleValue: '' }))
                      }} style={{ width: '100%', padding: '9px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Plus size={14} /> Add Rule
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ── Services ── */}
              {configSection === 'services' && (
                <>
                  {(configData.services || []).map(service => (
                    <div key={service.id} style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: configData.expandedService === service.id ? `1px solid ${border}` : 'none' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{service.name}</div>
                          <div style={{ fontSize: '11px', color: muted }}>{service.price ? `$${service.price}` : 'Price not set'} • {(service.suppliers || []).length} supplier(s)</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setConfigData(prev => ({ ...prev, expandedService: prev.expandedService === service.id ? null : service.id }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}>
                            {configData.expandedService === service.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button onClick={() => setConfigData(prev => ({ ...prev, services: prev.services.filter(s => s.id !== service.id) }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={14} /></button>
                        </div>
                      </div>
                      {configData.expandedService === service.id && (
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: '12px', color: muted, marginBottom: '8px' }}>Suppliers:</div>
                          {(service.suppliers || []).map((sup, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: bg, borderRadius: '6px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', color: text }}>{sup.name}</span>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {sup.link && <a href={sup.link} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2196f3' }}>Link</a>}
                                <button onClick={() => setConfigData(prev => ({ ...prev, services: prev.services.map(s => s.id === service.id ? { ...s, suppliers: s.suppliers.filter((_, idx) => idx !== j) } : s) }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={11} /></button>
                              </div>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <input value={configData.newSupplierName || ''} onChange={e => setConfigData(prev => ({ ...prev, newSupplierName: e.target.value }))} placeholder="Supplier name" style={{ ...inputStyle, flex: 1 }} />
                            <input value={configData.newSupplierLink || ''} onChange={e => setConfigData(prev => ({ ...prev, newSupplierLink: e.target.value }))} placeholder="Link (optional)" style={{ ...inputStyle, flex: 1 }} />
                            <button onClick={() => {
                              if (!configData.newSupplierName?.trim()) return
                              setConfigData(prev => ({ ...prev, services: prev.services.map(s => s.id === service.id ? { ...s, suppliers: [...(s.suppliers || []), { name: prev.newSupplierName, link: prev.newSupplierLink || '' }] } : s), newSupplierName: '', newSupplierLink: '' }))
                            }} style={{ padding: '9px 12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><Plus size={14} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}` }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '10px' }}>Add Service</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input value={configData.newServiceName || ''} onChange={e => setConfigData(prev => ({ ...prev, newServiceName: e.target.value }))} placeholder="Service name e.g. Diamond Boosting" style={inputStyle} />
                      <input value={configData.newServiceDescription || ''} onChange={e => setConfigData(prev => ({ ...prev, newServiceDescription: e.target.value }))} placeholder="Description (optional)" style={inputStyle} />
                      <input type="number" value={configData.newServicePrice || ''} onChange={e => setConfigData(prev => ({ ...prev, newServicePrice: e.target.value }))} placeholder="Price (USD)" style={inputStyle} />
                      <button onClick={() => {
                        if (!configData.newServiceName?.trim()) return
                        const service = { id: uid(), name: configData.newServiceName, description: configData.newServiceDescription || '', price: configData.newServicePrice || '', suppliers: [] }
                        setConfigData(prev => ({ ...prev, services: [...(prev.services || []), service], newServiceName: '', newServiceDescription: '', newServicePrice: '' }))
                      }} style={{ width: '100%', padding: '9px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Plus size={14} /> Add Service
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ── Gacha ── */}
              {configSection === 'gacha' && (
                <>
                  {(configData.groups || []).map(group => (
                    <div key={group.id} style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: configData.expandedGroup === group.id ? `1px solid ${border}` : 'none' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{group.name} <span style={{ color: muted, fontWeight: '400', fontSize: '11px' }}>({(group.products || []).length} products)</span></div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setConfigData(prev => ({ ...prev, expandedGroup: prev.expandedGroup === group.id ? null : group.id }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}>
                            {configData.expandedGroup === group.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button onClick={() => setConfigData(prev => ({ ...prev, groups: prev.groups.filter(g => g.id !== group.id) }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={14} /></button>
                        </div>
                      </div>
                      {configData.expandedGroup === group.id && (
                        <div style={{ padding: '12px 14px' }}>
                          {(group.products || []).map((prod, j) => (
                            <div key={j} style={{ padding: '8px 10px', background: bg, borderRadius: '6px', marginBottom: '4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: '500', color: text }}>{prod.title}</div>
                                <div style={{ fontSize: '11px', color: '#4caf50' }}>${prod.price}</div>
                                {(prod.suppliers || []).length > 0 && <div style={{ fontSize: '11px', color: muted }}>{prod.suppliers.map(s => s.name).join(', ')}</div>}
                              </div>
                              <button onClick={() => setConfigData(prev => ({ ...prev, groups: prev.groups.map(g => g.id === group.id ? { ...g, products: g.products.filter((_, idx) => idx !== j) } : g) }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={12} /></button>
                            </div>
                          ))}
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input value={configData.newProductTitle || ''} onChange={e => setConfigData(prev => ({ ...prev, newProductTitle: e.target.value }))} placeholder="Product title e.g. 80 Pulls" style={inputStyle} />
                            <input type="number" value={configData.newProductPrice || ''} onChange={e => setConfigData(prev => ({ ...prev, newProductPrice: e.target.value }))} placeholder="Price (USD)" style={inputStyle} />
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input value={configData.newSupplierName || ''} onChange={e => setConfigData(prev => ({ ...prev, newSupplierName: e.target.value }))} placeholder="Supplier name" style={{ ...inputStyle, flex: 1 }} />
                              <input value={configData.newSupplierLink || ''} onChange={e => setConfigData(prev => ({ ...prev, newSupplierLink: e.target.value }))} placeholder="Supplier link" style={{ ...inputStyle, flex: 1 }} />
                            </div>
                            <button onClick={() => {
                              if (!configData.newProductTitle?.trim()) return
                              const product = { title: configData.newProductTitle, price: configData.newProductPrice || '', suppliers: configData.newSupplierName ? [{ name: configData.newSupplierName, link: configData.newSupplierLink || '' }] : [] }
                              setConfigData(prev => ({ ...prev, groups: prev.groups.map(g => g.id === group.id ? { ...g, products: [...(g.products || []), product] } : g), newProductTitle: '', newProductPrice: '', newSupplierName: '', newSupplierLink: '' }))
                            }} style={{ width: '100%', padding: '8px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                              <Plus size={13} /> Add Product
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}` }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '8px' }}>Add Group</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input value={configData.newGroupName || ''} onChange={e => setConfigData(prev => ({ ...prev, newGroupName: e.target.value }))} placeholder="Group name e.g. NA Server" style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => {
                        if (!configData.newGroupName?.trim()) return
                        setConfigData(prev => ({ ...prev, groups: [...(prev.groups || []), { id: uid(), name: prev.newGroupName, products: [] }], newGroupName: '' }))
                      }} style={{ padding: '9px 14px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><Plus size={16} /></button>
                    </div>
                  </div>
                </>
              )}

              {/* ── Tools ── */}
              {configSection === 'tools' && (
                <>
                  <div>
                    <label style={labelStyle}>Platform</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['PC', 'iOS', 'Android'].map(p => (
                        <button key={p} onClick={() => setConfigData(prev => ({ ...prev, platform: p }))}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${configData.platform === p ? '#e8a020' : border}`, background: configData.platform === p ? '#e8a02022' : 'transparent', color: configData.platform === p ? '#e8a020' : muted, fontSize: '13px', cursor: 'pointer', fontWeight: configData.platform === p ? '500' : '400' }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Script URL</label>
                    <input value={configData.scriptUrl || ''} onChange={e => setConfigData(prev => ({ ...prev, scriptUrl: e.target.value }))} placeholder="Script or tool URL to run" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Instructions / Overview</label>
                    <textarea value={configData.instructions || ''} onChange={e => setConfigData(prev => ({ ...prev, instructions: e.target.value }))} placeholder="General instructions shown before steps..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Step-by-step Guide</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                      {(configData.steps || []).map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}` }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#e8a020', color: '#fff', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                          <span style={{ fontSize: '13px', color: text, flex: 1 }}>{step}</span>
                          <button onClick={() => setConfigData(prev => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== i) }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input value={configData.newStep || ''} onChange={e => setConfigData(prev => ({ ...prev, newStep: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && configData.newStep?.trim()) setConfigData(prev => ({ ...prev, steps: [...(prev.steps || []), prev.newStep.trim()], newStep: '' })) }}
                        placeholder="Add step..." style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => { if (configData.newStep?.trim()) setConfigData(prev => ({ ...prev, steps: [...(prev.steps || []), prev.newStep.trim()], newStep: '' })) }}
                        style={{ padding: '9px 14px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><Plus size={16} /></button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
              <button onClick={handleSaveConfig}
                style={{ width: '100%', padding: '12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

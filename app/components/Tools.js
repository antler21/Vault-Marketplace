'use client'
import { useState } from 'react'
import { ArrowLeft, Settings, Check, Play, Monitor, Smartphone, Plus, X } from 'lucide-react'

function ToolsConfigModal({ game, configData, setConfigData, onSave, onClose, card, border, text, muted, bg, inputBg, sectionBg }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
      <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '500px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>🔧 {game?.name} — Tools Config</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '8px' }}>Platform</label>
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
            <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Script / Tool URL</label>
            <input value={configData.scriptUrl || ''} onChange={e => setConfigData(prev => ({ ...prev, scriptUrl: e.target.value }))}
              placeholder="e.g. http://localhost:3001/tool"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '6px' }}>Instructions / Overview</label>
            <textarea value={configData.instructions || ''} onChange={e => setConfigData(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder="General instructions shown before steps..." rows={3}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '8px' }}>Step-by-Step Guide</label>
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
                placeholder="Add step..." style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
              <button onClick={() => { if (configData.newStep?.trim()) setConfigData(prev => ({ ...prev, steps: [...(prev.steps || []), prev.newStep.trim()], newStep: '' })) }}
                style={{ padding: '9px 14px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><Plus size={16} /></button>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <button onClick={onSave} style={{ width: '100%', padding: '11px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Tools({ darkMode, games, gameConfigs, saveGameConfig }) {
  const [selectedGame, setSelectedGame] = useState(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configuringGame, setConfiguringGame] = useState(null)
  const [configData, setConfigData] = useState({})

  const card = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text = darkMode ? '#FDF4DC' : '#151515'
  const muted = darkMode ? '#a08570' : '#7E6551'
  const bg = darkMode ? '#151515' : '#FDF4DC'
  const inputBg = darkMode ? '#2a2a2a' : '#fff'
  const sectionBg = darkMode ? '#252525' : '#f9f4ea'

  const toolGames = games.filter(g => (g.sections || []).includes('tools'))

  const getConfig = (gameId) => {
    const config = gameConfigs.find(c => c.game_id === gameId && c.section === 'tools')
    return config?.config || null
  }

  const openConfigModal = (game, e) => {
    if (e) e.stopPropagation()
    const existing = getConfig(game.id)
    setConfiguringGame(game)
    setConfigData({ platform: existing?.platform || 'PC', scriptUrl: existing?.scriptUrl || '', instructions: existing?.instructions || '', steps: existing?.steps || [], newStep: '' })
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    if (!configuringGame) return
    await saveGameConfig(configuringGame.id, 'tools', { platform: configData.platform, scriptUrl: configData.scriptUrl, instructions: configData.instructions, steps: configData.steps })
    setShowConfigModal(false)
    setConfiguringGame(null)
  }

  const getPlatformIcon = (platform) => platform === 'iOS' || platform === 'Android' ? <Smartphone size={14} color={muted} /> : <Monitor size={14} color={muted} />

  if (!selectedGame) {
    return (
      <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Tools</h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>Select a game to access its tools</p>
        </div>
        {toolGames.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🔧</span>
            <div style={{ fontSize: '17px', fontWeight: '600', color: text, marginBottom: '8px' }}>No games found</div>
            <div style={{ fontSize: '13px', color: muted }}>Add a game and enable the Tools section first</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {toolGames.map(game => {
              const config = getConfig(game.id)
              return (
                <div key={game.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                  <button onClick={e => openConfigModal(game, e)} title="Configure tool"
                    style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}>
                    <Settings size={13} />
                  </button>
                  <div onClick={() => setSelectedGame(game)} style={{ cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '100px', background: game.image ? `url(${game.image}) center/cover no-repeat` : '#e8a02022', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!game.image && <span style={{ fontSize: '32px' }}>🔧</span>}
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>{game.name}</div>
                      {config ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4caf50' }}>
                          {getPlatformIcon(config.platform)}
                          <Check size={11} color="#4caf50" /> {config.platform} • {(config.steps || []).length} steps
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#e8a020', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Settings size={10} /> Configure tool first
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {showConfigModal && configuringGame && (
          <ToolsConfigModal game={configuringGame} configData={configData} setConfigData={setConfigData} onSave={handleSaveConfig} onClose={() => setShowConfigModal(false)} card={card} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg} />
        )}
      </div>
    )
  }

  const config = getConfig(selectedGame.id)

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
      <button onClick={() => setSelectedGame(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '13px', marginBottom: '24px', padding: 0 }}>
        <ArrowLeft size={15} /> Back to Games
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: selectedGame.image ? `url(${selectedGame.image}) center/cover no-repeat` : '#e8a02022', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!selectedGame.image && <span>🔧</span>}
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>{selectedGame.name}</h1>
            {config && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: muted, marginTop: '2px' }}>{getPlatformIcon(config.platform)} {config.platform}</div>}
          </div>
        </div>
        <button onClick={e => openConfigModal(selectedGame, e)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', cursor: 'pointer', fontSize: '14px' }}>
          <Settings size={15} /> Config
        </button>
      </div>

      {!config ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: card, borderRadius: '12px', border: `1px solid ${border}` }}>
          <Settings size={36} color={muted} style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>Not configured yet</div>
          <div style={{ fontSize: '13px', color: muted }}>Click Config to set up this tool</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {config.instructions && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: text, marginBottom: '10px' }}>Overview</div>
              <div style={{ fontSize: '13px', color: muted, lineHeight: 1.7 }}>{config.instructions}</div>
            </div>
          )}
          {config.scriptUrl && (
            <div style={{ background: card, border: `1px solid #e8a02044`, borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: text, marginBottom: '4px' }}>Launch Tool</div>
                <div style={{ fontSize: '12px', color: muted }}>{config.scriptUrl}</div>
              </div>
              <a href={config.scriptUrl} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#e8a020', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                <Play size={14} /> Launch
              </a>
            </div>
          )}
          {(config.steps || []).length > 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: text, marginBottom: '16px' }}>Step-by-Step Guide</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {config.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '12px 14px', background: sectionBg, borderRadius: '10px', border: `1px solid ${border}` }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#e8a020', color: '#fff', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: '14px', color: text, lineHeight: 1.6, paddingTop: '3px' }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showConfigModal && configuringGame && (
        <ToolsConfigModal game={configuringGame} configData={configData} setConfigData={setConfigData} onSave={handleSaveConfig} onClose={() => setShowConfigModal(false)} card={card} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg} />
      )}
    </div>
  )
}
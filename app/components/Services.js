'use client'
import { useState } from 'react'
import { ArrowLeft, Gamepad2, Settings, Check, ExternalLink, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

function ServicesConfigModal({ game, configData, setConfigData, onSave, onClose, card, border, text, muted, bg, inputBg, sectionBg }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
      <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '500px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>⚡ {game?.name} — Services Config</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(configData.services || []).map(service => (
            <div key={service.id} style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${border}` }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{service.name}</div>
                  <div style={{ fontSize: '11px', color: muted }}>{service.price ? `$${service.price}` : 'No price'} • {(service.suppliers || []).length} supplier(s)</div>
                </div>
                <button onClick={() => setConfigData(prev => ({ ...prev, services: prev.services.filter(s => s.id !== service.id) }))}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={14} /></button>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', color: muted, marginBottom: '8px' }}>Suppliers:</div>
                {(service.suppliers || []).map((sup, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: bg, borderRadius: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: text }}>{sup.name}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {sup.link && <a href={sup.link} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2196f3' }}>Link</a>}
                      <button onClick={() => setConfigData(prev => ({ ...prev, services: prev.services.map(s => s.id === service.id ? { ...s, suppliers: s.suppliers.filter((_, idx) => idx !== j) } : s) }))}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={11} /></button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <input value={configData.newSupplierName || ''} onChange={e => setConfigData(prev => ({ ...prev, newSupplierName: e.target.value }))}
                    placeholder="Supplier name" style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
                  <input value={configData.newSupplierLink || ''} onChange={e => setConfigData(prev => ({ ...prev, newSupplierLink: e.target.value }))}
                    placeholder="Link (optional)" style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }} />
                  <button onClick={() => {
                    if (!configData.newSupplierName?.trim()) return
                    setConfigData(prev => ({ ...prev, services: prev.services.map(s => s.id === service.id ? { ...s, suppliers: [...(s.suppliers || []), { name: prev.newSupplierName, link: prev.newSupplierLink || '' }] } : s), newSupplierName: '', newSupplierLink: '' }))
                  }} style={{ padding: '7px 12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><Plus size={14} /></button>
                </div>
              </div>
            </div>
          ))}

          <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}` }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '10px' }}>Add Service</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input value={configData.newServiceName || ''} onChange={e => setConfigData(prev => ({ ...prev, newServiceName: e.target.value }))}
                placeholder="Service name e.g. Diamond Boosting"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
              <input value={configData.newServiceDescription || ''} onChange={e => setConfigData(prev => ({ ...prev, newServiceDescription: e.target.value }))}
                placeholder="Description (optional)"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
              <input type="number" value={configData.newServicePrice || ''} onChange={e => setConfigData(prev => ({ ...prev, newServicePrice: e.target.value }))}
                placeholder="Price (USD)"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }} />
              <button onClick={() => {
                if (!configData.newServiceName?.trim()) return
                setConfigData(prev => ({ ...prev, services: [...(prev.services || []), { id: uid(), name: prev.newServiceName, description: prev.newServiceDescription || '', price: prev.newServicePrice || '', suppliers: [] }], newServiceName: '', newServiceDescription: '', newServicePrice: '' }))
              }}
                style={{ width: '100%', padding: '9px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Plus size={14} /> Add Service
              </button>
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

export default function Services({ darkMode, games, gameConfigs, saveGameConfig }) {
  const [selectedGame, setSelectedGame] = useState(null)
  const [expandedService, setExpandedService] = useState(null)
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

  const serviceGames = games.filter(g => (g.sections || []).includes('services'))

  const getConfig = (gameId) => {
    const config = gameConfigs.find(c => c.game_id === gameId && c.section === 'services')
    return config?.config || { services: [] }
  }

  const isConfigured = (gameId) => (getConfig(gameId).services || []).length > 0

  const openConfigModal = (game, e) => {
    if (e) e.stopPropagation()
    const existing = getConfig(game.id)
    setConfiguringGame(game)
    setConfigData({ services: existing.services || [], newServiceName: '', newServiceDescription: '', newServicePrice: '', newSupplierName: '', newSupplierLink: '' })
    setShowConfigModal(true)
  }

  const handleSaveConfig = async () => {
    if (!configuringGame) return
    await saveGameConfig(configuringGame.id, 'services', { services: configData.services })
    setShowConfigModal(false)
    setConfiguringGame(null)
  }

  if (!selectedGame) {
    return (
      <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Services</h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>Select a game to view its services</p>
        </div>
        {serviceGames.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>⚡</span>
            <div style={{ fontSize: '17px', fontWeight: '600', color: text, marginBottom: '8px' }}>No games found</div>
            <div style={{ fontSize: '13px', color: muted }}>Add a game and enable the Services section first</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {serviceGames.map(game => {
              const config = getConfig(game.id)
              const serviceCount = (config.services || []).length
              return (
                <div key={game.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                  <button onClick={e => openConfigModal(game, e)} title="Configure services"
                    style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}>
                    <Settings size={13} />
                  </button>
                  <div onClick={() => setSelectedGame(game)} style={{ cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: '100px', background: game.image ? `url(${game.image}) center/cover no-repeat` : '#9c27b022', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!game.image && <span style={{ fontSize: '32px' }}>⚡</span>}
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>{game.name}</div>
                      {isConfigured(game.id) ? (
                        <div style={{ fontSize: '11px', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={10} /> {serviceCount} service{serviceCount !== 1 ? 's' : ''} configured
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#e8a020', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Settings size={10} /> Configure services first
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
          <ServicesConfigModal game={configuringGame} configData={configData} setConfigData={setConfigData} onSave={handleSaveConfig} onClose={() => setShowConfigModal(false)} card={card} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg} />
        )}
      </div>
    )
  }

  const config = getConfig(selectedGame.id)
  const services = config.services || []

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
      <button onClick={() => setSelectedGame(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '13px', marginBottom: '24px', padding: 0 }}>
        <ArrowLeft size={15} /> Back to Games
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: selectedGame.image ? `url(${selectedGame.image}) center/cover no-repeat` : '#9c27b022', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!selectedGame.image && <span>⚡</span>}
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>{selectedGame.name}</h1>
            <p style={{ fontSize: '13px', color: muted, marginTop: '2px' }}>{services.length} services</p>
          </div>
        </div>
        <button onClick={e => openConfigModal(selectedGame, e)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '10px', cursor: 'pointer', fontSize: '14px' }}>
          <Settings size={15} /> Config
        </button>
      </div>

      {services.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: card, borderRadius: '12px', border: `1px solid ${border}` }}>
          <Settings size={36} color={muted} style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>No services configured</div>
          <div style={{ fontSize: '13px', color: muted }}>Click Config to add services</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {services.map(service => (
            <div key={service.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: text }}>{service.name}</div>
                    {service.price && <span style={{ fontSize: '12px', padding: '2px 10px', background: '#4caf5022', color: '#4caf50', borderRadius: '20px', fontWeight: '500' }}>${service.price}</span>}
                  </div>
                  {service.description && <div style={{ fontSize: '13px', color: muted }}>{service.description}</div>}
                  {(service.suppliers || []).length > 0 && <div style={{ fontSize: '12px', color: muted, marginTop: '4px' }}>{service.suppliers.length} supplier{service.suppliers.length !== 1 ? 's' : ''}</div>}
                </div>
                {(service.suppliers || []).length > 0 && (
                  <button onClick={() => setExpandedService(expandedService === service.id ? null : service.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}>
                    {expandedService === service.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
              </div>
              {expandedService === service.id && (
                <div style={{ padding: '0 20px 16px', borderTop: `1px solid ${border}`, paddingTop: '14px' }}>
                  <div style={{ fontSize: '12px', color: muted, marginBottom: '8px' }}>Suppliers</div>
                  {service.suppliers.map((sup, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: bg, borderRadius: '8px', border: `1px solid ${border}`, marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: text }}>{sup.name}</span>
                      {sup.link && <a href={sup.link} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2196f3', textDecoration: 'none' }}><ExternalLink size={12} /> Visit</a>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showConfigModal && configuringGame && (
        <ServicesConfigModal game={configuringGame} configData={configData} setConfigData={setConfigData} onSave={handleSaveConfig} onClose={() => setShowConfigModal(false)} card={card} border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg} />
      )}
    </div>
  )
}
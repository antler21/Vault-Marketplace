'use client'
import { useState } from 'react'
import { ArrowLeft, Gamepad2, Settings, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

export default function GachaAccounts({ darkMode, games, gameConfigs }) {
  const [selectedGame, setSelectedGame] = useState(null)
  const [expandedGroup, setExpandedGroup] = useState(null)

  const card = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text = darkMode ? '#FDF4DC' : '#151515'
  const muted = darkMode ? '#a08570' : '#7E6551'
  const bg = darkMode ? '#151515' : '#FDF4DC'

  const gachaGames = games.filter(g => (g.sections || []).includes('gacha'))

  const getConfig = (gameId) => {
    const config = gameConfigs.find(c => c.game_id === gameId && c.section === 'gacha')
    return config?.config || { groups: [] }
  }

  if (!selectedGame) {
    return (
      <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Gacha Accounts</h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>Select a game to view its gacha products</p>
        </div>
        {gachaGames.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🎰</span>
            <div style={{ fontSize: '17px', fontWeight: '600', color: text, marginBottom: '8px' }}>No games found</div>
            <div style={{ fontSize: '13px', color: muted }}>Add a game and enable the Gacha section first</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {gachaGames.map(game => {
              const config = getConfig(game.id)
              const groupCount = (config.groups || []).length
              const productCount = (config.groups || []).reduce((sum, g) => sum + (g.products || []).length, 0)
              return (
                <div key={game.id} onClick={() => setSelectedGame(game)}
                  style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{ width: '100%', height: '100px', background: game.image ? `url(${game.image}) center/cover no-repeat` : '#e0525222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!game.image && <span style={{ fontSize: '32px' }}>🎰</span>}
                  </div>
                  <div style={{ padding: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>{game.name}</div>
                    {groupCount > 0 ? (
                      <div style={{ fontSize: '12px', color: '#e05252', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={11} /> {groupCount} group{groupCount !== 1 ? 's' : ''} • {productCount} products
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Settings size={10} /> Not configured yet
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const config = getConfig(selectedGame.id)
  const groups = config.groups || []

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
      <button onClick={() => setSelectedGame(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '13px', marginBottom: '24px', padding: 0 }}>
        <ArrowLeft size={15} /> Back to Games
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: selectedGame.image ? `url(${selectedGame.image}) center/cover no-repeat` : '#e0525222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!selectedGame.image && <span>🎰</span>}
        </div>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>{selectedGame.name}</h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '2px' }}>{groups.length} groups</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: card, borderRadius: '12px', border: `1px solid ${border}` }}>
          <Settings size={36} color={muted} style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: '600', color: text, marginBottom: '6px' }}>No groups configured</div>
          <div style={{ fontSize: '13px', color: muted }}>Go to Games → {selectedGame.name} → Gacha gear icon to configure groups and products</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {groups.map(group => (
            <div key={group.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: expandedGroup === group.id ? `1px solid ${border}` : 'none' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: text }}>{group.name}</div>
                  <div style={{ fontSize: '12px', color: muted, marginTop: '2px' }}>{(group.products || []).length} products</div>
                </div>
                <button onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}>
                  {expandedGroup === group.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              {expandedGroup === group.id && (
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(group.products || []).map((product, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}` }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: text }}>{product.title}</div>
                        {(product.suppliers || []).length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {product.suppliers.map((sup, j) => (
                              <span key={j} style={{ fontSize: '11px', color: muted, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                {sup.link ? (
                                  <a href={sup.link} target="_blank" rel="noreferrer" style={{ color: '#2196f3', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <ExternalLink size={10} /> {sup.name}
                                  </a>
                                ) : sup.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#4caf50' }}>${product.price}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
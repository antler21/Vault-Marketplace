'use client'
import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Games from './components/Games'
import Accounts from './components/Accounts'
import Platforms from './components/Platforms'
import Orders from './components/Orders'
import Posting from './components/Posting'
import Settings from './components/Settings'
import Offers from './components/Offers'
import Services from './components/Services'
import GachaAccounts from './components/GachaAccounts'
import Tools from './components/Tools'
import { getExchangeRates } from './lib/currency'
import { Sun, Moon, RefreshCw } from 'lucide-react'

const CURRENCIES = [
  { symbol: '$', label: 'USD' }, { symbol: '€', label: 'EUR' }, { symbol: '£', label: 'GBP' },
  { symbol: '₱', label: 'PHP' }, { symbol: 'S$', label: 'SGD' }, { symbol: 'A$', label: 'AUD' },
  { symbol: 'C$', label: 'CAD' }, { symbol: '¥', label: 'JPY' }, { symbol: '₩', label: 'KRW' },
  { symbol: 'R$', label: 'BRL' }, { symbol: 'MYR', label: 'MYR' }, { symbol: '฿', label: 'THB' },
]

export default function Home() {
  const [activePage, setActivePageState] = useState('Dashboard')
  const [darkMode, setDarkMode] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [games, setGamesState] = useState([])
  const [gameConfigs, setGameConfigsState] = useState([])
  const [accounts, setAccountsState] = useState([])
  const [platforms, setPlatformsState] = useState([])
  const [orders, setOrdersState] = useState([])
  const [offers, setOffersState] = useState([])
  const [removalTasks, setRemovalTasksState] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currency, setCurrencyState] = useState('$')
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [exchangeRates, setExchangeRates] = useState(null)
  const [orderNotificationCount, setOrderNotificationCount] = useState(0)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(10)
  const [profileName, setProfileName] = useState('Admin')
  const [defaultDateFilter, setDefaultDateFilter] = useState('all')
  const [toolImportScanId, setToolImportScanId] = useState(null)

  const bg = darkMode ? '#151515' : '#FDF4DC'
  const border = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text = darkMode ? '#FDF4DC' : '#151515'
  const muted = darkMode ? '#a08570' : '#7E6551'
  const card = darkMode ? '#1e1e1e' : '#fff'
  const sidebarWidth = collapsed ? '70px' : '240px'

  const setActivePage = (page) => {
    setActivePageState(page)
    localStorage.setItem('activePage', page)
    if (page === 'Orders') setOrderNotificationCount(0)
  }

  const setCurrency = (symbol) => {
    setCurrencyState(symbol)
    localStorage.setItem('currency', symbol)
    setShowCurrencyPicker(false)
  }

  useEffect(() => {
    const savedPage = localStorage.getItem('activePage')
    if (savedPage) setActivePageState(savedPage)
    const savedCurrency = localStorage.getItem('currency')
    if (savedCurrency) setCurrencyState(savedCurrency)
    const savedInterval = localStorage.getItem('autoRefreshInterval')
    if (savedInterval) setAutoRefreshInterval(parseInt(savedInterval))
    const savedName = localStorage.getItem('profileName')
    if (savedName) setProfileName(savedName)
    const savedDateFilter = localStorage.getItem('defaultDateFilter')
    if (savedDateFilter) setDefaultDateFilter(savedDateFilter)
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmailConnected')) {
      setActivePageState('Orders')
      localStorage.setItem('activePage', 'Orders')
      window.history.replaceState({}, '', '/')
      localStorage.setItem('gmailJustConnected', 'true')
    }
    const toolScanId = params.get('toolImport')
    if (toolScanId) {
      setToolImportScanId(toolScanId)
      setActivePageState('Accounts')
      localStorage.setItem('activePage', 'Accounts')
      window.history.replaceState({}, '', '/')
    }
    if (params.get('gmailError')) {
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    else setRefreshing(true)
    try {
      const [gamesRes, configsRes, accountsRes, platformsRes, ordersRes, offersRes, removalRes, rates] = await Promise.all([
        fetch('/api/games'),
        fetch('/api/game-configs'),
        fetch('/api/accounts'),
        fetch('/api/platforms'),
        fetch('/api/orders'),
        fetch('/api/offers'),
        fetch('/api/removal-tasks'),
        getExchangeRates('USD'),
      ])
      const gamesData = await gamesRes.json()
      const configsData = await configsRes.json()
      const accountsData = await accountsRes.json()
      const platformsData = await platformsRes.json()
      const ordersData = await ordersRes.json()
      const offersData = await offersRes.json()
      const removalData = await removalRes.json()

      if (rates) setExchangeRates(rates)
      setGamesState(Array.isArray(gamesData) ? gamesData.map(g => ({ id: g.id, name: g.name, image: g.image || '', sections: g.sections || [], allowedPlatformIds: g.allowed_platform_ids || [], titleCharLimit: g.title_char_limit || null, dataLists: g.data_lists || [], scriptEnabled: g.script_enabled || false, scriptSections: g.script_sections || [], scannerType: g.scanner_type || null })) : [])
      setGameConfigsState(Array.isArray(configsData) ? configsData : [])
      setAccountsState(Array.isArray(accountsData) ? accountsData.map(normalizeAccountRaw) : [])
      setPlatformsState(Array.isArray(platformsData) ? platformsData.map(normalizePlatformRaw) : [])
      setOrdersState(Array.isArray(ordersData) ? ordersData : [])
      setOffersState(Array.isArray(offersData) ? offersData : [])
      setRemovalTasksState(Array.isArray(removalData) ? removalData : [])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const normalizeAccountRaw = (a) => ({
    id: a.id, gameId: a.game_id, title: a.title || '', description: a.description || '', status: a.status,
    fields: a.fields || {}, images: a.images || [], thumbnailIndex: a.thumbnail_index || 0,
    boughtFor: a.bought_for || 0, soldFor: a.sold_for || 0,
    boughtForCurrency: a.bought_for_currency || 'USD', soldForCurrency: a.sold_for_currency || 'USD',
    targetPlatforms: a.target_platforms || [], postingPriority: a.posting_priority || 0,
    soldOnPlatform: a.sold_on_platform || '', createdAt: a.created_at?.split('T')[0] || '',
  })

  const normalizePlatformRaw = (p) => ({
    id: p.id, name: p.name, url: p.url || '', image: p.image || '',
    globalFields: p.global_fields || [], gameTemplates: p.game_templates || [],
    emailSender: p.email_sender || '', emailParsingRules: p.email_parsing_rules || {},
    titleRules: p.title_rules || {},
    enabledSections: p.enabled_sections || {},
    feePercentage: p.fee_percentage || 0, feeFixed: p.fee_fixed || 0, holdingDays: p.holding_days || 0,
  })

  const addGame = async (game) => {
    try {
      const res = await fetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(game) })
      const saved = await res.json()
      if (saved.error) return
      setGamesState(prev => [...prev, { id: saved.id, name: saved.name, image: saved.image || '', sections: saved.sections || [], allowedPlatformIds: saved.allowed_platform_ids || [], titleCharLimit: saved.title_char_limit || null, dataLists: saved.data_lists || [], scriptEnabled: saved.script_enabled || false, scriptSections: saved.script_sections || [], scannerType: saved.scanner_type || null }])
    } catch (err) { console.error(err) }
  }

  const updateGame = async (game) => {
    try {
      const res = await fetch(`/api/games/${game.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(game) })
      const saved = await res.json()
      if (saved.error) return
      setGamesState(prev => prev.map(g => g.id === saved.id ? { id: saved.id, name: saved.name, image: saved.image || '', sections: saved.sections || [], allowedPlatformIds: saved.allowed_platform_ids || [], titleCharLimit: saved.title_char_limit || null, dataLists: saved.data_lists || [], scriptEnabled: saved.script_enabled || false, scriptSections: saved.script_sections || [], scannerType: saved.scanner_type || null } : g))
    } catch (err) { console.error(err) }
  }

  const deleteGame = async (id) => {
    try {
      await fetch(`/api/games/${id}`, { method: 'DELETE' })
      setGamesState(prev => prev.filter(g => g.id !== id))
      setGameConfigsState(prev => prev.filter(c => c.game_id !== id))
    } catch (err) { console.error(err) }
  }

  const saveGameConfig = async (gameId, section, config) => {
    try {
      const res = await fetch('/api/game-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, section, config }),
      })
      const saved = await res.json()
      if (saved.error) return
      setGameConfigsState(prev => {
        const exists = prev.find(c => c.game_id === gameId && c.section === section)
        if (exists) return prev.map(c => c.game_id === gameId && c.section === section ? { ...c, config } : c)
        return [...prev, { id: saved.id, game_id: gameId, section, config }]
      })
    } catch (err) { console.error(err) }
  }

  const addAccount = async (account) => {
    try {
      const res = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account) })
      const saved = await res.json()
      if (saved.error) return null
      setAccountsState(prev => [...prev, normalizeAccountRaw(saved)])
      return saved
    } catch (err) { console.error(err); return null }
  }

  const updateAccount = async (account) => {
    try {
      const res = await fetch(`/api/accounts/${account.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account) })
      const saved = await res.json()
      if (saved.error) { console.error('updateAccount error:', saved.error); return }
      setAccountsState(prev => prev.map(a => a.id === saved.id ? normalizeAccountRaw(saved) : a))
    } catch (err) { console.error('updateAccount exception:', err) }
  }

  const deleteAccount = async (id) => {
    try {
      await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      setAccountsState(prev => prev.filter(a => a.id !== id))
    } catch (err) { console.error(err) }
  }

  const bulkAddAccounts = (newAccounts) => setAccountsState(prev => [...prev, ...newAccounts])

  const addPlatform = async (platform) => {
    try {
      const res = await fetch('/api/platforms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(platform) })
      const saved = await res.json()
      if (saved.error) return
      setPlatformsState(prev => [...prev, normalizePlatformRaw(saved)])
    } catch (err) { console.error(err) }
  }

  const updatePlatform = async (platform) => {
    try {
      const res = await fetch(`/api/platforms/${platform.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(platform) })
      const saved = await res.json()
      if (saved.error) return
      setPlatformsState(prev => prev.map(p => p.id === saved.id ? normalizePlatformRaw(saved) : p))
    } catch (err) { console.error(err) }
  }

  const deletePlatform = async (id) => {
    try {
      await fetch(`/api/platforms/${id}`, { method: 'DELETE' })
      setPlatformsState(prev => prev.filter(p => p.id !== id))
    } catch (err) { console.error(err) }
  }

  const handleRemovalTaskDone = async (taskId) => {
    try {
      await fetch(`/api/removal-tasks/${taskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Done' }) })
      setRemovalTasksState(prev => prev.filter(t => t.id !== taskId))
    } catch (err) { console.error(err) }
  }

  const handleRemovalTaskCreated = (task) => setRemovalTasksState(prev => [...prev, task])

  const renderPage = () => {
    if (loading) {
      return (
        <div style={{ padding: '32px', minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', border: `3px solid ${border}`, borderTop: `3px solid #7E6551`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '14px', color: muted }}>Loading...</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )
    }

    switch (activePage) {
      case 'Dashboard':
        return <Dashboard darkMode={darkMode} games={games} accounts={accounts} platforms={platforms} currency={currency} exchangeRates={exchangeRates} removalTasks={removalTasks} onRemovalTaskDone={handleRemovalTaskDone} setActivePage={setActivePage} defaultDateFilter={defaultDateFilter} />
      case 'Games':
        return <Games darkMode={darkMode} games={games} gameConfigs={gameConfigs} platforms={platforms} addGame={addGame} updateGame={updateGame} deleteGame={deleteGame} saveGameConfig={saveGameConfig} />
      case 'Accounts':
        return <Accounts darkMode={darkMode} games={games} gameConfigs={gameConfigs} accounts={accounts} platforms={platforms} addAccount={addAccount} updateAccount={updateAccount} deleteAccount={deleteAccount} bulkAddAccounts={bulkAddAccounts} setActivePage={setActivePage} currency={currency} exchangeRates={exchangeRates} saveGameConfig={saveGameConfig} toolImportScanId={toolImportScanId} onToolImportDone={() => setToolImportScanId(null)} />
      case 'Platforms':
        return <Platforms darkMode={darkMode} platforms={platforms} games={games} gameConfigs={gameConfigs} addPlatform={addPlatform} updatePlatform={updatePlatform} deletePlatform={deletePlatform} />
      case 'Orders':
        return <Orders darkMode={darkMode} accounts={accounts} games={games} platforms={platforms} updateAccount={updateAccount} currency={currency} exchangeRates={exchangeRates} onNewOrders={(count) => setOrderNotificationCount(prev => prev + count)} autoRefreshInterval={autoRefreshInterval} onRemovalTaskCreated={handleRemovalTaskCreated} />
      case 'Offers':
        return <Offers darkMode={darkMode} games={games} gameConfigs={gameConfigs} saveGameConfig={saveGameConfig} />
      case 'Posting':
        return <Posting darkMode={darkMode} accounts={accounts} games={games} gameConfigs={gameConfigs} platforms={platforms} updateAccount={updateAccount} saveGameConfig={saveGameConfig} />
      case 'Services':
        return <Services darkMode={darkMode} games={games} gameConfigs={gameConfigs} saveGameConfig={saveGameConfig} />
      case 'Gacha Accounts':
        return <GachaAccounts darkMode={darkMode} games={games} gameConfigs={gameConfigs} />
      case 'Tools':
        return <Tools darkMode={darkMode} games={games} gameConfigs={gameConfigs} saveGameConfig={saveGameConfig} />
      case 'Settings':
        return <Settings darkMode={darkMode} setDarkMode={setDarkMode} currency={currency} setCurrency={setCurrency} autoRefreshInterval={autoRefreshInterval} setAutoRefreshInterval={setAutoRefreshInterval} profileName={profileName} setProfileName={setProfileName} defaultDateFilter={defaultDateFilter} setDefaultDateFilter={setDefaultDateFilter} />
      default:
        return (
          <div style={{ padding: '32px', minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚧</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: text }}>{activePage}</div>
              <div style={{ fontSize: '13px', color: muted, marginTop: '6px' }}>This page is coming soon</div>
            </div>
          </div>
        )
    }
  }

  return (
    <div style={{ display: 'flex', background: bg, minHeight: '100vh' }}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} darkMode={darkMode} collapsed={collapsed} setCollapsed={setCollapsed} orderNotificationCount={orderNotificationCount} profileName={profileName} />
      <div style={{ marginLeft: sidebarWidth, flex: 1, transition: 'margin-left 0.3s ease', minWidth: 0 }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: bg, borderBottom: `1px solid ${border}`, padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span suppressHydrationWarning style={{ fontSize: '14px', color: muted }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                style={{ background: 'transparent', border: `1px solid ${border}`, borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: muted, fontSize: '13px', fontWeight: '500' }}>
                {currency}
              </button>
              {showCurrencyPicker && (
                <div style={{ position: 'absolute', top: '40px', right: 0, background: card, border: `1px solid ${border}`, borderRadius: '12px', padding: '8px', zIndex: 100, minWidth: '160px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                  {CURRENCIES.map(c => (
                    <button key={c.symbol} onClick={() => setCurrency(c.symbol)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: currency === c.symbol ? '#7E655122' : 'transparent', color: currency === c.symbol ? '#7E6551' : text, fontSize: '13px' }}>
                      <span style={{ fontWeight: '500' }}>{c.symbol}</span>
                      <span style={{ color: muted, fontSize: '12px' }}>{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => loadData(false)}
              style={{ background: 'transparent', border: `1px solid ${border}`, borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: muted, display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={16} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
            <button onClick={() => setDarkMode(!darkMode)}
              style={{ background: 'transparent', border: `1px solid ${border}`, borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: muted, display: 'flex', alignItems: 'center' }}>
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        {renderPage()}
      </div>
    </div>
  )
}
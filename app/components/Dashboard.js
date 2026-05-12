'use client'
import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Users, AlertCircle, XCircle, FileText, ChevronLeft, ChevronRight, Globe, Target, Calendar, CheckCircle, X, ArrowRight, Eye } from 'lucide-react'
import { convertAmount } from '../lib/currency'

const CURRENCY_CODES = {
  '$': 'USD', '€': 'EUR', '£': 'GBP', '₱': 'PHP',
  'S$': 'SGD', 'A$': 'AUD', 'C$': 'CAD', '¥': 'JPY',
  '₩': 'KRW', 'R$': 'BRL', 'MYR': 'MYR', '฿': 'THB'
}

const graphs = ['Profit', 'Account Activity', 'Recent Activity']

const DATE_PRESETS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
  { label: 'Custom', value: 'custom' },
]

function getDateRange(preset, customFrom, customTo) {
  const now = new Date()
  switch (preset) {
    case 'today': return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now }
    case '7days': return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now }
    case 'month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
    case 'year': return { start: new Date(now.getFullYear(), 0, 1), end: now }
    case 'custom': return { start: customFrom ? new Date(customFrom) : null, end: customTo ? new Date(customTo) : null }
    default: return { start: null, end: null }
  }
}

function calcNetAmount(grossAmount, platform) {
  if (!platform) return grossAmount
  const fee = (grossAmount * (parseFloat(platform.feePercentage) || 0) / 100) + (parseFloat(platform.feeFixed) || 0)
  return grossAmount - fee
}

export default function Dashboard({ darkMode, games, accounts, platforms, currency, exchangeRates, removalTasks, onRemovalTaskDone, setActivePage, defaultDateFilter }) {
  const [profitFilter, setProfitFilter] = useState('month')
  const [graphIndex, setGraphIndex] = useState(0)
  const [datePreset, setDatePreset] = useState(defaultDateFilter || 'all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [drillDown, setDrillDown] = useState(null)

  const card = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text = darkMode ? '#FDF4DC' : '#151515'
  const muted = darkMode ? '#a08570' : '#7E6551'
  const bg = darkMode ? '#151515' : '#FDF4DC'
  const inputBg = darkMode ? '#2a2a2a' : '#fff'
  const cur = currency || '$'
  const curCode = CURRENCY_CODES[cur] || 'USD'

  const convertToDisplay = (amount, fromCurrency) => {
    if (!exchangeRates || !amount) return Number(amount) || 0
    return convertAmount(Number(amount) || 0, fromCurrency || 'USD', curCode, exchangeRates) || 0
  }

  const fmt = (n) => `${cur}${Number(n).toFixed(2)}`

  const { start: filterStart, end: filterEnd } = getDateRange(datePreset, customFrom, customTo)

  const filteredAccounts = useMemo(() => {
    if (!filterStart && !filterEnd) return accounts
    return accounts.filter(a => {
      const d = new Date(a.createdAt)
      if (filterStart && d < filterStart) return false
      if (filterEnd && d > filterEnd) return false
      return true
    })
  }, [accounts, filterStart, filterEnd, datePreset])

  const totalAccounts = filteredAccounts.length
  const totalAvailable = filteredAccounts.filter(a => a.status === 'Available').length
  const totalSold = filteredAccounts.filter(a => a.status === 'Sold').length
  const totalLost = filteredAccounts.filter(a => a.status === 'Lost').length

  const totalInvested = filteredAccounts.reduce((sum, a) => sum + convertToDisplay(a.boughtFor, a.boughtForCurrency), 0)
  const expectedProfit = filteredAccounts.filter(a => a.status === 'Available').reduce((sum, a) =>
    sum + (convertToDisplay(a.soldFor, a.soldForCurrency) - convertToDisplay(a.boughtFor, a.boughtForCurrency)), 0)

  const totalRevenue = filteredAccounts.filter(a => a.status === 'Sold').reduce((sum, a) => {
    const gross = convertToDisplay(a.soldFor, a.soldForCurrency)
    const p = platforms.find(p => p.name === a.soldOnPlatform)
    return sum + (p ? calcNetAmount(gross, p) : gross)
  }, 0)

  const pendingRevenue = useMemo(() => {
    return filteredAccounts.filter(a => a.status === 'Sold' && a.soldOnPlatform).reduce((sum, a) => {
      const p = platforms.find(p => p.name === a.soldOnPlatform)
      if (!p || !p.holdingDays) return sum
      const release = new Date(new Date(a.createdAt).getTime() + p.holdingDays * 24 * 60 * 60 * 1000)
      if (new Date() < release) return sum + calcNetAmount(convertToDisplay(a.soldFor, a.soldForCurrency), p)
      return sum
    }, 0)
  }, [filteredAccounts, platforms, exchangeRates, curCode])

  const totalCostOfSold = filteredAccounts.filter(a => a.status === 'Sold').reduce((sum, a) => sum + convertToDisplay(a.boughtFor, a.boughtForCurrency), 0)
  const netProfit = totalRevenue - totalCostOfSold
  const toBreakEven = totalInvested - totalRevenue
  const hasBreakEven = toBreakEven <= 0

  const needToBePosted = filteredAccounts.filter(a => {
    if (a.status !== 'Available' && a.status !== 'Reserved') return false
    const t = a.targetPlatforms || []
    return t.length > 0 && t.some(p => !p.posted)
  }).length

  const profitData = useMemo(() => {
    const sold = filteredAccounts.filter(a => a.status === 'Sold')
    const getNet = (accs) => accs.reduce((sum, a) => {
      const gross = convertToDisplay(a.soldFor, a.soldForCurrency)
      const p = platforms.find(pl => pl.name === a.soldOnPlatform)
      return sum + (p ? calcNetAmount(gross, p) : gross)
    }, 0)
    const getCost = (accs) => accs.reduce((sum, a) => sum + convertToDisplay(a.boughtFor, a.boughtForCurrency), 0)

    if (profitFilter === 'month') {
      return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((name, i) => {
        const m = sold.filter(a => new Date(a.createdAt).getMonth() === i)
        return { name, value: Number((getNet(m) - getCost(m)).toFixed(2)) }
      })
    }
    if (profitFilter === 'week') {
      return ['W1','W2','W3','W4'].map((name, i) => {
        const m = sold.filter(a => Math.floor(new Date(a.createdAt).getDate() / 7) === i)
        return { name, value: Number((getNet(m) - getCost(m)).toFixed(2)) }
      })
    }
    return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((name, i) => {
      const m = sold.filter(a => new Date(a.createdAt).getDay() === (i + 1) % 7)
      return { name, value: Number((getNet(m) - getCost(m)).toFixed(2)) }
    })
  }, [filteredAccounts, profitFilter, exchangeRates, curCode, platforms])

  const accountActivityData = useMemo(() => {
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((name, i) => ({
      name, value: filteredAccounts.filter(a => new Date(a.createdAt).getMonth() === i).length
    }))
  }, [filteredAccounts])

  const recentActivity = useMemo(() => {
    return filteredAccounts.slice(-8).reverse().map(a => {
      const game = games.find(g => g.id === a.gameId)
      return { text: `Account added — ${game?.name || 'Unknown Game'}`, time: a.createdAt, status: a.status }
    })
  }, [filteredAccounts, games])

  const buildDrillDown = (type) => {
    switch (type) {
      case 'totalAccounts': {
        const byGame = games.map(g => {
          const accs = filteredAccounts.filter(a => a.gameId === g.id)
          return { game: g, total: accs.length, available: accs.filter(a => a.status === 'Available').length, sold: accs.filter(a => a.status === 'Sold').length, lost: accs.filter(a => a.status === 'Lost').length }
        }).filter(g => g.total > 0)
        return { type, title: 'Total Accounts Breakdown', items: byGame }
      }
      case 'totalInvested': {
        const items = filteredAccounts.map(a => {
          const game = games.find(g => g.id === a.gameId)
          return { id: a.id, title: a.title || 'Untitled', game: game?.name || '—', bought: convertToDisplay(a.boughtFor, a.boughtForCurrency), status: a.status }
        }).sort((a, b) => b.bought - a.bought)
        return { type, title: 'Total Invested Breakdown', items, total: totalInvested }
      }
      case 'totalRevenue': {
        const items = filteredAccounts.filter(a => a.status === 'Sold').map(a => {
          const game = games.find(g => g.id === a.gameId)
          const gross = convertToDisplay(a.soldFor, a.soldForCurrency)
          const p = platforms.find(p => p.name === a.soldOnPlatform)
          const fee = p ? gross - calcNetAmount(gross, p) : 0
          return { id: a.id, title: a.title || 'Untitled', game: game?.name || '—', gross, fee, net: gross - fee, platform: a.soldOnPlatform || '—' }
        }).sort((a, b) => b.net - a.net)
        return { type, title: 'Total Revenue Breakdown', items, total: totalRevenue }
      }
      case 'netProfit': {
        const items = filteredAccounts.filter(a => a.status === 'Sold').map(a => {
          const game = games.find(g => g.id === a.gameId)
          const gross = convertToDisplay(a.soldFor, a.soldForCurrency)
          const p = platforms.find(p => p.name === a.soldOnPlatform)
          const net = p ? calcNetAmount(gross, p) : gross
          const bought = convertToDisplay(a.boughtFor, a.boughtForCurrency)
          return { id: a.id, title: a.title || 'Untitled', game: game?.name || '—', bought, net, profit: net - bought, platform: a.soldOnPlatform || '—' }
        }).sort((a, b) => b.profit - a.profit)
        return { type, title: 'Net Profit Breakdown', items, total: netProfit }
      }
      case 'platforms': {
        const items = platforms.map(p => {
          const sold = filteredAccounts.filter(a => a.soldOnPlatform === p.name)
          const revenue = sold.reduce((sum, a) => sum + calcNetAmount(convertToDisplay(a.soldFor, a.soldForCurrency), p), 0)
          return { id: p.id, name: p.name, image: p.image, sold: sold.length, revenue, feePercentage: p.feePercentage, feeFixed: p.feeFixed, holdingDays: p.holdingDays }
        })
        return { type, title: 'Active Platforms', items }
      }
      case 'available': {
        const items = filteredAccounts.filter(a => a.status === 'Available').map(a => {
          const game = games.find(g => g.id === a.gameId)
          return { id: a.id, gameId: a.gameId, title: a.title || 'Untitled', game: game?.name || '—', selling: convertToDisplay(a.soldFor, a.soldForCurrency) }
        })
        return { type, title: 'Available Accounts', items }
      }
      case 'lost': {
        const items = filteredAccounts.filter(a => a.status === 'Lost').map(a => {
          const game = games.find(g => g.id === a.gameId)
          return { id: a.id, gameId: a.gameId, title: a.title || 'Untitled', game: game?.name || '—', bought: convertToDisplay(a.boughtFor, a.boughtForCurrency) }
        })
        return { type, title: 'Lost Accounts', items }
      }
      case 'needPosted': {
        const items = filteredAccounts.filter(a => {
          if (a.status !== 'Available') return false
          const t = a.targetPlatforms || []
          return t.length > 0 && t.some(p => !p.posted)
        }).map(a => {
          const game = games.find(g => g.id === a.gameId)
          const t = a.targetPlatforms || []
          return { id: a.id, gameId: a.gameId, title: a.title || 'Untitled', game: game?.name || '—', posted: t.filter(p => p.posted).length, total: t.length }
        })
        return { type, title: 'Need to be Posted', items }
      }
      case 'needRemoved': {
        return { type, title: 'Need to be Removed', items: removalTasks || [] }
      }
      default: return null
    }
  }

  const openDrillDown = (type) => setDrillDown(buildDrillDown(type))

  const StatCard = ({ icon: Icon, label, value, sub, color, subColor, drillType }) => {
    const [hovered, setHovered] = useState(false)
    return (
      <div
        onClick={() => drillType && openDrillDown(drillType)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ background: card, border: `1px solid ${hovered && drillType ? '#7E6551' : border}`, borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: drillType ? 'pointer' : 'default', transition: 'all 0.15s ease' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: muted }}>{label}</span>
          <Icon size={16} color={color || muted} />
        </div>
        <div style={{ fontSize: '24px', fontWeight: '600', color: color || text }}>{value}</div>
        {sub !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '12px', color: subColor || muted }}>{sub}</div>
            {drillType && (
              <Eye
                size={13}
                color={hovered ? '#7E6551' : 'transparent'}
                style={{ transition: 'color 0.15s', flexShrink: 0 }}
              />
            )}
          </div>
        )}
        {sub === undefined && drillType && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Eye size={13} color={hovered ? '#7E6551' : 'transparent'} style={{ transition: 'color 0.15s' }} />
          </div>
        )}
      </div>
    )
  }

  const StatusCard = ({ icon: Icon, label, count, color, drillType }) => {
    const [hovered, setHovered] = useState(false)
    return (
      <div
        onClick={() => drillType && openDrillDown(drillType)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ background: card, border: `1px solid ${hovered && drillType ? color : border}`, borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: drillType ? 'pointer' : 'default', transition: 'all 0.15s ease' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon size={18} color={color} />
          <span style={{ fontSize: '14px', color: text }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: color + '22', color, borderRadius: '20px', padding: '2px 12px', fontSize: '13px', fontWeight: '600' }}>{count}</div>
          {drillType && <Eye size={14} color={hovered ? color : muted} style={{ transition: 'color 0.15s', opacity: hovered ? 1 : 0.3 }} />}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>

      {/* Header + Date Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>Welcome back, Admin</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Calendar size={14} color={muted} />
          {DATE_PRESETS.filter(p => p.value !== 'custom').map(preset => (
            <button key={preset.value} onClick={() => { setDatePreset(preset.value); setShowDatePicker(false) }}
              style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${border}`, background: datePreset === preset.value ? '#7E6551' : 'transparent', color: datePreset === preset.value ? '#FDF4DC' : muted, fontSize: '12px', cursor: 'pointer', fontWeight: datePreset === preset.value ? '600' : '400' }}>
              {preset.label}
            </button>
          ))}
          <button onClick={() => { setDatePreset('custom'); setShowDatePicker(!showDatePicker) }}
            style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${border}`, background: datePreset === 'custom' ? '#7E6551' : 'transparent', color: datePreset === 'custom' ? '#FDF4DC' : muted, fontSize: '12px', cursor: 'pointer', fontWeight: datePreset === 'custom' ? '600' : '400' }}>
            Custom
          </button>
        </div>
      </div>

      {datePreset === 'custom' && showDatePicker && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: muted }}>From</span>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: muted }}>To</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', cursor: 'pointer' }} />
          </div>
          <button onClick={() => setShowDatePicker(false)}
            style={{ padding: '7px 16px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
            Apply
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon={Users} label={datePreset === 'all' ? 'Total Accounts' : 'New Accounts'} value={totalAccounts} sub={`${totalAvailable} available`} drillType="totalAccounts" />
        <StatCard icon={TrendingUp} label="Total Invested" value={fmt(totalInvested)} sub={`Expected: ${fmt(expectedProfit)}`} drillType="totalInvested" />
        <StatCard icon={TrendingUp} label="Total Revenue" value={fmt(totalRevenue)} color="#4caf50" sub={pendingRevenue > 0 ? `+ ${fmt(pendingRevenue)} pending` : `${totalSold} sold`} subColor={pendingRevenue > 0 ? '#e8a020' : muted} drillType="totalRevenue" />
        <StatCard icon={netProfit >= 0 ? TrendingUp : TrendingDown} label="Net Profit" value={fmt(netProfit)} color={netProfit >= 0 ? '#4caf50' : '#e05252'} sub={pendingRevenue > 0 ? `(${fmt(netProfit + pendingRevenue)} incl. pending)` : 'Revenue minus cost'} subColor={pendingRevenue > 0 ? '#e8a020' : muted} drillType="netProfit" />
        <StatCard icon={Target} label="To Break Even" value={hasBreakEven ? '✓ Broken Even' : fmt(toBreakEven)} color={hasBreakEven ? '#4caf50' : '#e8a020'} sub={hasBreakEven ? `${fmt(Math.abs(toBreakEven))} past break even` : 'Still needed in sales'} />
        <StatCard icon={Globe} label="Active Platforms" value={platforms.length} sub={`${games.length} games`} drillType="platforms" />
      </div>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatusCard icon={AlertCircle} label="Available Accounts" count={totalAvailable} color="#4caf50" drillType="available" />
        <StatusCard icon={XCircle} label="Lost Accounts" count={totalLost} color="#e05252" drillType="lost" />
        <StatusCard icon={FileText} label="Need to be Posted" count={needToBePosted} color="#7E6551" drillType="needPosted" />
        <StatusCard icon={CheckCircle} label="Need to be Removed" count={(removalTasks || []).length} color="#e8a020" drillType="needRemoved" />
      </div>

      {/* Removal Tasks */}
      {(removalTasks || []).length > 0 && (
        <div style={{ background: card, border: `1px solid #e8a02044`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e8a020' }} />
            <span style={{ fontSize: '15px', fontWeight: '600', color: text }}>Listings to Remove</span>
            <span style={{ fontSize: '12px', color: muted }}>({removalTasks.length} pending)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {removalTasks.map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}` }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{task.account_title}</div>
                  <div style={{ fontSize: '12px', color: muted, marginTop: '3px' }}>
                    Sold on <span style={{ color: '#4caf50' }}>{task.sold_on_platform}</span> → Remove from <span style={{ color: '#e8a020' }}>{task.platform_name}</span>
                  </div>
                </div>
                <button onClick={() => onRemovalTaskDone && onRemovalTaskDone(task.id)}
                  style={{ padding: '6px 14px', background: '#4caf5022', color: '#4caf50', border: '1px solid #4caf5044', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                  ✓ Removed
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graph */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setGraphIndex(i => (i - 1 + graphs.length) % graphs.length)}
              style={{ background: 'transparent', border: `1px solid ${border}`, borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: muted }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: '15px', fontWeight: '600', color: text }}>{graphs[graphIndex]}</span>
            <button onClick={() => setGraphIndex(i => (i + 1) % graphs.length)}
              style={{ background: 'transparent', border: `1px solid ${border}`, borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: muted }}><ChevronRight size={16} /></button>
          </div>
          {graphIndex === 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {['day', 'week', 'month'].map(f => (
                <button key={f} onClick={() => setProfitFilter(f)}
                  style={{ padding: '5px 14px', borderRadius: '20px', border: `1px solid ${border}`, background: profitFilter === f ? '#7E6551' : 'transparent', color: profitFilter === f ? '#FDF4DC' : muted, fontSize: '12px', cursor: 'pointer', fontWeight: profitFilter === f ? '600' : '400' }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {graphIndex === 0 && (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={profitData}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7E6551" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7E6551" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="name" stroke={muted} fontSize={12} />
              <YAxis stroke={muted} fontSize={12} tickFormatter={v => `${cur}${v}`} />
              <Tooltip contentStyle={{ background: card, border: `1px solid ${border}`, borderRadius: '8px', color: text }} formatter={v => [`${cur}${Number(v).toFixed(2)}`, 'Profit']} />
              <Area type="monotone" dataKey="value" stroke="#7E6551" fill="url(#colorProfit)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {graphIndex === 1 && (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={accountActivityData}>
              <defs>
                <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7E6551" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7E6551" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="name" stroke={muted} fontSize={12} />
              <YAxis stroke={muted} fontSize={12} />
              <Tooltip contentStyle={{ background: card, border: `1px solid ${border}`, borderRadius: '8px', color: text }} formatter={v => [v, 'Accounts']} />
              <Area type="monotone" dataKey="value" stroke="#7E6551" fill="url(#colorActivity)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {graphIndex === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentActivity.length > 0 ? recentActivity.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bg, borderRadius: '8px', border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.status === 'Sold' ? '#2196f3' : item.status === 'Lost' ? '#e05252' : '#4caf50' }} />
                  <span style={{ fontSize: '13px', color: text }}>{item.text}</span>
                </div>
                <span style={{ fontSize: '12px', color: muted }}>{item.time}</span>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '40px', color: muted, fontSize: '14px' }}>No activity in this period</div>
            )}
          </div>
        )}
      </div>

      {/* Drill-down Modal */}
      {drillDown && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '600px', border: `1px solid ${border}`, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>{drillDown.title}</h2>
              <button onClick={() => setDrillDown(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {drillDown.type === 'totalAccounts' && drillDown.items.map(({ game, total, available, sold, lost }) => (
                <div key={game.id}
                  onClick={() => { setDrillDown(null); setActivePage && setActivePage('Accounts') }}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}`, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.border = `1px solid #7E6551`}
                  onMouseLeave={e => e.currentTarget.style.border = `1px solid ${border}`}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: game.image ? `url(${game.image}) center/cover no-repeat` : '#7E655122', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!game.image && <span style={{ fontSize: '16px' }}>🎮</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: text }}>{game.name}</div>
                    <div style={{ fontSize: '12px', color: muted, marginTop: '2px' }}>{total} total</div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#4caf50' }}>{available}</div>
                      <div style={{ fontSize: '10px', color: muted }}>Available</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#2196f3' }}>{sold}</div>
                      <div style={{ fontSize: '10px', color: muted }}>Sold</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#e05252' }}>{lost}</div>
                      <div style={{ fontSize: '10px', color: muted }}>Lost</div>
                    </div>
                  </div>
                  <ArrowRight size={14} color={muted} />
                </div>
              ))}

              {drillDown.type === 'totalInvested' && (
                <>
                  <div style={{ padding: '12px 16px', background: '#7E655122', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: muted }}>Total</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: text }}>{fmt(drillDown.total)}</span>
                  </div>
                  {drillDown.items.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}` }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{item.title}</div>
                        <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>{item.game} • <span style={{ color: item.status === 'Sold' ? '#2196f3' : item.status === 'Lost' ? '#e05252' : '#4caf50' }}>{item.status}</span></div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: text }}>{fmt(item.bought)}</div>
                    </div>
                  ))}
                </>
              )}

              {drillDown.type === 'totalRevenue' && (
                <>
                  <div style={{ padding: '12px 16px', background: '#4caf5022', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: muted }}>Net Total</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#4caf50' }}>{fmt(drillDown.total)}</span>
                  </div>
                  {drillDown.items.map(item => (
                    <div key={item.id} style={{ padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{item.title}</div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#4caf50' }}>{fmt(item.net)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: muted }}>
                        <span>{item.game}</span>
                        <span>Platform: {item.platform}</span>
                        {item.fee > 0 && <span style={{ color: '#e05252' }}>Fee: -{fmt(item.fee)}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {drillDown.type === 'netProfit' && (
                <>
                  <div style={{ padding: '12px 16px', background: netProfit >= 0 ? '#4caf5022' : '#e0525222', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: muted }}>Net Total</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: netProfit >= 0 ? '#4caf50' : '#e05252' }}>{fmt(drillDown.total)}</span>
                  </div>
                  {drillDown.items.map(item => (
                    <div key={item.id} style={{ padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{item.title}</div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: item.profit >= 0 ? '#4caf50' : '#e05252' }}>{fmt(item.profit)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: muted }}>
                        <span>{item.game}</span>
                        <span>Bought: {fmt(item.bought)}</span>
                        <span>Net: {fmt(item.net)}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {drillDown.type === 'platforms' && drillDown.items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}` }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: item.image ? `url(${item.image}) center/cover no-repeat` : '#7E655122', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!item.image && <Globe size={16} color="#7E6551" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: text }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>
                      {item.feePercentage > 0 ? `${item.feePercentage}% fee` : ''}{item.feePercentage > 0 && item.feeFixed > 0 ? ' + ' : ''}{item.feeFixed > 0 ? `$${item.feeFixed} fixed` : ''}{item.holdingDays > 0 ? ` • ${item.holdingDays}d hold` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#4caf50' }}>{fmt(item.revenue)}</div>
                    <div style={{ fontSize: '11px', color: muted }}>{item.sold} sold</div>
                  </div>
                </div>
              ))}

              {drillDown.type === 'available' && drillDown.items.map(item => (
                <div key={item.id}
                  onClick={() => { setDrillDown(null); setActivePage && setActivePage('Accounts') }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}`, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.border = `1px solid #4caf50`}
                  onMouseLeave={e => e.currentTarget.style.border = `1px solid ${border}`}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>{item.game}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#4caf50' }}>{fmt(item.selling)}</span>
                    <ArrowRight size={13} color={muted} />
                  </div>
                </div>
              ))}

              {drillDown.type === 'lost' && drillDown.items.map(item => (
                <div key={item.id}
                  onClick={() => { setDrillDown(null); setActivePage && setActivePage('Accounts') }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}`, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.border = `1px solid #e05252`}
                  onMouseLeave={e => e.currentTarget.style.border = `1px solid ${border}`}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>{item.game}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#e05252' }}>Lost {fmt(item.bought)}</span>
                    <ArrowRight size={13} color={muted} />
                  </div>
                </div>
              ))}

              {drillDown.type === 'needPosted' && drillDown.items.map(item => (
                <div key={item.id}
                  onClick={() => { setDrillDown(null); setActivePage && setActivePage('Posting') }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}`, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.border = `1px solid #7E6551`}
                  onMouseLeave={e => e.currentTarget.style.border = `1px solid ${border}`}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>{item.game}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#7E6551' }}>{item.posted}/{item.total} posted</span>
                    <ArrowRight size={13} color={muted} />
                  </div>
                </div>
              ))}

              {drillDown.type === 'needRemoved' && drillDown.items.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bg, borderRadius: '10px', border: `1px solid ${border}` }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: text }}>{task.account_title}</div>
                    <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>
                      Sold on <span style={{ color: '#4caf50' }}>{task.sold_on_platform}</span> → Remove from <span style={{ color: '#e8a020' }}>{task.platform_name}</span>
                    </div>
                  </div>
                  <button onClick={() => { onRemovalTaskDone && onRemovalTaskDone(task.id); setDrillDown(prev => ({ ...prev, items: prev.items.filter(t => t.id !== task.id) })) }}
                    style={{ padding: '6px 12px', background: '#4caf5022', color: '#4caf50', border: '1px solid #4caf5044', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    ✓ Removed
                  </button>
                </div>
              ))}

              {drillDown.items && drillDown.items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: muted }}>Nothing to show here</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'
import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Mail, CheckCircle, XCircle, AlertCircle, Clock, Eye, X, Check, Trash2, ChevronDown } from 'lucide-react'

const STATUS_COLORS = {
  Pending: { bg: '#e8a02022', color: '#e8a020' },
  Matched: { bg: '#4caf5022', color: '#4caf50' },
  Sold: { bg: '#2196f322', color: '#2196f3' },
  Unmatched: { bg: '#e0525222', color: '#e05252' },
  Cancelled: { bg: '#88888822', color: '#888888' },
}

const DATE_FILTERS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
]

function similarity(s1, s2) {
  const a = s1.toLowerCase().trim()
  const b = s2.toLowerCase().trim()
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9
  const wordsA = a.split(/\s+/)
  const wordsB = b.split(/\s+/)
  const overlap = wordsA.filter(w => w.length > 2 && wordsB.some(wb => wb.includes(w) || w.includes(wb))).length
  return overlap / Math.max(wordsA.length, wordsB.length)
}

export default function Orders({ darkMode, accounts, games, platforms, updateAccount, currency, exchangeRates, onNewOrders, autoRefreshInterval, onRemovalTaskCreated }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState('')
  const [lastChecked, setLastChecked] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchingOrder, setMatchingOrder] = useState(null)
  const [matchCandidates, setMatchCandidates] = useState([])
  const [showRawEmail, setShowRawEmail] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('ordersAutoRefresh') === 'true'
    return false
  })
  const [selectedIds, setSelectedIds] = useState([])
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [emailDateFilter, setEmailDateFilter] = useState('all')
  const [showDateFilterDropdown, setShowDateFilterDropdown] = useState(false)
  const autoRefreshTimer = useRef(null)

  const card = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text = darkMode ? '#FDF4DC' : '#151515'
  const muted = darkMode ? '#a08570' : '#7E6551'
  const bg = darkMode ? '#151515' : '#FDF4DC'

  useEffect(() => {
    loadOrders()
    checkGmailConnection()
    const saved = localStorage.getItem('lastOrderCheck')
    if (saved) setLastChecked(new Date(saved))

    // Re-check if we just completed OAuth
    if (localStorage.getItem('gmailJustConnected') === 'true') {
      localStorage.removeItem('gmailJustConnected')
      setTimeout(() => checkGmailConnection(), 800)
    }
  }, [])

  useEffect(() => {
    if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current)
    if (autoRefresh && gmailConnected) {
      const interval = (autoRefreshInterval || 10) * 60 * 1000
      autoRefreshTimer.current = setInterval(() => { fetchOrders(true) }, interval)
    }
    return () => { if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current) }
  }, [autoRefresh, gmailConnected, autoRefreshInterval])

  const toggleAutoRefresh = () => {
    const newVal = !autoRefresh
    setAutoRefresh(newVal)
    localStorage.setItem('ordersAutoRefresh', String(newVal))
  }

  // Use local date parts for all comparisons to avoid UTC timezone shift
  const getLocalDateParts = (date) => ({
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  })

  const isSameDay = (d1, d2) => {
    const a = getLocalDateParts(d1)
    const b = getLocalDateParts(d2)
    return a.year === b.year && a.month === b.month && a.day === b.day
  }

  const getFilteredOrders = () => {
    if (!emailDateFilter || emailDateFilter === 'all') return orders
    const now = new Date()
    return orders.filter(order => {
      // Parse stored ISO date into local time for comparison
      const orderDate = new Date(order.email_date || order.created_at)
      if (emailDateFilter === 'today') {
        return isSameDay(orderDate, now)
      }
      if (emailDateFilter === 'week') {
        // Start of 7 days ago (local midnight)
        const parts = getLocalDateParts(now)
        const weekStart = new Date(parts.year, parts.month, parts.day - 6, 0, 0, 0, 0)
        return orderDate >= weekStart
      }
      if (emailDateFilter === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear()
      }
      return true
    })
  }

  const filteredOrders = getFilteredOrders()

  const getGmailDateQuery = (filter) => {
    const now = new Date()
    switch (filter) {
      case 'today': {
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const d = String(now.getDate()).padStart(2, '0')
        return `after:${y}/${m}/${d}`
      }
      case 'week': {
        const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        const y = weekAgo.getFullYear()
        const m = String(weekAgo.getMonth() + 1).padStart(2, '0')
        const d = String(weekAgo.getDate()).padStart(2, '0')
        return `after:${y}/${m}/${d}`
      }
      case 'month': {
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        return `after:${y}/${m}/01`
      }
      default: return ''
    }
  }

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/orders')
      const data = await res.json()
      if (!data.error) setOrders(data)
    } catch (err) {
      console.error('Failed to load orders:', err)
    } finally {
      setLoading(false)
    }
  }

  const checkGmailConnection = async () => {
    try {
      const res = await fetch('/api/gmail')
      const data = await res.json()
      setGmailConnected(data.connected)
      if (data.email) setGmailEmail(data.email)
    } catch (err) {
      console.error('Failed to check Gmail:', err)
    }
  }

  const connectGmail = () => { window.location.href = '/api/auth/gmail' }

  const disconnectGmail = async () => {
    try {
      await fetch('/api/gmail/disconnect', { method: 'POST' })
      setGmailConnected(false)
      setGmailEmail('')
      setAutoRefresh(false)
      localStorage.setItem('ordersAutoRefresh', 'false')
    } catch (err) {
      console.error('Failed to disconnect Gmail:', err)
    }
  }

  const fetchOrders = async (silent = false) => {
    if (!gmailConnected) return
    if (!silent) setFetching(true)
    try {
      const dateQuery = getGmailDateQuery(emailDateFilter)
      const res = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms, dateQuery }),
      })
      const data = await res.json()
      if (data.error) { console.error(data.error); return }
      const now = new Date()
      setLastChecked(now)
      localStorage.setItem('lastOrderCheck', now.toISOString())
      if (data.count > 0) {
        await loadOrders()
        if (onNewOrders) onNewOrders(data.count)
        await autoMatchOrders(data.orders)
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      if (!silent) setFetching(false)
    }
  }

  const createRemovalTasks = async (account, soldOnPlatform) => {
    const otherPlatforms = (account.targetPlatforms || []).filter(p => p.platformName !== soldOnPlatform && p.posted)
    for (const platform of otherPlatforms) {
      try {
        const res = await fetch('/api/removal-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: account.id, accountTitle: account.title || 'Unknown Account', platformName: platform.platformName, soldOnPlatform }),
        })
        const task = await res.json()
        if (task && !task.error && onRemovalTaskCreated) onRemovalTaskCreated(task)
      } catch (err) {
        console.error('Failed to create removal task:', err)
      }
    }
  }

  const autoMatchOrders = async (newOrders) => {
    for (const order of newOrders) {
      if (order.status !== 'Pending') continue
      const THRESHOLD = 0.6
      if (order.title) {
        const titleMatch = accounts
          .filter(a => a.status === 'Available' && a.title)
          .map(a => ({ account: a, score: similarity(a.title, order.title) }))
          .filter(x => x.score >= THRESHOLD)
          .sort((a, b) => b.score - a.score)[0]?.account
        if (titleMatch) {
          await confirmMatch(order.id, titleMatch.id, order.platform_name, 'auto')
          continue
        }
      }
      if (order.price) {
        const priceMatches = accounts.filter(a => a.status === 'Available' && Math.abs((a.soldFor || 0) - order.price) < 0.01)
        if (priceMatches.length === 1) {
          await confirmMatch(order.id, priceMatches[0].id, order.platform_name, 'auto')
        } else if (priceMatches.length > 1) {
          setMatchCandidates(priceMatches)
          setMatchingOrder(order)
          setShowMatchModal(true)
        }
      }
    }
  }

  const confirmMatch = async (orderId, accountId, soldOnPlatform, mode = 'manual') => {
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Matched', matchedAccountId: accountId, soldOnPlatform: soldOnPlatform || null }),
      })
      const account = accounts.find(a => a.id === accountId)
      if (account) {
        await updateAccount({ ...account, id: accountId, status: 'Sold', soldOnPlatform })
        await createRemovalTasks(account, soldOnPlatform)
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Matched', matched_account_id: accountId, sold_on_platform: soldOnPlatform } : o))
      if (mode === 'manual') {
        setShowMatchModal(false)
        setMatchingOrder(null)
        setMatchCandidates([])
      }
    } catch (err) {
      console.error('Failed to confirm match:', err)
    }
  }

  const updateOrderStatus = async (orderId, status) => {
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    } catch (err) {
      console.error('Failed to update order:', err)
    }
  }

  const deleteOrder = async (orderId) => {
    try {
      await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
      setOrders(prev => prev.filter(o => o.id !== orderId))
      setSelectedIds(prev => prev.filter(id => id !== orderId))
      if (selectedOrder?.id === orderId) setSelectedOrder(null)
    } catch (err) {
      console.error('Failed to delete order:', err)
    }
  }

  const clearAllOrders = async () => {
    try {
      await Promise.all(orders.map(o => fetch(`/api/orders/${o.id}`, { method: 'DELETE' })))
      setOrders([])
      setSelectedIds([])
      setShowClearConfirm(false)
    } catch (err) {
      console.error('Failed to clear orders:', err)
    }
  }

  const bulkDelete = async () => {
    try {
      await Promise.all(selectedIds.map(id => fetch(`/api/orders/${id}`, { method: 'DELETE' })))
      setOrders(prev => prev.filter(o => !selectedIds.includes(o.id)))
      setSelectedIds([])
    } catch (err) {
      console.error('Failed to bulk delete:', err)
    }
  }

  const bulkUpdateStatus = async (status) => {
    try {
      await Promise.all(selectedIds.map(id => fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })))
      setOrders(prev => prev.map(o => selectedIds.includes(o.id) ? { ...o, status } : o))
      setSelectedIds([])
    } catch (err) {
      console.error('Failed to bulk update:', err)
    }
  }

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === filteredOrders.length && filteredOrders.length > 0 ? [] : filteredOrders.map(o => o.id))

  const getMatchedAccount = (order) => accounts.find(a => a.id === order.matched_account_id)
  const getMatchedGame = (account) => account ? games.find(g => g.id === account.gameId) : null

  const pendingCount = filteredOrders.filter(o => o.status === 'Pending').length
  const unmatchedCount = filteredOrders.filter(o => o.status === 'Unmatched').length
  const matchedCount = filteredOrders.filter(o => o.status === 'Matched' || o.status === 'Sold').length
  const currentDateFilterLabel = DATE_FILTERS.find(f => f.value === emailDateFilter)?.label || 'All Time'

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Orders</h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>
            {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Never checked'}
            {autoRefresh && <span style={{ marginLeft: '8px', color: '#4caf50' }}>● Auto-refresh on</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {gmailConnected ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#4caf5022', borderRadius: '10px', border: '1px solid #4caf5044' }}>
                  <Mail size={14} color="#4caf50" />
                  <span style={{ fontSize: '13px', color: '#4caf50' }}>{gmailEmail}</span>
                </div>
                <button onClick={disconnectGmail} title="Disconnect Gmail"
                  style={{ background: 'transparent', border: `1px solid ${border}`, borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: muted, display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: muted }}>Auto</span>
                <div onClick={toggleAutoRefresh}
                  style={{ width: '40px', height: '22px', borderRadius: '11px', cursor: 'pointer', background: autoRefresh ? '#7E6551' : border, position: 'relative', transition: 'background 0.2s ease' }}>
                  <div style={{ position: 'absolute', top: '3px', left: autoRefresh ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
                </div>
              </div>

              {/* Date filter dropdown */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowDateFilterDropdown(!showDateFilterDropdown)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: `1px solid ${border}`, borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: muted, cursor: 'pointer' }}>
                  {currentDateFilterLabel} <ChevronDown size={14} />
                </button>
                {showDateFilterDropdown && (
                  <div style={{ position: 'absolute', top: '44px', right: 0, background: card, border: `1px solid ${border}`, borderRadius: '10px', padding: '6px', zIndex: 100, minWidth: '140px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                    {DATE_FILTERS.map(f => (
                      <button key={f.value} onClick={() => { setEmailDateFilter(f.value); setShowDateFilterDropdown(false) }}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px', background: emailDateFilter === f.value ? '#7E655122' : 'transparent', color: emailDateFilter === f.value ? '#7E6551' : text, fontWeight: emailDateFilter === f.value ? '500' : '400' }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => fetchOrders(false)} disabled={fetching}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '14px', fontWeight: '500', cursor: fetching ? 'not-allowed' : 'pointer', opacity: fetching ? 0.7 : 1 }}>
                <RefreshCw size={15} style={{ animation: fetching ? 'spin 0.8s linear infinite' : 'none' }} />
                {fetching ? 'Checking...' : 'Check Emails'}
              </button>
            </>
          ) : (
            <button onClick={connectGmail}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
              <Mail size={15} /> Connect Gmail
            </button>
          )}

          {orders.length > 0 && (
            <button onClick={() => setShowClearConfirm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', color: '#e05252', border: `1px solid #e0525244`, borderRadius: '10px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer' }}>
              <Trash2 size={14} /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Orders', value: filteredOrders.length, icon: Clock, color: muted },
          { label: 'Pending', value: pendingCount, icon: AlertCircle, color: '#e8a020' },
          { label: 'Unmatched', value: unmatchedCount, icon: XCircle, color: '#e05252' },
          { label: 'Matched', value: matchedCount, icon: CheckCircle, color: '#4caf50' },
        ].map(stat => (
          <div key={stat.label} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: muted }}>{stat.label}</span>
              <stat.icon size={16} color={stat.color} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: stat.color === muted ? text : stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#7E655122', border: `1px solid #7E655144`, borderRadius: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#7E6551', fontWeight: '500' }}>{selectedIds.length} selected</span>
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button onClick={() => bulkUpdateStatus('Sold')} style={{ padding: '6px 14px', background: '#2196f322', color: '#2196f3', border: '1px solid #2196f344', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Mark Sold</button>
            <button onClick={() => bulkUpdateStatus('Cancelled')} style={{ padding: '6px 14px', background: '#88888822', color: '#888', border: '1px solid #88888844', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            <button onClick={bulkDelete} style={{ padding: '6px 14px', background: '#e0525222', color: '#e05252', border: '1px solid #e0525244', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
            <button onClick={() => setSelectedIds([])} style={{ padding: '6px 14px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Deselect</button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: text }}>
            {emailDateFilter !== 'all' ? `${currentDateFilterLabel} Orders` : 'All Orders'}
          </span>
          <span style={{ fontSize: '12px', color: muted }}>
            {filteredOrders.length} shown{emailDateFilter !== 'all' && orders.length !== filteredOrders.length ? ` of ${orders.length} total` : ''}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: muted }}>Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Mail size={40} color={muted} style={{ marginBottom: '16px' }} />
            <div style={{ fontSize: '16px', fontWeight: '600', color: text, marginBottom: '6px' }}>
              {emailDateFilter !== 'all' ? `No orders for ${currentDateFilterLabel.toLowerCase()}` : 'No orders yet'}
            </div>
            <div style={{ fontSize: '13px', color: muted }}>
              {gmailConnected ? 'Click "Check Emails" to fetch new orders' : 'Connect Gmail to start receiving orders'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${border}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                    <input type="checkbox" checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0} onChange={toggleSelectAll} style={{ cursor: 'pointer', accentColor: '#7E6551' }} />
                  </th>
                  {['Platform', 'Order ID', 'Title', 'Price', 'Buyer', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: muted, fontWeight: '500', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const matchedAccount = getMatchedAccount(order)
                  const matchedGame = getMatchedGame(matchedAccount)
                  const isSelected = selectedIds.includes(order.id)
                  return (
                    <tr key={order.id}
                      style={{ borderBottom: `1px solid ${border}`, background: isSelected ? '#7E655108' : 'transparent' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = bg }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order.id)} style={{ cursor: 'pointer', accentColor: '#7E6551' }} />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: text }}>{order.platform_name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: muted, fontFamily: 'monospace' }}>{order.order_id?.slice(0, 12) || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: text, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.title || '—'}
                        {matchedAccount && (
                          <div style={{ fontSize: '11px', color: '#4caf50', marginTop: '2px' }}>→ {matchedGame?.name} account</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: text, whiteSpace: 'nowrap' }}>
                        {order.price ? `${order.price_currency || '$'}${order.price}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: muted }}>{order.buyer || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: STATUS_COLORS[order.status]?.bg, color: STATUS_COLORS[order.status]?.color, fontWeight: '500', whiteSpace: 'nowrap' }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: muted, whiteSpace: 'nowrap' }}>
                        {order.email_date ? new Date(order.email_date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => setSelectedOrder(order)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }} title="View"><Eye size={14} /></button>
                          {(order.status === 'Pending' || order.status === 'Unmatched') && (
                            <button onClick={() => { setMatchCandidates(accounts.filter(a => a.status === 'Available')); setMatchingOrder(order); setShowMatchModal(true) }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4caf50', padding: '4px' }} title="Match manually"><Check size={14} /></button>
                          )}
                          {order.status === 'Pending' && (
                            <button onClick={() => updateOrderStatus(order.id, 'Cancelled')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#e05252', padding: '4px' }} title="Cancel"><XCircle size={14} /></button>
                          )}
                          <button onClick={() => deleteOrder(order.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }} title="Delete"><X size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clear All Confirm */}
      {showClearConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: card, borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px', border: `1px solid ${border}`, textAlign: 'center' }}>
            <Trash2 size={32} color="#e05252" style={{ marginBottom: '16px' }} />
            <div style={{ fontSize: '17px', fontWeight: '600', color: text, marginBottom: '8px' }}>Clear All Orders?</div>
            <div style={{ fontSize: '13px', color: muted, marginBottom: '24px' }}>This will permanently delete all {orders.length} orders. This cannot be undone.</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowClearConfirm(false)} style={{ flex: 1, padding: '11px', background: 'transparent', color: muted, border: `1px solid ${border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={clearAllOrders} style={{ flex: 1, padding: '11px', background: '#e05252', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '600px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>Order Details</h2>
              <button onClick={() => { setSelectedOrder(null); setShowRawEmail(false) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Platform', value: selectedOrder.platform_name },
                { label: 'Order ID', value: selectedOrder.order_id },
                { label: 'Title', value: selectedOrder.title },
                { label: 'Price', value: selectedOrder.price ? `${selectedOrder.price_currency || '$'}${selectedOrder.price}` : '—' },
                { label: 'Buyer', value: selectedOrder.buyer },
                { label: 'Sold On', value: selectedOrder.sold_on_platform || '—' },
                { label: 'Date', value: selectedOrder.email_date ? new Date(selectedOrder.email_date).toLocaleString() : '—' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: bg, borderRadius: '8px', border: `1px solid ${border}` }}>
                  <span style={{ fontSize: '12px', color: muted }}>{item.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{item.value || '—'}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: bg, borderRadius: '8px', border: `1px solid ${border}` }}>
                <span style={{ fontSize: '12px', color: muted }}>Status</span>
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: STATUS_COLORS[selectedOrder.status]?.bg, color: STATUS_COLORS[selectedOrder.status]?.color, fontWeight: '500' }}>
                  {selectedOrder.status}
                </span>
              </div>
              {getMatchedAccount(selectedOrder) && (
                <div style={{ padding: '12px 14px', background: '#4caf5011', borderRadius: '8px', border: '1px solid #4caf5033' }}>
                  <div style={{ fontSize: '12px', color: '#4caf50', marginBottom: '4px' }}>Matched Account</div>
                  <div style={{ fontSize: '13px', color: text }}>
                    {getMatchedGame(getMatchedAccount(selectedOrder))?.name} — {getMatchedAccount(selectedOrder)?.status}
                  </div>
                </div>
              )}
              {selectedOrder.raw_email && (
                <div>
                  <button onClick={() => setShowRawEmail(!showRawEmail)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: `1px solid ${border}`, borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', color: muted, fontSize: '13px', width: '100%', justifyContent: 'center' }}>
                    <Mail size={14} /> {showRawEmail ? 'Hide' : 'Show'} Raw Email
                  </button>
                  {showRawEmail && (
                    <pre style={{ marginTop: '8px', padding: '14px', background: bg, border: `1px solid ${border}`, borderRadius: '8px', fontSize: '11px', color: text, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' }}>
                      {selectedOrder.raw_email}
                    </pre>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${border}`, flexShrink: 0, display: 'flex', gap: '8px' }}>
              {(selectedOrder.status === 'Pending' || selectedOrder.status === 'Unmatched') && (
                <button onClick={() => { setMatchCandidates(accounts.filter(a => a.status === 'Available')); setMatchingOrder(selectedOrder); setShowMatchModal(true); setSelectedOrder(null) }}
                  style={{ flex: 1, padding: '10px', background: '#4caf5022', color: '#4caf50', border: '1px solid #4caf5044', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Check size={13} /> Match Account
                </button>
              )}
              {selectedOrder.status === 'Pending' && (
                <button onClick={() => { updateOrderStatus(selectedOrder.id, 'Cancelled'); setSelectedOrder(null) }}
                  style={{ flex: 1, padding: '10px', background: '#e0525222', color: '#e05252', border: '1px solid #e0525244', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <XCircle size={13} /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Match Modal */}
      {showMatchModal && matchingOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
          <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '560px', border: `1px solid ${border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: text }}>Select Account to Match</h2>
                <button onClick={() => { setShowMatchModal(false); setMatchingOrder(null); setMatchCandidates([]) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
              </div>
              <div style={{ marginTop: '8px', padding: '10px 14px', background: bg, borderRadius: '8px', border: `1px solid ${border}` }}>
                <div style={{ fontSize: '12px', color: muted, marginBottom: '2px' }}>Order: {matchingOrder.title || matchingOrder.order_id}</div>
                <div style={{ fontSize: '12px', color: muted }}>Platform: {matchingOrder.platform_name || '—'}</div>
                <div style={{ fontSize: '12px', color: muted }}>Price: {matchingOrder.price ? `${matchingOrder.price_currency || '$'}${matchingOrder.price}` : '—'}</div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {matchCandidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: muted }}>No available accounts found</div>
              ) : matchCandidates.map(account => {
                const game = games.find(g => g.id === account.gameId)
                return (
                  <div key={account.id}
                    onClick={() => confirmMatch(matchingOrder.id, account.id, matchingOrder.platform_name)}
                    style={{ padding: '14px 16px', background: bg, border: `1px solid ${border}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.border = `1px solid #7E6551`; e.currentTarget.style.background = '#7E655108' }}
                    onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${border}`; e.currentTarget.style.background = bg }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{game?.name || 'Unknown Game'}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#4caf5022', color: '#4caf50' }}>Available</span>
                    </div>
                    {account.title && <div style={{ fontSize: '12px', color: text, marginBottom: '6px' }}>{account.title}</div>}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: muted }}>Price: </span>
                        <span style={{ fontSize: '11px', color: '#4caf50' }}>{account.soldForCurrency} {account.soldFor || 0}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

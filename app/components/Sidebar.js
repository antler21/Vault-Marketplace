'use client'
import { useState } from 'react'
import { LayoutDashboard, Gamepad2, Users, Monitor, FileText, ShoppingCart, Settings, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { getAuthClient } from '../lib/supabase-auth'
import { useRouter } from 'next/navigation'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Gamepad2, label: 'Games' },
  { icon: Users, label: 'Accounts' },
  { icon: Monitor, label: 'Platforms' },
  { icon: FileText, label: 'Posting' },
  { icon: ShoppingCart, label: 'Orders' },
  // { icon: Tag, label: 'Offers' },
  // { icon: Package, label: 'Services' },
  // { icon: Wrench, label: 'Tools' },
]

export default function Sidebar({ activePage, setActivePage, darkMode, collapsed, setCollapsed, orderNotificationCount }) {
  const [hoveredItem, setHoveredItem] = useState(null)
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = getAuthClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const bg = darkMode ? '#1e1e1e' : '#FDF4DC'
  const border = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text = darkMode ? '#FDF4DC' : '#151515'
  const mutedText = darkMode ? '#a08570' : '#7E6551'
  const activeBase = '#7E6551'

  return (
    <div style={{
      width: collapsed ? '70px' : '240px',
      minHeight: '100vh',
      background: bg,
      borderRight: `1px solid ${border}`,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 100,
      overflow: 'hidden',
    }}>

      {/* User Profile */}
      <div style={{
        padding: collapsed ? '20px 0' : '24px 20px',
        borderBottom: `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%',
          background: activeBase,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#FDF4DC', fontWeight: '600', fontSize: '14px', flexShrink: 0,
        }}>A</div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: text }}>Admin</div>
            <div style={{ fontSize: '11px', color: mutedText }}>Administrator</div>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {navItems.map(({ icon: Icon, label }) => {
          const isActive = activePage === label
          const isHovered = hoveredItem === label
          const showBadge = label === 'Orders' && orderNotificationCount > 0

          return (
            <button
              key={label}
              onClick={() => setActivePage(label)}
              onMouseEnter={() => setHoveredItem(label)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                width: 'calc(100% - 16px)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: collapsed ? '12px 0' : '11px 20px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? activeBase : isHovered ? '#7E655122' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? '#FDF4DC' : isHovered ? '#7E6551' : mutedText,
                fontSize: '14px',
                fontWeight: isActive ? '600' : '400',
                borderRadius: '8px',
                margin: '2px 8px',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Icon size={18} />
                {showBadge && (
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: '#e05252',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '10px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}>
                    {orderNotificationCount > 9 ? '9+' : orderNotificationCount}
                  </div>
                )}
              </div>
              {!collapsed && <span>{label}</span>}
            </button>
          )
        })}
      </div>

      {/* Settings + Collapse */}
      <div style={{ borderTop: `1px solid ${border}`, padding: '12px 0' }}>
        <button
          onClick={() => setActivePage('Settings')}
          onMouseEnter={() => setHoveredItem('Settings')}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            width: 'calc(100% - 16px)',
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: collapsed ? '12px 0' : '11px 20px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: activePage === 'Settings' ? activeBase : hoveredItem === 'Settings' ? '#7E655122' : 'transparent',
            border: 'none', cursor: 'pointer',
            color: activePage === 'Settings' ? '#FDF4DC' : hoveredItem === 'Settings' ? '#7E6551' : mutedText,
            fontSize: '14px', fontWeight: '400', borderRadius: '8px',
            margin: '2px 8px', transition: 'all 0.2s ease',
          }}
        >
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </button>

        <button
          onClick={handleLogout}
          onMouseEnter={() => setHoveredItem('logout')}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            width: 'calc(100% - 16px)',
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: collapsed ? '12px 0' : '11px 20px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: hoveredItem === 'logout' ? '#fee2e222' : 'transparent',
            border: 'none', cursor: 'pointer',
            color: hoveredItem === 'logout' ? '#dc2626' : mutedText,
            fontSize: '14px', borderRadius: '8px',
            margin: '2px 8px', transition: 'all 0.2s ease',
          }}
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          onMouseEnter={() => setHoveredItem('collapse')}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            width: 'calc(100% - 16px)',
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: collapsed ? '12px 0' : '11px 20px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: hoveredItem === 'collapse' ? '#7E655122' : 'transparent',
            border: 'none', cursor: 'pointer',
            color: hoveredItem === 'collapse' ? '#7E6551' : mutedText,
            fontSize: '14px', borderRadius: '8px',
            margin: '2px 8px', transition: 'all 0.2s ease',
          }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  )
}
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthClient } from '../lib/supabase-auth'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const handleLogin = async e => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = getAuthClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FDF4DC', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e8d9b8', borderRadius: '16px',
        padding: '40px 36px', width: '100%', maxWidth: '380px',
        boxShadow: '0 4px 24px #7E655114',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%', background: '#7E6551',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', color: '#FDF4DC', fontSize: '20px', fontWeight: '700',
          }}>V</div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#151515', margin: 0 }}>Vault Admin</h1>
          <p style={{ fontSize: '13px', color: '#7E6551', marginTop: '6px' }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#7E6551' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="admin@example.com"
              style={{
                padding: '10px 12px', border: '1px solid #e8d9b8', borderRadius: '8px',
                fontSize: '14px', outline: 'none', background: '#fff', color: '#151515',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#7E6551' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 38px 10px 12px', border: '1px solid #e8d9b8', borderRadius: '8px',
                  fontSize: '14px', outline: 'none', background: '#fff', color: '#151515',
                }}
              />
              <button
                type="button" onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                  color: '#a08570', display: 'flex', alignItems: 'center',
                }}
              >
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px',
              padding: '10px 12px', fontSize: '13px', color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              padding: '11px', background: loading ? '#a08570' : '#7E6551', color: '#FDF4DC',
              border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

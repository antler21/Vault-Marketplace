'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import FieldEditor from './FieldEditor'
import { Plus, X, Pencil, Check, ChevronDown, ChevronUp, Globe, Link, Upload, Gamepad2, GripVertical, Crosshair } from 'lucide-react'

// Built-in account field options available for mapping
const BUILTIN_FIELD_OPTIONS = [
  { value: '__title',    label: 'Account Title' },
  { value: '__soldFor',  label: 'Selling Price (with currency)' },
  { value: '__boughtFor', label: 'Cost Price (with currency)' },
]


// ── Email Preview Panel ───────────────────────────────────────────────────
function EmailPreviewPanel({ emailPreview, onClose, links, card, border, text, muted }) {
  const [width, setWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('vault_email_preview_width') || '560') } catch { return 560 }
  })
  const contentRef = useRef(null)
  const isResizingW = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDownW = (e) => { isResizingW.current = true; startX.current = e.clientX; startW.current = width; e.preventDefault() }

  useEffect(() => {
    const onMove = (e) => {
      if (!isResizingW.current) return
      const newW = Math.max(300, Math.min(1350, startW.current + (e.clientX - startX.current)))
      setWidth(newW)
    }
    const onUp = () => {
      if (isResizingW.current) { isResizingW.current = false; try { localStorage.setItem('vault_email_preview_width', String(width)) } catch {} }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [width])

  useEffect(() => {
    return () => { try { localStorage.setItem('vault_email_preview_width', String(width)) } catch {} }
  }, [width])

  const fitContent = () => {
    if (contentRef.current) {
      const h = contentRef.current.scrollHeight + 120
      contentRef.current.parentElement.style.maxHeight = Math.min(h, window.innerHeight - 120) + 'px'
    }
  }

  return (
    <div style={{ position: 'relative', background: card, borderRadius: '16px', width: `${width}px`, flexShrink: 0, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Left drag handle */}
      <div onMouseDown={onMouseDownW}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', cursor: 'ew-resize', zIndex: 10, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '3px', height: '40px', borderRadius: '3px', background: '#7E655166' }} />
      </div>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: text }}>📧 Email Preview</div>
          <div style={{ fontSize: '11px', color: muted, marginTop: '1px' }}>
'Drag left edge to resize · Copy values from email and paste into fields'
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={fitContent}
            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${border}`, background: 'transparent', color: muted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ↕ Fit
          </button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={16} /></button>
        </div>
      </div>

      {/* Highlight active banner */}
      {/* View Order link picker (shown when links available) */}
      {links && links.length > 0 && (
        <div style={{ padding: '10px 16px', background: '#2196f308', borderBottom: `1px solid #2196f322`, flexShrink: 0 }}>
          <div style={{ fontSize: '11px', color: '#2196f3', fontWeight: '500', marginBottom: '6px' }}>🔗 Links found in email — click one to use as View Order URL:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
            {links.map((link, i) => (
              <button key={i} onClick={() => link.onSelect(link)}
                style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 8px', borderRadius: '6px', border: `1px solid #2196f333`, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: '11px', color: text, fontWeight: '500', flexShrink: 0 }}>{link.label || 'Link'}</span>
                <span style={{ fontSize: '10px', color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.href}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Email body rendered as div — selection works natively */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div
          ref={contentRef}
          style={{ padding: '16px', background: '#ffffff', fontSize: '13px', lineHeight: '1.6' }}
          dangerouslySetInnerHTML={{ __html: emailPreview.html }}
        />
      </div>
    </div>
  )
}

// ── Resizable HTML Preview Panel ─────────────────────────────────────────
function PreviewPanel({ rendered, template, placeholderMap, onClose, card, border, text, muted }) {
  const [width, setWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('vault_preview_width') || '520') } catch { return 520 }
  })

  const isResizingW = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDownW = (e) => {
    isResizingW.current = true
    startX.current = e.clientX
    startW.current = width
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => {
      if (isResizingW.current) {
        const newW = Math.max(300, Math.min(1350, startW.current + (e.clientX - startX.current)))
        setWidth(newW)
      }
    }
    const onUp = () => {
      if (isResizingW.current) { isResizingW.current = false; try { localStorage.setItem('vault_preview_width', String(width)) } catch {} }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [width])

  // Save on unmount
  useEffect(() => {
    return () => {
      try { localStorage.setItem('vault_preview_width', String(width)) } catch {}
    }
  }, [width])

  const contentRef = useRef(null)

  const fitContent = () => {
    if (!contentRef.current) return
    const inner = contentRef.current.firstElementChild
    if (inner) {
      const h = inner.scrollHeight + 80 // add header/footer space
      const maxH = window.innerHeight - 40
      contentRef.current.parentElement.style.height = `${Math.min(h, maxH)}px`
    }
  }

  return (
    <div style={{ position: 'relative', background: card, borderRadius: '16px', width: `${width}px`, flexShrink: 0, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Left drag handle (resize width) */}
      <div onMouseDown={onMouseDownW}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', cursor: 'ew-resize', zIndex: 10, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '3px', height: '40px', borderRadius: '3px', background: '#7E655166' }} />
      </div>

      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: text }}>👁 Live Preview</div>
          <div style={{ fontSize: '11px', color: muted, marginTop: '1px' }}>{template.gameName} · drag left edge to resize width</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={fitContent}
            title="Resize panel to fit the full HTML content"
            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${border}`, background: 'transparent', color: muted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ↕ Fit content
          </button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={16} /></button>
        </div>
      </div>

      {/* Rendered HTML */}
      <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#fff' }}
        dangerouslySetInnerHTML={{ __html: rendered || '<p style="color:#aaa;font-style:italic;text-align:center;margin-top:40px">Start typing your template...</p>' }}
      />

      {/* Placeholder values footer */}
      {Object.keys(placeholderMap).length > 0 && (
        <div style={{ padding: '8px 14px', borderTop: `1px solid ${border}`, flexShrink: 0, display: 'flex', gap: '5px', flexWrap: 'wrap', background: card }}>
          {Object.entries(placeholderMap).map(([p, m]) => (
            <span key={p} style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '10px', background: '#e8a02022', color: '#e8a020' }}>
              {`{{${p}}}`} = {m.previewValue || '—'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Platforms({ darkMode, platforms, games, gameConfigs, addPlatform, updatePlatform, deletePlatform }) {
  const [showModal, setShowModal]                       = useState(false)
  const [editingPlatform, setEditingPlatform]           = useState(null)
  const [expandedPlatform, setExpandedPlatform]         = useState(null)
  const [imageMode, setImageMode]                       = useState('url')
  const [activeStep, setActiveStep]                     = useState(1)
  const [activeSection, setActiveSection]               = useState('basic')
  const [newPlatform, setNewPlatform]                   = useState({
    name: '', url: '', image: '', imageUrl: '',
    globalFields: [], gameTemplates: [],
    emailSender: '', emailParsingRules: {}, testResult: {},
    titleRules: { charLimit: '', emojiLimit: '', maxCaps: '', noEmojis: false, stripSpecial: false },
  })
  const [collapsedTemplates, setCollapsedTemplates] = useState({})
  const [htmlPreviewGame, setHtmlPreviewGame]     = useState(null)
  const [collapsedHtmlTemplates, setCollapsedHtmlTemplates] = useState({})
  const [emailPreview, setEmailPreview]           = useState(null) // { html, subject, from, date }
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false)
  const [emailPreviewError, setEmailPreviewError] = useState(null)
  const [emailCustomFields, setEmailCustomFields] = useState([]) // [{ id, label, keyword, selector }]
  const [templateUrls, setTemplateUrls]              = useState({}) // { [templateId]: url }
  const [newGlobalField, setNewGlobalField]             = useState({ label: '', accountFieldId: '' })
  const [selectedGameForTemplate, setSelectedGameForTemplate] = useState('')
  const [newTemplateFields, setNewTemplateFields]       = useState({}) // { [templateId]: { label, accountFieldId } }
  const getNewTemplateField = (tid) => newTemplateFields[tid] || { label: '', accountFieldId: '' }
  const setNewTemplateField = (tid, val) => setNewTemplateFields(prev => ({ ...prev, [tid]: typeof val === 'function' ? val(prev[tid] || { label: '', accountFieldId: '' }) : val }))
  const [editingGlobalFieldId, setEditingGlobalFieldId] = useState(null)
  const [editingGlobalFieldData, setEditingGlobalFieldData] = useState(null)
  const [editingTemplateFieldId, setEditingTemplateFieldId] = useState(null)
  const [editingTemplateFieldData, setEditingTemplateFieldData] = useState(null)

  // Drag state
  const dragGlobalIndex = useRef(null)
  const [dragGlobalOver, setDragGlobalOver] = useState(null)
  const dragTemplateInfo = useRef(null) // { templateId, index }
  const [dragTemplateOver, setDragTemplateOver] = useState(null) // { templateId, index }

  // Selector picker state — tracks which field is waiting for a pick
  // shape: { target: 'newGlobal' | 'editGlobal' | 'newTemplate' | 'editTemplate', templateId? }
  const [pickerTarget, setPickerTarget] = useState(null)
  const [pickerStatus, setPickerStatus] = useState(null) // null | 'waiting' | 'cancelled'
  const [extensionReady, setExtensionReady] = useState(false)

  const card      = darkMode ? '#1e1e1e' : '#fff'
  const border    = darkMode ? '#2e2e2e' : '#e8d9b8'
  const text      = darkMode ? '#FDF4DC' : '#151515'
  const muted     = darkMode ? '#a08570' : '#7E6551'
  const bg        = darkMode ? '#151515' : '#FDF4DC'
  const inputBg   = darkMode ? '#2a2a2a' : '#fff'
  const sectionBg = darkMode ? '#252525' : '#f9f4ea'

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '12px', color: muted, display: 'block', marginBottom: '5px' }

  // Get custom fields for a game (from gameConfigs)
  const getGameCustomFields = (gameId) => {
    if (!gameConfigs || !gameId) return []
    const cfg = gameConfigs.find(c => String(c.game_id) === String(gameId) && c.section === 'accounts')
    return cfg?.config?.customFields || []
  }

  // All mapping options: built-ins + game custom fields
  const getMappingOptions = (gameId) => {
    const custom = gameId ? getGameCustomFields(gameId) : []
    return [
      ...BUILTIN_FIELD_OPTIONS,
      ...(custom.length > 0 ? [{ value: '__divider', label: '— Game Fields —', disabled: true }] : []),
      ...custom.map(f => ({ value: f.id, label: f.label })),
    ]
  }

  const getMappingLabel = (accountFieldId, gameId) => {
    if (!accountFieldId) return null
    const builtin = BUILTIN_FIELD_OPTIONS.find(o => o.value === accountFieldId)
    if (builtin) return builtin.label
    const custom = getGameCustomFields(gameId).find(f => String(f.id) === String(accountFieldId))
    return custom?.label || 'mapped'
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setNewPlatform(prev => ({ ...prev, image: reader.result }))
    reader.readAsDataURL(file)
  }

  const handleOpenAdd = () => {
    setEditingPlatform(null)
    setNewPlatform({ name: '', url: '', image: '', imageUrl: '', globalFields: [], gameTemplates: [], emailSender: '', emailParsingRules: {}, testResult: {}, titleRules: { charLimit: '', emojiLimit: '', maxCaps: '', noEmojis: false, stripSpecial: false } })
    setNewGlobalField({ label: '', accountFieldId: '' })
    setSelectedGameForTemplate('')
    setNewTemplateField({ label: '', accountFieldId: '' })
    setEditingGlobalFieldId(null); setEditingGlobalFieldData(null)
    setEditingTemplateFieldId(null); setEditingTemplateFieldData(null)
    setActiveStep(1)
    setCollapsedTemplates({})
    setTemplateUrls({})
    setImageMode('url')
    setShowModal(true)
  }

  const handleOpenEdit = (platform) => {
    setEditingPlatform(platform.id)
    setNewPlatform({
      name: platform.name || '',
      url: platform.url || '',
      image: platform.image || '',
      imageUrl: platform.image || '',
      globalFields: [...(platform.globalFields || [])],
      titleRules: { charLimit: '', emojiLimit: '', maxCaps: '', noEmojis: false, stripSpecial: false, ...(platform.titleRules || {}) },
      enabledSections: { globalFields: false, gameTemplates: false, emailParsing: false, htmlTemplates: false, ...(platform.enabledSections || {}) },
      gameTemplates: [...(platform.gameTemplates || [])],
      emailSender: platform.emailSender || '',
      emailParsingRules: { ...(platform.emailParsingRules || {}) },
      testResult: {},
    })
    setNewGlobalField({ label: '', accountFieldId: '' })
    setSelectedGameForTemplate('')
    setNewTemplateField({ label: '', accountFieldId: '' })
    setEditingGlobalFieldId(null); setEditingGlobalFieldData(null)
    setEditingTemplateFieldId(null); setEditingTemplateFieldData(null)
    setCollapsedTemplates({})
    setCollapsedHtmlTemplates({})
    setTemplateUrls({})
    setActiveStep(1)
    setImageMode('url')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!newPlatform.name.trim()) return
    const imageToUse = newPlatform.image || newPlatform.imageUrl || ''
    const platformData = {
      name: newPlatform.name,
      url: newPlatform.url || '',
      image: imageToUse,
      globalFields: newPlatform.globalFields,
      titleRules: newPlatform.titleRules || {},
      enabledSections: newPlatform.enabledSections || {},
      gameTemplates: newPlatform.gameTemplates, // each has htmlTemplate + placeholderMap
      emailSender: newPlatform.emailSender || '',
      emailParsingRules: newPlatform.emailParsingRules || {},
    }
    if (editingPlatform) {
      await updatePlatform({ ...platformData, id: editingPlatform })
    } else {
      await addPlatform(platformData)
    }
    setShowModal(false)
    setEditingPlatform(null)
  }

  const addGlobalField = () => {
    if (!newGlobalField.label.trim()) return
    setNewPlatform(prev => ({ ...prev, globalFields: [...prev.globalFields, { id: Date.now(), ...newGlobalField }] }))
    setNewGlobalField({ label: '', accountFieldId: '' })
  }

  const removeGlobalField = (id) => {
    setNewPlatform(prev => ({ ...prev, globalFields: prev.globalFields.filter(f => f.id !== id) }))
  }

  const addGameTemplate = () => {
    if (!selectedGameForTemplate) return
    const already = newPlatform.gameTemplates.find(t => t.gameId === selectedGameForTemplate)
    if (already) return
    const game = games.find(g => g.id === selectedGameForTemplate)
    setNewPlatform(prev => ({
      ...prev,
      gameTemplates: [...prev.gameTemplates, { id: Date.now(), gameId: selectedGameForTemplate, gameName: game?.name || '', fields: [] }]
    }))
    setSelectedGameForTemplate('')
  }

  const removeGameTemplate = (id) => {
    setNewPlatform(prev => ({ ...prev, gameTemplates: prev.gameTemplates.filter(t => t.id !== id) }))
  }

  const addTemplateField = (templateId) => {
    const ntf = getNewTemplateField(templateId)
    if (!ntf.label.trim()) return
    setNewPlatform(prev => ({
      ...prev,
      gameTemplates: prev.gameTemplates.map(t =>
        t.id === templateId ? { ...t, fields: [...t.fields, { id: Date.now(), ...ntf }] } : t
      )
    }))
    setNewTemplateField(templateId, { label: '', accountFieldId: '' })
  }

  const removeTemplateField = (templateId, fieldId) => {
    setNewPlatform(prev => ({
      ...prev,
      gameTemplates: prev.gameTemplates.map(t =>
        t.id === templateId ? { ...t, fields: t.fields.filter(f => f.id !== fieldId) } : t
      )
    }))
  }

  // ── Inline edit: global fields ──────────────────────────────────────
  const startEditGlobalField = (f) => { setEditingGlobalFieldId(f.id); setEditingGlobalFieldData({ ...f }) }
  const saveEditGlobalField = () => {
    setNewPlatform(prev => ({ ...prev, globalFields: prev.globalFields.map(f => f.id === editingGlobalFieldId ? { ...editingGlobalFieldData } : f) }))
    setEditingGlobalFieldId(null); setEditingGlobalFieldData(null)
  }

  // ── Inline edit: template fields ────────────────────────────────────
  const startEditTemplateField = (f) => { setEditingTemplateFieldId(f.id); setEditingTemplateFieldData({ ...f }) }
  const saveEditTemplateField = (templateId) => {
    setNewPlatform(prev => ({
      ...prev,
      gameTemplates: prev.gameTemplates.map(t =>
        t.id === templateId ? { ...t, fields: t.fields.map(f => f.id === editingTemplateFieldId ? { ...editingTemplateFieldData } : f) } : t
      )
    }))
    setEditingTemplateFieldId(null); setEditingTemplateFieldData(null)
  }

  // ── Drag reorder: global fields ─────────────────────────────────────
  const handleGlobalDragStart = (e, index) => { dragGlobalIndex.current = index; setTimeout(() => { e.target.style.opacity = '0.4' }, 0) }
  const handleGlobalDragEnd   = (e) => { e.target.style.opacity = '1'; dragGlobalIndex.current = null; setDragGlobalOver(null) }
  const handleGlobalDragOver  = (e, index) => { e.preventDefault(); setDragGlobalOver(index) }
  const handleGlobalDrop      = (e, index) => {
    e.preventDefault()
    const from = dragGlobalIndex.current
    if (from === null || from === index) { setDragGlobalOver(null); return }
    setNewPlatform(prev => {
      const arr = [...prev.globalFields]; const [moved] = arr.splice(from, 1); arr.splice(index, 0, moved)
      return { ...prev, globalFields: arr }
    })
    dragGlobalIndex.current = null; setDragGlobalOver(null)
  }

  // ── Drag reorder: template fields ───────────────────────────────────
  const handleTemplateDragStart = (e, templateId, index) => { dragTemplateInfo.current = { templateId, index }; setTimeout(() => { e.target.style.opacity = '0.4' }, 0) }
  const handleTemplateDragEnd   = (e) => { e.target.style.opacity = '1'; dragTemplateInfo.current = null; setDragTemplateOver(null) }
  const handleTemplateDragOver  = (e, templateId, index) => { e.preventDefault(); setDragTemplateOver({ templateId, index }) }
  const handleTemplateDrop      = (e, templateId, index) => {
    e.preventDefault()
    const info = dragTemplateInfo.current
    if (!info || info.templateId !== templateId || info.index === index) { setDragTemplateOver(null); return }
    setNewPlatform(prev => ({
      ...prev,
      gameTemplates: prev.gameTemplates.map(t => {
        if (t.id !== templateId) return t
        const arr = [...t.fields]; const [moved] = arr.splice(info.index, 1); arr.splice(index, 0, moved)
        return { ...t, fields: arr }
      })
    }))
    dragTemplateInfo.current = null; setDragTemplateOver(null)
  }

  // ── Email Parsing helpers ────────────────────────────────────────────────
  const fetchEmailPreview = async () => {
    const sender = newPlatform.emailSender?.trim()
    const subject = newPlatform.emailParsingRules?.emailSubject?.trim()
    if (!sender && !subject) return
    setEmailPreviewLoading(true)
    setEmailPreviewError(null)
    try {
      const params = new URLSearchParams()
      if (sender) params.set('sender', sender)
      if (subject) params.set('subject', subject)
      const res = await fetch(`/api/gmail/search?${params}`)
      const data = await res.json()
      if (data.error) {
        if (data.error === 'RECONNECT_REQUIRED' || data.reconnect) {
          setEmailPreviewError('RECONNECT')
        } else {
          setEmailPreviewError(data.error)
        }
        setEmailPreview(null)
      } else setEmailPreview(data)
    } catch (e) {
      setEmailPreviewError(e.message)
    }
    setEmailPreviewLoading(false)
  }

  const getEmailText = () => {
    if (!emailPreview) return ''
    // Get plain text from the iframe content
    const tmp = document.createElement('div')
    tmp.innerHTML = emailPreview.html
    return tmp.textContent || tmp.innerText || ''
  }

  // ── HTML Template helpers ────────────────────────────────────────────────
  const extractPlaceholders = (html) => {
    if (!html) return []
    const matches = [...html.matchAll(/\{\{(\w+)\}\}/g)]
    return [...new Set(matches.map(m => m[1]))]
  }

  const renderTemplate = (html, values) => {
    if (!html) return ''
    return html.replace(/\{\{(\w+)\}\}/g, (match, key) => values?.[key] ?? match)
  }

  // ── Esc to close modal (keep values) ────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && showModal) setShowModal(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showModal])

  // ── Title Rules ─────────────────────────────────────────────────────────────

  const applyTitleRules = (title, rules) => {
    if (!title || !rules) return title || ''
    let t = title
    const emojiRx = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu
    if (rules.noEmojis) {
      t = t.replace(emojiRx, '').replace(/\s+/g, ' ').trim()
    } else if (rules.emojiLimit !== '' && rules.emojiLimit !== undefined && rules.emojiLimit !== null) {
      const limit = parseInt(rules.emojiLimit)
      if (!isNaN(limit)) {
        let count = 0
        t = t.replace(emojiRx, m => { count++; return count <= limit ? m : '' })
      }
    }
    if (rules.stripSpecial) {
      t = t.replace(/[#@*!$%^&()+=[\]{};':"\\|,.<>/?`~]/g, '').replace(/\s+/g, ' ').trim()
    }
    if (rules.maxCaps !== '' && rules.maxCaps !== undefined && rules.maxCaps !== null) {
      const limit = parseInt(rules.maxCaps)
      if (!isNaN(limit)) {
        let capsCount = 0
        t = t.split('').map(c => { if (c >= 'A' && c <= 'Z') { capsCount++; return capsCount <= limit ? c : c.toLowerCase() } return c }).join('')
      }
    }
    if (rules.charLimit !== '' && rules.charLimit !== undefined && rules.charLimit !== null) {
      const limit = parseInt(rules.charLimit)
      if (!isNaN(limit) && t.length > limit) t = t.slice(0, limit).trimEnd()
    }
    return t
  }

  // ── CSS Selector Picker (Chrome Extension bridge) ─────────────────────────
  useEffect(() => {
    // Set ready flag if extension already ran before this component mounted
    if (window.__vaultExtensionReady) setExtensionReady(true)

    const onReady = () => setExtensionReady(true)
    window.addEventListener('__vaultExtensionReady', onReady)

    const handler = (event) => {
      if (event.source !== window) return
      const msg = event.data
      if (!msg || !msg.__vaultExtension) return

      if (msg.type === 'VAULT_EXTENSION_PING') {
        setExtensionReady(true)
        return
      }

      if (msg.type === 'VAULT_SELECTOR_RESULT') {
        const { selector, fieldCtx, pickType, options } = msg
        if (!fieldCtx) return
        const extra = pickType === 'radio' || pickType === 'checkbox'
          ? { pickedOptions: options }
          : pickType === 'dropdown'
            ? { scrapedOptions: options }
            : {}
        if (fieldCtx.target === 'newGlobal') {
          setNewGlobalField(prev => ({ ...prev, selector: selector || prev.selector, ...extra }))
        } else if (fieldCtx.target === 'editGlobal') {
          setEditingGlobalFieldData(prev => ({ ...prev, selector: selector || prev.selector, ...extra }))
        } else if (fieldCtx.target === 'newTemplate') {
          // newTemplate picker result — update the field for the specific template
          if (fieldCtx.templateId) {
            setNewTemplateField(fieldCtx.templateId, prev => ({ ...prev, selector: selector || prev.selector, ...extra }))
          }
        } else if (fieldCtx.target === 'editTemplate') {
          setEditingTemplateFieldData(prev => ({ ...prev, selector: selector || prev.selector, ...extra }))
        }
        setPickerTarget(null)
        setPickerStatus(null)
      }

      if (msg.type === 'VAULT_SELECTOR_CANCELLED') {
        setPickerTarget(null)
        setPickerStatus('cancelled')
        setTimeout(() => setPickerStatus(null), 2000)
      }
    }
    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
      window.removeEventListener('__vaultExtensionReady', onReady)
    }
  }, [])

  const openPicker = useCallback((target, templateId = null, urlOverride = null, pickType = 'text') => {
    const url = urlOverride || newPlatform.url || ''
    if (!url) {
      alert('Please enter a Platform URL first (Step 1) so we know which page to open.\n\nFor game templates, add a Game URL to the template.')
      return
    }
    setPickerTarget(target)
    setPickerStatus('waiting')
    window.postMessage({
      __vaultExtension: true,
      type: 'OPEN_PICKER',
      url,
      fieldType: pickType,
      fieldCtx: { target, templateId },
    }, '*')

  }, [newPlatform.url])

  const testParser = (testText) => {
    const rules = newPlatform.emailParsingRules || {}
    const result = {}
    for (const [field, rule] of Object.entries(rules)) {
      if (!rule.keyword) continue
      const lines = testText.split('\n')
      for (const line of lines) {
        if (line.toLowerCase().includes(rule.keyword.toLowerCase())) {
          const afterKeyword = line.substring(line.toLowerCase().indexOf(rule.keyword.toLowerCase()) + rule.keyword.length).trim()
          result[field] = afterKeyword.replace(/^[:=\s]+/, '').split(/\s{2,}/)[0].trim()
          break
        }
      }
    }
    setNewPlatform(prev => ({ ...prev, testResult: result }))
  }

  // ── Pick Button — shown next to every CSS Selector input ─────────────────
  const PICK_TYPES = [
    { value: 'text',     label: 'Text',      emoji: '📝' },
    { value: 'dropdown', label: 'Dropdown',  emoji: '📋' },
    { value: 'radio',    label: 'Radio',     emoji: '🔘' },
    { value: 'checkbox', label: 'Checkbox',  emoji: '☑️' },
    { value: 'richtext', label: 'Rich Text', emoji: '✍️' },
  ]

  const PickButton = ({ target, templateId, url, pickType: currentPickType = 'text', onPickTypeChange }) => {
    const isWaiting = pickerTarget === target && pickerStatus === 'waiting'
    return (
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <select
          value={currentPickType}
          onChange={e => { e.stopPropagation(); onPickTypeChange && onPickTypeChange(e.target.value) }}
          disabled={isWaiting}
          style={{ padding: '0 4px', height: '36px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: muted, fontSize: '11px', cursor: 'pointer', outline: 'none' }}>
          {PICK_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
          ))}
        </select>
        <button
          onClick={() => openPicker(target, templateId, url || null, currentPickType)}
          disabled={isWaiting}
          title="Open platform page and click an element to capture its CSS selector"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '0 10px', height: '36px', borderRadius: '8px', flexShrink: 0,
            border: `1px solid ${isWaiting ? '#7E6551' : border}`,
            background: isWaiting ? '#7E655122' : inputBg,
            color: isWaiting ? '#7E6551' : muted,
            cursor: isWaiting ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap',
          }}>
          {isWaiting
            ? <><div style={{ width: '10px', height: '10px', border: `2px solid ${muted}`, borderTop: `2px solid #7E6551`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Waiting…</>
            : <>🎯 Pick</>}
        </button>
      </div>
    )
  }

  // Mapping dropdown component (reused in both global fields and template fields)
  const MappingDropdown = ({ value, onChange, gameId, style }) => {
    const options = getMappingOptions(gameId)
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, cursor: 'pointer', ...style }}>
        <option value="">— None (manual input) —</option>
        {options.map(opt => (
          opt.value === '__divider'
            ? <option key="divider" disabled>────────────────</option>
            : <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div style={{ padding: '32px', background: bg, minHeight: 'unset' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: text }}>Platforms</h1>
          <p style={{ fontSize: '13px', color: muted, marginTop: '4px' }}>{platforms.length} platforms added</p>
        </div>
        <button onClick={handleOpenAdd} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
          <Plus size={16} /> Add New Platform
        </button>
      </div>

      {/* Platform cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {platforms.map((platform, index) => (
          <div key={platform.id || index} style={{ background: card, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100px', background: platform.image ? `url(${platform.image}) center/cover no-repeat` : '#7E655122', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!platform.image && <Globe size={32} color="#7E6551" />}
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: text }}>{platform.name}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleOpenEdit(platform)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }}><Pencil size={14} /></button>
                  <button onClick={() => deletePlatform(platform.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }}><X size={14} /></button>
                </div>
              </div>
              {platform.url && (
                <div style={{ fontSize: '12px', color: muted, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={11} /><span style={{ wordBreak: 'break-all' }}>{platform.url}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', padding: '3px 10px', background: '#7E655122', color: '#7E6551', borderRadius: '20px' }}>
                  {(platform.globalFields || []).length} global fields
                </span>
                <span style={{ fontSize: '11px', padding: '3px 10px', background: '#7E655122', color: '#7E6551', borderRadius: '20px' }}>
                  {(platform.gameTemplates || []).length} game templates
                </span>
                {platform.emailSender && (
                  <span style={{ fontSize: '11px', padding: '3px 10px', background: '#4caf5022', color: '#4caf50', borderRadius: '20px' }}>Email ✓</span>
                )}
                {platform.titleRules && Object.values(platform.titleRules).some(v => v !== '' && v !== false) && (
                  <span style={{ fontSize: '11px', padding: '3px 10px', background: '#7E655122', color: '#7E6551', borderRadius: '20px' }}>Title rules ✓</span>
                )}
              </div>
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setExpandedPlatform(expandedPlatform === platform.id ? null : platform.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                  {expandedPlatform === platform.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandedPlatform === platform.id ? 'Hide' : 'Details'}
                </button>
              </div>
              {expandedPlatform === platform.id && (
                <div style={{ marginTop: '12px', borderTop: `1px solid ${border}`, paddingTop: '12px' }}>
                  {(platform.globalFields || []).length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', color: muted, marginBottom: '6px' }}>Global Fields</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {platform.globalFields.map(f => (
                          <div key={f.id} style={{ fontSize: '11px', color: text, display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ padding: '2px 8px', background: '#7E655122', color: '#7E6551', borderRadius: '20px' }}>{f.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(platform.gameTemplates || []).length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', color: muted, marginBottom: '6px' }}>Game Templates</div>
                      {platform.gameTemplates.map(t => (
                        <div key={t.id} style={{ fontSize: '12px', color: text, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Gamepad2 size={11} color={muted} />
                          <span>{t.gameName}</span>
                          <span style={{ color: muted }}>({t.fields?.length || 0} fields)</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {platform.emailSender && (
                    <div>
                      <div style={{ fontSize: '12px', color: muted, marginBottom: '4px' }}>Email Sender</div>
                      <div style={{ fontSize: '11px', color: text }}>{platform.emailSender}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', zIndex: 200, padding: '20px', gap: '16px' }}>
          <div style={{ background: card, borderRadius: '16px', width: '100%', maxWidth: '580px', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

            {/* Modal Header */}
            <div style={{ padding: '22px 28px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: '600', color: text }}>
                  {editingPlatform ? 'Edit Platform' : 'Add New Platform'}
                </h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={18} /></button>
              </div>

            </div>

            {/* Tab Bar */}
            <div style={{ display: 'flex', gap: '0', borderBottom: `1px solid ${border}`, flexShrink: 0, overflowX: 'auto' }}>
              {[
                { key: 'basic', label: 'Basic Info' },
                ...((newPlatform.enabledSections?.globalFields)  ? [{ key: 'globalFields',  label: 'Global Fields' }]  : []),
                ...((newPlatform.enabledSections?.gameTemplates) ? [{ key: 'gameTemplates', label: 'Game Templates' }] : []),
                ...((newPlatform.enabledSections?.emailParsing)  ? [{ key: 'emailParsing',  label: 'Email Parsing' }]  : []),
                ...((newPlatform.enabledSections?.htmlTemplates) ? [{ key: 'htmlTemplates', label: 'HTML Templates' }] : []),
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveSection(tab.key)}
                  style={{ padding: '10px 18px', border: 'none', borderBottom: `2px solid ${activeSection === tab.key ? '#7E6551' : 'transparent'}`, background: 'transparent', color: activeSection === tab.key ? '#7E6551' : muted, fontSize: '13px', fontWeight: activeSection === tab.key ? '600' : '400', cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '-1px' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', scrollbarGutter: 'stable' }}>

              {/* Basic Info */}
              {activeSection === 'basic' && (
                <>
                  <div>
                    <label style={labelStyle}>Platform Name</label>
                    <input value={newPlatform.name || ''} onChange={e => setNewPlatform(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. G2G" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Platform URL</label>
                    <input value={newPlatform.url || ''} onChange={e => setNewPlatform(prev => ({ ...prev, url: e.target.value }))} placeholder="e.g. https://www.g2g.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Logo / Image</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      {['url', 'upload'].map(mode => (
                        <button key={mode} onClick={() => setImageMode(mode)}
                          style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `1px solid ${border}`, background: imageMode === mode ? '#7E6551' : inputBg, color: imageMode === mode ? '#FDF4DC' : muted, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          {mode === 'url' ? <><Link size={12} /> Paste URL</> : <><Upload size={12} /> Upload</>}
                        </button>
                      ))}
                    </div>
                    {imageMode === 'url' ? (
                      <input value={newPlatform.imageUrl || ''} onChange={e => setNewPlatform(prev => ({ ...prev, imageUrl: e.target.value }))} placeholder="https://example.com/logo.png" style={inputStyle} />
                    ) : (
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={inputStyle} />
                    )}
                    {(newPlatform.image || newPlatform.imageUrl) && (
                      <img src={newPlatform.image || newPlatform.imageUrl} alt="preview" style={{ width: '100%', height: '80px', objectFit: 'contain', background: sectionBg, borderRadius: '8px', marginTop: '8px' }} />
                    )}
                  </div>

                  {/* ── Section Toggles + Tab Nav ── */}
                  <div>
                    <label style={labelStyle}>Sections</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { key: 'globalFields',  label: 'Global Fields',   desc: 'Extra fields required by this platform' },
                        { key: 'gameTemplates', label: 'Game Templates',  desc: 'Per-game field configurations' },
                        { key: 'emailParsing',  label: 'Email Parsing',   desc: 'Extract data from order emails' },
                        { key: 'htmlTemplates', label: 'HTML Templates',  desc: 'Custom HTML description templates' },
                      ].map(sec => {
                        const enabled = newPlatform.enabledSections?.[sec.key]
                        return (
                          <div key={sec.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: inputBg, borderRadius: '8px', border: `1px solid ${enabled ? '#7E6551' : border}` }}>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: text }}>{sec.label}</div>
                              <div style={{ fontSize: '11px', color: muted }}>{sec.desc}</div>
                            </div>
                            <div onClick={() => setNewPlatform(p => ({ ...p, enabledSections: { ...(p.enabledSections || {}), [sec.key]: !enabled } }))}
                              style={{ width: '40px', height: '22px', borderRadius: '11px', background: enabled ? '#7E6551' : border, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: '3px', left: enabled ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Title Rules ── */}
                  <div>
                    <label style={labelStyle}>Title Rules <span style={{ fontWeight: '300' }}>(auto-applied when posting)</span></label>
                    <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        {[
                          { key: 'charLimit',  label: 'Max characters',    placeholder: 'e.g. 128' },
                          { key: 'emojiLimit', label: 'Max emojis',         placeholder: 'e.g. 7' },
                          { key: 'maxCaps',    label: 'Max CAPS letters',   placeholder: 'e.g. 12' },
                        ].map(r => (
                          <div key={r.key}>
                            <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>{r.label}</label>
                            <input type="number" min="0" value={newPlatform.titleRules?.[r.key] || ''}
                              onChange={e => setNewPlatform(p => ({ ...p, titleRules: { ...(p.titleRules || {}), [r.key]: e.target.value } }))}
                              placeholder={r.placeholder} style={{ ...inputStyle, fontSize: '12px', padding: '6px 10px' }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[
                          { key: 'noEmojis',    label: 'No emojis allowed',        desc: 'Remove all emojis from the title' },
                          { key: 'stripSpecial', label: 'Strip special characters', desc: 'Remove #, @, !, *, etc.' },
                        ].map(r => (
                          <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: inputBg, borderRadius: '8px', border: `1px solid ${border}` }}>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: text }}>{r.label}</div>
                              <div style={{ fontSize: '11px', color: muted }}>{r.desc}</div>
                            </div>
                            <div onClick={() => setNewPlatform(p => ({ ...p, titleRules: { ...(p.titleRules || {}), [r.key]: !p.titleRules?.[r.key] } }))}
                              style={{ width: '40px', height: '22px', borderRadius: '11px', background: newPlatform.titleRules?.[r.key] ? '#7E6551' : border, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: '3px', left: newPlatform.titleRules?.[r.key] ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {(() => {
                        const rules = newPlatform.titleRules || {}
                        const hasRule = rules.charLimit || rules.emojiLimit || rules.maxCaps || rules.noEmojis || rules.stripSpecial
                        if (!hasRule) return null
                        const sample = 'DIAMOND I 💎 | All Skins 🎮✨ | Full Access #VALORANT'
                        const processed = applyTitleRules(sample, rules)
                        return (
                          <div style={{ background: '#7E655108', borderRadius: '8px', padding: '10px', border: '1px solid #7E655133' }}>
                            <div style={{ fontSize: '11px', color: muted, marginBottom: '5px' }}>Live preview:</div>
                            <div style={{ fontSize: '11px', color: muted }}>Before: <span style={{ color: text }}>"{sample}"</span></div>
                            <div style={{ fontSize: '11px', color: '#7E6551', fontWeight: '500', marginTop: '3px' }}>After: <span style={{ color: text }}>"{processed}"</span> <span style={{ color: muted }}>({processed.length} chars)</span></div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </>
              )}

              {/* Global Fields */}
              {activeSection === 'globalFields' && newPlatform.enabledSections?.globalFields && (
                <>
                  <div style={{ fontSize: '13px', color: muted }}>These fields appear for every game on this platform. Supports Text, RichText, Dropdown, Radio, Checkbox with conditional sub-fields.</div>
                  <FieldEditor
                    fields={newPlatform.globalFields}
                    onFieldsChange={fields => setNewPlatform(prev => ({ ...prev, globalFields: fields }))}
                    border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
                    showTooltip={false} showVideoUrl={false}
                  />
                </>
              )}


              {/* Game Templates */}
              {activeSection === 'gameTemplates' && newPlatform.enabledSections?.gameTemplates && (
                <>
                  <div style={{ fontSize: '13px', color: muted }}>Add extra fields per game. Map them to account data for auto-fill in the posting sheet.</div>

                  {newPlatform.gameTemplates.map(template => {
                    const game = games.find(g => g.id === template.gameId)
                    const mappingOptions = getMappingOptions(template.gameId)
                    return (
                      <div key={template.id} style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}` }}>
                        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: collapsedTemplates[template.id] ? 'none' : `1px solid ${border}`, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => setCollapsedTemplates(prev => ({ ...prev, [template.id]: !prev[template.id] }))}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Gamepad2 size={14} color={muted} />
                            <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{template.gameName}</span>
                            <span style={{ fontSize: '11px', color: muted }}>({template.fields?.length || 0} fields)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {collapsedTemplates[template.id] ? <ChevronDown size={13} color={muted} /> : <ChevronUp size={13} color={muted} />}
                            <button onClick={e => { e.stopPropagation(); removeGameTemplate(template.id) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={14} /></button>
                          </div>
                        </div>
                        {!collapsedTemplates[template.id] && (
                          <div style={{ padding: '0 14px 10px', borderBottom: `1px solid ${border}` }} onClick={e => e.stopPropagation()}>
                            <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Game URL <span style={{ fontWeight: '300' }}>(used for 🎯 Picker)</span></label>
                            <input
                              value={templateUrls[template.id] || ''}
                              onChange={e => setTemplateUrls(prev => ({ ...prev, [template.id]: e.target.value }))}
                              placeholder={`e.g. https://www.g2g.com/${template.gameName.toLowerCase().replace(/\s+/g, '')}`}
                              style={inputStyle}
                            />
                          </div>
                        )}
                        {!collapsedTemplates[template.id] && <div style={{ padding: '12px 14px' }}>
                          <FieldEditor
                            fields={template.fields || []}
                            onFieldsChange={fields => setNewPlatform(prev => ({
                              ...prev,
                              gameTemplates: prev.gameTemplates.map(t => t.id === template.id ? { ...t, fields } : t)
                            }))}
                            border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
                            showTooltip={false} showVideoUrl={false}
                          />
                        </div>}
                      </div>
                    )
                  })}

                  <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}` }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '10px' }}>Add Game Template</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select value={selectedGameForTemplate} onChange={e => setSelectedGameForTemplate(e.target.value)}
                        style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                        <option value="">Select a game...</option>
                        {games.filter(g => !newPlatform.gameTemplates.find(t => t.gameId === g.id)).map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <button onClick={addGameTemplate} style={{ padding: '9px 14px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                        <Plus size={16} />
                      </button>
                    </div>
                    {games.length === 0 && <div style={{ fontSize: '12px', color: muted, marginTop: '8px' }}>No games added yet.</div>}
                  </div>
                </>
              )}

              {/* Email Parsing */}
              {activeSection === 'emailParsing' && newPlatform.enabledSections?.emailParsing && (
                <>
                  <div style={{ fontSize: '13px', color: muted }}>Configure how to extract data from order emails. Enter the sender + subject, then click Configure to fetch a real email and highlight fields to extract.</div>

                  {/* Sender + Subject + Configure */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>Sender Email</label>
                      <input value={newPlatform.emailSender || ''} onChange={e => setNewPlatform(prev => ({ ...prev, emailSender: e.target.value }))} placeholder="e.g. noreply@g2g.com" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Email Subject (used to find template email)</label>
                      <input
                        value={(newPlatform.emailParsingRules || {}).emailSubject || ''}
                        onChange={e => setNewPlatform(prev => ({ ...prev, emailParsingRules: { ...(prev.emailParsingRules || {}), emailSubject: e.target.value } }))}
                        placeholder="e.g. New Order Received" style={inputStyle} />
                    </div>
                    <button onClick={fetchEmailPreview} disabled={emailPreviewLoading}
                      style={{ padding: '9px 18px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: emailPreviewLoading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', opacity: emailPreviewLoading ? 0.7 : 1 }}>
                      {emailPreviewLoading ? <><div style={{ width: '12px', height: '12px', border: '2px solid #FDF4DC55', borderTop: '2px solid #FDF4DC', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Fetching email…</> : <>📧 Configure (Fetch Email)</>}
                    </button>
                    {emailPreviewError && (
                      emailPreviewError === 'RECONNECT' ? (
                        <div style={{ fontSize: '12px', padding: '10px 14px', background: '#e0525210', borderRadius: '8px', border: '1px solid #e0525233', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ color: '#e05252' }}>⚠ Gmail token expired — reconnect to continue</span>
                          <button onClick={() => window.open('/api/auth/gmail', '_blank')}
                            style={{ padding: '5px 12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            🔗 Reconnect Gmail
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#e05252', padding: '8px 12px', background: '#e0525210', borderRadius: '8px', border: '1px solid #e0525233' }}>⚠ {emailPreviewError}</div>
                      )
                    )}
                    {emailPreview && <div style={{ fontSize: '12px', color: '#4caf50', padding: '8px 12px', background: '#4caf5010', borderRadius: '8px', border: '1px solid #4caf5033' }}>✓ Email loaded: "{emailPreview.subject}" from {emailPreview.from}</div>}
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: border }} />

                  {/* View Order toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: inputBg, borderRadius: '8px', border: `1px solid ${border}` }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: text }}>Has View Order link/button</div>
                      <div style={{ fontSize: '11px', color: muted }}>Email contains a link or button to view the order</div>
                    </div>
                    <div onClick={() => setNewPlatform(p => ({ ...p, emailParsingRules: { ...(p.emailParsingRules || {}), hasViewOrder: !p.emailParsingRules?.hasViewOrder } }))}
                      style={{ width: '40px', height: '22px', borderRadius: '11px', background: newPlatform.emailParsingRules?.hasViewOrder ? '#7E6551' : border, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: '3px', left: newPlatform.emailParsingRules?.hasViewOrder ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </div>
                  </div>

                  {/* View Order field (if enabled) */}
                  {newPlatform.emailParsingRules?.hasViewOrder && (
                    <div style={{ padding: '12px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '4px' }}>View Order</div>
                        <input
                          value={(newPlatform.emailParsingRules || {}).viewOrderKeyword || ''}
                          onChange={e => setNewPlatform(prev => ({ ...prev, emailParsingRules: { ...(prev.emailParsingRules || {}), viewOrderKeyword: e.target.value } }))}
                          placeholder="Keyword before link e.g. 'View Order'"
                          style={{ ...inputStyle, fontSize: '12px', padding: '6px 9px' }}
                        />
                      </div>
                      <div style={{ fontSize: '11px', color: muted }}>Pick a link from the email preview panel on the right →</div>
                    </div>
                  )}

                  {/* Custom extraction fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={labelStyle}>Custom Fields</label>
                      <button onClick={() => {
                        const newField = { id: Date.now().toString(), label: '', keyword: '', selector: '' }
                        setNewPlatform(prev => ({ ...prev, emailParsingRules: { ...(prev.emailParsingRules || {}), customFields: [...(prev.emailParsingRules?.customFields || []), newField] } }))
                      }}
                        style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', color: muted, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Plus size={12} /> Add Field
                      </button>
                    </div>
                    {(newPlatform.emailParsingRules?.customFields || []).map((field, idx) => (
                      <div key={field.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}` }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <input
                            value={field.label}
                            onChange={e => setNewPlatform(prev => ({ ...prev, emailParsingRules: { ...(prev.emailParsingRules || {}), customFields: prev.emailParsingRules.customFields.map((f, i) => i === idx ? { ...f, label: e.target.value } : f) } }))}
                            placeholder="Field name e.g. Order ID"
                            style={{ ...inputStyle, fontSize: '12px', padding: '5px 9px' }}
                          />
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              value={field.keyword}
                              onChange={e => setNewPlatform(prev => ({ ...prev, emailParsingRules: { ...(prev.emailParsingRules || {}), customFields: prev.emailParsingRules.customFields.map((f, i) => i === idx ? { ...f, keyword: e.target.value } : f) } }))}
                              placeholder="Keyword before value (auto-set on paste)"
                              style={{ ...inputStyle, fontSize: '11px', padding: '4px 8px', flex: 1 }}
                            />
                            {field.keyword && <code style={{ fontSize: '10px', color: '#7E6551', background: '#7E655115', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>after: "{field.keyword}"</code>}
                          </div>
                          <input
                            placeholder="Paste value from email here → keyword auto-detected"
                            onPaste={e => {
                              e.preventDefault()
                              const pasted = e.clipboardData.getData('text').trim()
                              if (!pasted || !emailPreview?.html) return
                              const tmp = document.createElement('div')
                              tmp.style.cssText = 'position:absolute;left:-9999px;white-space:pre-wrap'
                              tmp.innerHTML = emailPreview.html
                              document.body.appendChild(tmp)
                              const emailText = tmp.innerText || tmp.textContent || ''
                              document.body.removeChild(tmp)
                              const pos = emailText.indexOf(pasted)
                              if (pos > 0) {
                                const before = emailText.slice(Math.max(0, pos - 80), pos).trimEnd()
                                const lines = before.split(/\n/)
                                const keyword = lines[lines.length - 1].trim().slice(-40)
                                if (keyword) setNewPlatform(prev => ({ ...prev, emailParsingRules: { ...(prev.emailParsingRules || {}), customFields: prev.emailParsingRules.customFields.map((f, i) => i === idx ? { ...f, keyword } : f) } }))
                              }
                            }}
                            style={{ ...inputStyle, fontSize: '11px', padding: '4px 8px', background: '#7E655108', borderColor: '#7E655133', color: muted }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => setNewPlatform(prev => ({ ...prev, emailParsingRules: { ...(prev.emailParsingRules || {}), customFields: prev.emailParsingRules.customFields.filter((_, i) => i !== idx) } }))}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px' }}><X size={13} /></button>
                        </div>
                      </div>
                    ))}
                    {(newPlatform.emailParsingRules?.customFields || []).length === 0 && (
                      <div style={{ fontSize: '12px', color: muted, padding: '12px', background: sectionBg, borderRadius: '8px', border: `1px dashed ${border}`, textAlign: 'center' }}>
                        Add fields like Order ID, Price, Buyer — then highlight the value in the email preview to auto-configure
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: border }} />

                  {/* Test Parser — auto-updates from email preview */}
                  <div>
                    <label style={labelStyle}>Test Parser <span style={{ fontWeight: '300', fontSize: '11px' }}>(auto-updates from loaded email)</span></label>
                    {(() => {
                      const rules = newPlatform.emailParsingRules || {}
                      const customFields = rules.customFields || []
                      // Use innerText to preserve layout line breaks
                      const emailText = emailPreview ? (() => {
                        const d = document.createElement('div')
                        d.style.cssText = 'position:absolute;left:-9999px;white-space:pre-wrap'
                        d.innerHTML = emailPreview.html
                        document.body.appendChild(d)
                        const t = d.innerText || d.textContent || ''
                        document.body.removeChild(d)
                        return t
                      })() : ''
                      if (!emailText && !emailPreview) return (
                        <div style={{ fontSize: '12px', color: muted, padding: '10px', background: sectionBg, border: `1px solid ${border}`, borderRadius: '8px' }}>
                          Load an email first using Configure above
                        </div>
                      )
                      // Extract value: find keyword, take text until next newline
                      const extractValue = (text, keyword) => {
                        const idx = text.indexOf(keyword)
                        if (idx === -1) return null
                        const after = text.slice(idx + keyword.length).trimStart()
                        // Stop at first newline (innerText preserves these)
                        const nl = after.search(/[\n\r]/)
                        return (nl > 0 ? after.slice(0, nl) : after.slice(0, 80)).trim() || null
                      }
                      const results = customFields.map(f => {
                        if (!f.keyword || !emailText) return { label: f.label, value: null }
                        return { label: f.label, value: extractValue(emailText, f.keyword) }
                      })
                      if (rules.hasViewOrder && emailPreview?.html) {
                        const tmp = document.createElement('div')
                        tmp.innerHTML = emailPreview.html
                        const links = tmp.querySelectorAll('a')
                        const viewOrderLink = rules.viewOrderKeyword
                          ? [...links].find(a => a.textContent.toLowerCase().includes(rules.viewOrderKeyword.toLowerCase()))
                          : null
                        results.push({ label: 'View Order URL', value: viewOrderLink?.href || null })
                      }
                      return (
                        <div style={{ padding: '12px', background: sectionBg, borderRadius: '8px', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {results.length === 0 && <div style={{ fontSize: '12px', color: muted }}>Add custom fields above to see extracted values</div>}
                          {results.map((r, i) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '12px', color: muted, minWidth: '100px', flexShrink: 0 }}>{r.label || '(unnamed)'}:</span>
                              <span style={{ fontSize: '12px', color: r.value ? '#4caf50' : '#e05252', fontWeight: '500', wordBreak: 'break-all' }}>
                                {r.value || '✗ not found'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </>
              )}

              {/* Step 5 — HTML Templates */}
              {activeSection === 'htmlTemplates' && newPlatform.enabledSections?.htmlTemplates && (
                <>
                  <div style={{ fontSize: '13px', color: muted }}>
                    Write an HTML template per game for this platform. Use <code style={{ background: sectionBg, padding: '1px 6px', borderRadius: '4px' }}>{"{{placeholder}}"}</code> for dynamic values, then map each placeholder to an account field.
                  </div>

                  {newPlatform.gameTemplates?.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', background: sectionBg, borderRadius: '10px', border: `1px dashed ${border}`, fontSize: '13px', color: muted }}>
                      No game templates yet. Add games in Step 3 first.
                    </div>
                  )}

                  {(newPlatform.gameTemplates || []).map(template => {
                    const html = template.htmlTemplate || ''
                    const placeholderMap = template.placeholderMap || {}
                    const placeholders = extractPlaceholders(html)
                    const isPreview = htmlPreviewGame === template.id

                    // Build preview values from placeholder map labels
                    const previewValues = {}
                    placeholders.forEach(p => { previewValues[p] = placeholderMap[p]?.previewValue || `(${p})` })
                    const renderedHtml = renderTemplate(html, previewValues)

                    const updateTemplate = (updates) => {
                      setNewPlatform(prev => ({
                        ...prev,
                        gameTemplates: prev.gameTemplates.map(t => t.id === template.id ? { ...t, ...updates } : t)
                      }))
                    }

                    const isCollapsed = collapsedHtmlTemplates[template.id]
                    return (
                      <div key={template.id} style={{ background: sectionBg, borderRadius: '10px', border: `1px solid ${border}` }}>
                        {/* Game header — click to collapse */}
                        <div style={{ padding: '10px 14px', borderBottom: isCollapsed ? 'none' : `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: card, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => setCollapsedHtmlTemplates(prev => ({ ...prev, [template.id]: !prev[template.id] }))}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Gamepad2 size={14} color={muted} />
                            <span style={{ fontSize: '13px', fontWeight: '500', color: text }}>{template.gameName}</span>
                            {html && <span style={{ fontSize: '11px', color: '#4caf50' }}>✓ template set</span>}
                            {isCollapsed ? <ChevronDown size={13} color={muted} /> : <ChevronUp size={13} color={muted} />}
                          </div>
                          {!isCollapsed && (
                            <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => setHtmlPreviewGame(isPreview ? null : template.id)}
                                style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${border}`, background: isPreview ? '#7E655122' : 'transparent', color: isPreview ? '#7E6551' : muted, fontSize: '11px', cursor: 'pointer' }}>
                                {isPreview ? '✕ Close preview' : '👁 Preview'}
                              </button>
                            </div>
                          )}
                        </div>

                        {!isCollapsed && (<div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ ...labelStyle, marginBottom: '6px' }}>HTML Template</label>
                            <textarea
                              value={html}
                              onChange={e => updateTemplate({ htmlTemplate: e.target.value })}
                              placeholder={"<div>\n  <p>Server: {{server}}</p>\n  <p>Rank: {{rank}}</p>\n  <p>Price: {{price}}</p>\n</div>"}
                              rows={12}
                              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}
                            />
                            {placeholders.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                {placeholders.map(p => (
                                  <span key={p} style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: '#e8a02022', color: '#e8a020', fontFamily: 'monospace' }}>{`{{${p}}}`}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Placeholder mapping */}
                          {placeholders.length > 0 && (
                            <div>
                              <label style={{ ...labelStyle, marginBottom: '8px' }}>Map Placeholders to Account Fields</label>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {placeholders.map(p => {
                                  const mapping = placeholderMap[p] || {}
                                  // Look up the mapped account field to get its type + options
                                  const customFields = getGameCustomFields(template.gameId)
                                  const mappedField = customFields.find(f => String(f.id) === String(mapping.accountFieldId))
                                  const fieldType = mappedField?.type || 'Text'
                                  const fieldOptions = mappedField?.options || []
                                  const isSelectable = (fieldType === 'Dropdown' || fieldType === 'Radio') && fieldOptions.length > 0

                                  return (
                                    <div key={p} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', alignItems: 'center', padding: '8px 10px', background: card, borderRadius: '8px', border: `1px solid ${border}` }}>
                                      <code style={{ fontSize: '12px', color: '#e8a020', fontWeight: '500' }}>{`{{${p}}}`}</code>
                                      <MappingDropdown
                                        value={mapping.accountFieldId || ''}
                                        onChange={val => updateTemplate({ placeholderMap: { ...placeholderMap, [p]: { ...mapping, accountFieldId: val, previewValue: '' } } })}
                                        gameId={template.gameId}
                                      />
                                      {isSelectable ? (
                                        fieldType === 'Dropdown' ? (
                                          <select
                                            value={mapping.previewValue || ''}
                                            onChange={e => updateTemplate({ placeholderMap: { ...placeholderMap, [p]: { ...mapping, previewValue: e.target.value } } })}
                                            style={{ ...inputStyle, fontSize: '11px', padding: '5px 8px', cursor: 'pointer' }}>
                                            <option value="">— pick preview —</option>
                                            {fieldOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                          </select>
                                        ) : (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {fieldOptions.map(opt => (
                                              <button key={opt} onClick={() => updateTemplate({ placeholderMap: { ...placeholderMap, [p]: { ...mapping, previewValue: opt } } })}
                                                style={{ padding: '3px 10px', borderRadius: '6px', border: `1px solid ${mapping.previewValue === opt ? '#7E6551' : border}`, background: mapping.previewValue === opt ? '#7E6551' : 'transparent', color: mapping.previewValue === opt ? '#FDF4DC' : muted, fontSize: '11px', cursor: 'pointer' }}>
                                                {opt}
                                              </button>
                                            ))}
                                          </div>
                                        )
                                      ) : (
                                        <input
                                          value={mapping.previewValue || ''}
                                          onChange={e => updateTemplate({ placeholderMap: { ...placeholderMap, [p]: { ...mapping, previewValue: e.target.value } } })}
                                          placeholder={mappedField ? `e.g. ${mappedField.label}` : "Preview value"}
                                          style={{ ...inputStyle, fontSize: '11px', padding: '5px 8px' }}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: '11px', color: muted, marginTop: '6px' }}>Preview value is only used to see how the template looks — actual values come from the account at posting time.</div>
                            </div>
                          )}
                        </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 28px', borderTop: `1px solid ${border}`, flexShrink: 0, display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
              </div>
              <button onClick={handleSave}
                style={{ padding: '10px 24px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {editingPlatform ? 'Save Changes' : 'Add Platform'}
              </button>
            </div>
          </div>

          {/* ── HTML Preview Side Panel ── */}
          {/* ── Email Preview Side Panel ── */}
          {emailPreview && activeSection === 'emailParsing' && (() => {
            // Extract plain text from email HTML for keyword detection
            const emailText = (() => {
              const tmp = document.createElement('div')
              tmp.innerHTML = emailPreview.html
              return tmp.innerText || tmp.textContent || ''
            })()

            // Extract all links from email for View Order picker
            const emailLinks = (() => {
              const tmp = document.createElement('div')
              tmp.innerHTML = emailPreview.html
              return [...tmp.querySelectorAll('a[href]')]
                .filter(a => a.href && a.href.startsWith('http'))
                .map(a => ({
                  label: a.textContent.trim().slice(0, 50) || a.href,
                  href: a.href,
                  onSelect: (link) => {
                    setNewPlatform(prev => ({ ...prev, emailParsingRules: { ...(prev.emailParsingRules || {}), viewOrderKeyword: link.label, viewOrderHref: link.href } }))
                        }
                }))
                .filter((l, i, arr) => arr.findIndex(x => x.href === l.href) === i) // dedupe
            })()

            const handleMouseUp = () => {
              const selection = window.getSelection()
              if (!selection || selection.isCollapsed) return
              const selectedText = selection.toString().trim()
              if (!selectedText) return

              // Find keyword — text on the same line immediately before the selection
              const idx = emailText.indexOf(selectedText)
              if (idx > 0) {
                const before = emailText.slice(Math.max(0, idx - 80), idx).trimEnd()
                const lines = before.split('\n')
                const lastLine = lines[lines.length - 1].trim()
                const keyword = lastLine.slice(-40) // last 40 chars of the preceding line
                setNewPlatform(prev => ({
                  ...prev,
                  emailParsingRules: {
                    ...(prev.emailParsingRules || {}),
                    customFields: (prev.emailParsingRules?.customFields || []).map(f =>
                      f.id === field.id ? { ...f, keyword } : f
                    )
                  }
                }))
              }
              // Clear selection highlight
              selection.removeAllRanges()
            }

            return (
              <EmailPreviewPanel
                emailPreview={emailPreview}
                onClose={() => setEmailPreview(null)}
                links={emailLinks}
                card={card} border={border} text={text} muted={muted}
              />
            )
          })()}

          {htmlPreviewGame && activeSection === 'htmlTemplates' && newPlatform.enabledSections?.htmlTemplates && (() => {
            const template = newPlatform.gameTemplates?.find(t => t.id === htmlPreviewGame)
            if (!template) return null
            const html = template.htmlTemplate || ''
            const placeholderMap = template.placeholderMap || {}
            const previewValues = {}
            Object.entries(placeholderMap).forEach(([p, m]) => { previewValues[p] = m.previewValue || `(${p})` })
            const rendered = renderTemplate(html, previewValues)
            return (
              <PreviewPanel
                rendered={rendered}
                template={template}
                placeholderMap={placeholderMap}
                onClose={() => setHtmlPreviewGame(null)}
                card={card} border={border} text={text} muted={muted}
              />
            )
          })()}
        </div>
      )}
    </div>
  )
}

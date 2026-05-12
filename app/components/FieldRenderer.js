'use client'
import { useRef, useEffect } from 'react'

// ─── Rich Text Editor ──────────────────────────────────────────────
function RichTextEditor({ value, onChange, inp, muted, border }) {
  const editorRef = useRef(null)
  const isInternalChange = useRef(false)

  // Sync external value into editor only on first mount or if value clears
  useEffect(() => {
    if (!editorRef.current) return
    if (!isInternalChange.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || ''
    }
    isInternalChange.current = false
  }, [value])

  const exec = (cmd, val = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
  }

  const handleInput = () => {
    isInternalChange.current = true
    onChange(editorRef.current?.innerHTML || '')
  }

  const btnStyle = (active) => ({
    padding: '4px 8px', border: `1px solid ${border}`, borderRadius: '6px',
    background: active ? '#7E655122' : 'transparent', color: active ? '#7E6551' : muted,
    cursor: 'pointer', fontSize: '12px', fontWeight: '600', lineHeight: 1,
  })

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: '8px', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '4px', padding: '6px 8px', borderBottom: `1px solid ${border}`, background: inp.background, flexWrap: 'wrap' }}>
        <button onMouseDown={e => { e.preventDefault(); exec('bold') }} style={btnStyle(false)} title="Bold"><b>B</b></button>
        <button onMouseDown={e => { e.preventDefault(); exec('italic') }} style={btnStyle(false)} title="Italic"><i>I</i></button>
        <button onMouseDown={e => { e.preventDefault(); exec('underline') }} style={btnStyle(false)} title="Underline"><u>U</u></button>
        <div style={{ width: '1px', background: border, margin: '0 2px' }} />
        <button onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList') }} style={btnStyle(false)} title="Bullet list">• List</button>
        <button onMouseDown={e => { e.preventDefault(); exec('insertOrderedList') }} style={btnStyle(false)} title="Numbered list">1. List</button>
        <div style={{ width: '1px', background: border, margin: '0 2px' }} />
        <button onMouseDown={e => { e.preventDefault(); exec('removeFormat') }} style={{ ...btnStyle(false), fontSize: '11px' }} title="Clear formatting">Clear</button>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        style={{
          ...inp,
          border: 'none',
          borderRadius: 0,
          minHeight: '100px',
          outline: 'none',
          lineHeight: '1.6',
        }}
      />
    </div>
  )
}

export default function FieldRenderer({ fields, values, onChange, border, text, muted, inputBg }) {
  const renderField = (field, isSubField = false) => {
    const value = values[field.id] || ''
    const conditionalFields = field.conditionalFields || {}

    let visibleSubFields = []
    if (field.type === 'Dropdown' && value && conditionalFields[value]) {
      visibleSubFields = conditionalFields[value]
    } else if (field.type === 'Checkbox' && value === 'true' && conditionalFields['checked']) {
      visibleSubFields = conditionalFields['checked']
    }

    const inp = {
      width: '100%', padding: isSubField ? '8px 10px' : '10px 14px',
      borderRadius: '8px', border: `1px solid ${border}`,
      background: inputBg, color: text,
      fontSize: isSubField ? '13px' : '14px', outline: 'none',
      boxSizing: 'border-box',
    }

    const handleChange = (newVal) => {
      onChange(field.id, newVal)
      const prevVal = value
      if (field.type === 'Dropdown') {
        const prevSubs = conditionalFields[prevVal] || []
        prevSubs.forEach(sf => { if (values[sf.id] !== undefined) onChange(sf.id, null) })
      } else if (field.type === 'Checkbox' && newVal !== 'true') {
        const checkedSubs = conditionalFields['checked'] || []
        checkedSubs.forEach(sf => { if (values[sf.id] !== undefined) onChange(sf.id, null) })
      }
    }

    return (
      <div key={field.id}>
        <div style={{ marginBottom: visibleSubFields.length > 0 ? '8px' : '0' }}>
          {renderInput(field, value, handleChange, inp, isSubField)}
        </div>
        {visibleSubFields.length > 0 && (
          <div style={{ marginLeft: '16px', paddingLeft: '12px', borderLeft: `2px solid #e8a02044`, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '4px' }}>
            {visibleSubFields.map(sf => renderField(sf, true))}
          </div>
        )}
      </div>
    )
  }

  const renderInput = (field, value, handleChange, inp, isSubField) => {
    const labelStyle = { fontSize: isSubField ? '11px' : '12px', color: muted, display: 'block', marginBottom: '5px' }

    switch (field.type) {

      case 'Number':
        return (
          <div>
            <label style={labelStyle}>{field.label}</label>
            <input type="number" value={value || ''} onChange={e => handleChange(e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}`} style={inp} />
            {field.tooltip && <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>💬 {field.tooltip}</div>}
            {field.videoUrl && <a href={field.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2196f3', display: 'block', marginTop: '4px' }}>🎥 Watch guide</a>}
          </div>
        )

      case 'Dropdown':
        return (
          <div>
            <label style={labelStyle}>
              {field.label}
              {Object.keys(field.conditionalFields || {}).length > 0 && (
                <span style={{ marginLeft: '6px', fontSize: '10px', color: '#e8a020', background: '#e8a02015', padding: '1px 5px', borderRadius: '8px' }}>⚡ has sub-fields</span>
              )}
            </label>
            <select value={value || ''} onChange={e => handleChange(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="">— Select {field.label} —</option>
              {(field.options || []).map((opt, i) => {
                const hasSubs = (field.conditionalFields || {})[opt]?.length > 0
                return <option key={i} value={opt}>{opt}{hasSubs ? ' ⚡' : ''}</option>
              })}
            </select>
            {field.tooltip && <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>💬 {field.tooltip}</div>}
            {field.videoUrl && <a href={field.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2196f3', display: 'block', marginTop: '4px' }}>🎥 Watch guide</a>}
          </div>
        )

      case 'Radio': {
        const options = field.options || []
        return (
          <div>
            <label style={labelStyle}>{field.label}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {options.map((opt, i) => {
                const selected = value === opt
                return (
                  <button key={i} onClick={() => handleChange(opt)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${selected ? '#7E6551' : border}`, background: selected ? '#7E6551' : 'transparent', color: selected ? '#FDF4DC' : muted, fontSize: isSubField ? '12px' : '13px', cursor: 'pointer', fontWeight: selected ? '500' : '400', transition: 'all 0.15s' }}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {field.tooltip && <div style={{ fontSize: '11px', color: muted, marginTop: '6px' }}>💬 {field.tooltip}</div>}
            {field.videoUrl && <a href={field.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2196f3', display: 'block', marginTop: '4px' }}>🎥 Watch guide</a>}
          </div>
        )
      }

      case 'Checkbox': {
        const isChecked = value === 'true'
        const hasConditional = (field.conditionalFields?.['checked'] || []).length > 0
        return (
          <div>
            <label style={labelStyle}>{field.label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div onClick={() => handleChange(isChecked ? 'false' : 'true')}
                style={{ width: '44px', height: '24px', borderRadius: '12px', background: isChecked ? '#7E6551' : border, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: '4px', left: isChecked ? '24px' : '4px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
              <span style={{ fontSize: '13px', color: isChecked ? text : muted }}>
                {isChecked ? 'Yes' : 'No'}
                {hasConditional && isChecked && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#e8a020' }}>⚡</span>}
              </span>
            </div>
            {field.tooltip && <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>💬 {field.tooltip}</div>}
            {field.videoUrl && <a href={field.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2196f3', display: 'block', marginTop: '4px' }}>🎥 Watch guide</a>}
          </div>
        )
      }

      case 'RichText':
        return (
          <div>
            <label style={labelStyle}>{field.label}</label>
            <RichTextEditor value={value} onChange={handleChange} inp={inp} muted={muted} border={border} />
            {field.tooltip && <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>💬 {field.tooltip}</div>}
            {field.videoUrl && <a href={field.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2196f3', display: 'block', marginTop: '4px' }}>🎥 Watch guide</a>}
          </div>
        )

      default: // Text
        return (
          <div>
            <label style={labelStyle}>{field.label}</label>
            <input type="text" value={value || ''} onChange={e => handleChange(e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}`} style={inp} />
            {field.tooltip && <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>💬 {field.tooltip}</div>}
            {field.videoUrl && <a href={field.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#2196f3', display: 'block', marginTop: '4px' }}>🎥 Watch guide</a>}
          </div>
        )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {(fields || []).map(field => renderField(field))}
    </div>
  )
}

export function stripHiddenConditionalValues(fields, values) {
  const result = { ...values }
  const processField = (field) => {
    const value = result[field.id]
    const conditionalFields = field.conditionalFields || {}
    Object.entries(conditionalFields).forEach(([conditionKey, subFields]) => {
      const isActive =
        (field.type === 'Dropdown' && value === conditionKey) ||
        (field.type === 'Checkbox' && conditionKey === 'checked' && value === 'true')
      if (!isActive) {
        subFields.forEach(sf => { delete result[sf.id] })
      } else {
        subFields.forEach(sf => processField(sf))
      }
    })
  }
  fields.forEach(field => processField(field))
  return result
}

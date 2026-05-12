'use client'
import { useState, useRef } from 'react'
import { Plus, X, GripVertical, Pencil, Check, ChevronDown, ChevronUp, Bold, Italic, List } from 'lucide-react'

export const FIELD_TYPES = ['Text', 'RichText', 'Number', 'Dropdown', 'Checkbox', 'Radio']

export function getTypeColor(type) {
  const map = { Number: '#2196f3', Dropdown: '#9c27b0', Checkbox: '#4caf50', Text: '#7E6551', RichText: '#e8a020', Radio: '#e05252' }
  return map[type] || '#7E6551'
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// ─── Mini sub-field builder (no drag/nesting) ──────────────────────
function SubFieldBuilder({ subFields, onChange, border, text, muted, inputBg, sectionBg }) {
  const [newSub, setNewSub] = useState({ label: '', type: 'Text', options: [], newOption: '' })

  const addSub = () => {
    if (!newSub.label.trim()) return
    onChange([...subFields, { id: uid(), label: newSub.label, type: newSub.type, options: newSub.type === 'Dropdown' ? newSub.options : [] }])
    setNewSub({ label: '', type: 'Text', options: [], newOption: '' })
  }
  const removeSub = (id) => onChange(subFields.filter(f => f.id !== id))
  const inp = { width: '100%', padding: '6px 9px', borderRadius: '6px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '11px', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {subFields.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: inputBg, borderRadius: '6px', border: `1px solid ${border}` }}>
          <span style={{ flex: 1, fontSize: '11px', fontWeight: '500', color: text }}>{f.label}</span>
          <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', background: getTypeColor(f.type) + '22', color: getTypeColor(f.type) }}>{f.type}</span>
          {(f.options || []).length > 0 && <span style={{ fontSize: '10px', color: muted }}>({f.options.join(', ')})</span>}
          <button onClick={() => removeSub(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: '1px', display: 'flex' }}><X size={10} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '7px', background: sectionBg, borderRadius: '6px', border: `1px dashed ${border}` }}>
        <input value={newSub.label} onChange={e => setNewSub(p => ({ ...p, label: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addSub()} placeholder="Sub-field name" style={inp} />
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {FIELD_TYPES.map(t => (
            <button key={t} onClick={() => setNewSub(p => ({ ...p, type: t, options: [] }))}
              style={{ padding: '2px 7px', borderRadius: '20px', border: `1px solid ${newSub.type === t ? getTypeColor(t) : border}`, background: newSub.type === t ? getTypeColor(t) + '22' : 'transparent', color: newSub.type === t ? getTypeColor(t) : muted, fontSize: '10px', cursor: 'pointer' }}>
              {t}
            </button>
          ))}
        </div>
        {newSub.type === 'Dropdown' && (
          <div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <input value={newSub.newOption} onChange={e => setNewSub(p => ({ ...p, newOption: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && newSub.newOption.trim()) setNewSub(p => ({ ...p, options: [...p.options, p.newOption.trim()], newOption: '' })) }}
                placeholder="Add option" style={{ ...inp, flex: 1 }} />
              <button onClick={() => { if (newSub.newOption.trim()) setNewSub(p => ({ ...p, options: [...p.options, p.newOption.trim()], newOption: '' })) }}
                style={{ padding: '4px 7px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>+</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
              {newSub.options.map((o, i) => (
                <span key={i} style={{ fontSize: '10px', padding: '1px 6px', background: '#9c27b022', color: '#9c27b0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {o}<button onClick={() => setNewSub(p => ({ ...p, options: p.options.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c27b0', padding: 0 }}><X size={8} /></button>
                </span>
              ))}
            </div>
          </div>
        )}
        <button onClick={addSub} style={{ width: '100%', padding: '4px', background: '#7E655115', color: '#7E6551', border: `1px solid #7E655130`, borderRadius: '5px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
          <Plus size={10} /> Add sub-field
        </button>
      </div>
    </div>
  )
}

// ─── Options builder (shared by Dropdown + Radio) ──────────────────
function OptionsBuilder({ options, conditionalFields, onChange, onConditionals, border, text, muted, inputBg, sectionBg, expandedCondition, onExpandCondition, showConditionals = true }) {
  const [newOption, setNewOption] = useState('')
  const [dupeError, setDupeError] = useState(false)

  const addOption = () => {
    const val = newOption.trim()
    if (!val) return
    if (options.some(o => o.toLowerCase() === val.toLowerCase())) {
      setDupeError(true)
      setTimeout(() => setDupeError(false), 2000)
      return
    }
    onChange([...options, val])
    setNewOption('')
    setDupeError(false)
  }

  const removeOption = (i) => {
    const opt = options[i]
    onChange(options.filter((_, idx) => idx !== i))
    if (onConditionals) {
      const nc = { ...conditionalFields }
      delete nc[opt]
      onConditionals(nc)
    }
  }

  const inp = { padding: '7px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
        {options.map((opt, i) => {
          const subs = (conditionalFields || {})[opt] || []
          const isOpen = expandedCondition === opt
          return (
            <div key={i} style={{ borderRadius: '8px', border: `1px solid ${isOpen ? '#e8a02066' : border}`, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: inputBg }}>
                <span style={{ flex: 1, fontSize: '11px', fontWeight: '500', color: text }}>{opt}</span>
                {subs.length > 0 && <span style={{ fontSize: '10px', color: '#e8a020', padding: '1px 5px', background: '#e8a02015', borderRadius: '8px' }}>⚡ {subs.length} sub</span>}
                {showConditionals && onConditionals && (
                  <button
                    onClick={() => onExpandCondition(isOpen ? null : opt)}
                    style={{ background: isOpen ? '#e8a02022' : 'transparent', border: `1px solid ${isOpen ? '#e8a02066' : border}`, borderRadius: '6px', cursor: 'pointer', color: isOpen ? '#e8a020' : muted, padding: '2px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    ⚡ {isOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                  </button>
                )}
                <button onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: '2px', display: 'flex' }}><X size={10} /></button>
              </div>
              {isOpen && showConditionals && onConditionals && (
                <div style={{ padding: '10px', background: '#e8a02005', borderTop: `1px solid #e8a02033` }}>
                  <div style={{ fontSize: '10px', color: '#e8a020', marginBottom: '7px', fontWeight: '500' }}>Sub-fields shown when "{opt}" is selected:</div>
                  <SubFieldBuilder subFields={subs}
                    onChange={updated => {
                      const nc = { ...conditionalFields }
                      if (updated.length === 0) delete nc[opt]; else nc[opt] = updated
                      onConditionals(nc)
                    }}
                    border={border} text={text} muted={muted} inputBg={inputBg} sectionBg={sectionBg} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input value={newOption} onChange={e => { setNewOption(e.target.value); setDupeError(false) }} onKeyDown={e => e.key === 'Enter' && addOption()}
          placeholder="Add option"
          style={{ ...inp, flex: 1, borderColor: dupeError ? '#e05252' : border }} />
        <button onClick={addOption} style={{ padding: '6px 10px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Add</button>
      </div>
      {dupeError && <div style={{ fontSize: '11px', color: '#e05252', marginTop: '2px' }}>⚠ "{newOption}" already exists</div>}
    </div>
  )
}

// ─── Single editable field row ─────────────────────────────────────
function FieldRow({ field, onUpdate, onRemove, border, text, muted, bg, inputBg, sectionBg, dragHandleProps, isDragging, showTooltip, showVideoUrl }) {
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({
    label: field.label,
    type: field.type,
    options: field.options || [],
    tooltip: field.tooltip || '',
    videoUrl: field.videoUrl || '',
    conditionalFields: field.conditionalFields || {},
    expandedCondition: null,
  })

  const handleSave = () => {
    onUpdate(field.id, {
      label: editData.label,
      type: editData.type,
      options: ['Dropdown', 'Radio'].includes(editData.type) ? editData.options : [],
      tooltip: editData.tooltip,
      videoUrl: editData.videoUrl,
      conditionalFields: editData.conditionalFields,
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setEditData({ label: field.label, type: field.type, options: field.options || [], tooltip: field.tooltip || '', videoUrl: field.videoUrl || '', conditionalFields: field.conditionalFields || {}, expandedCondition: null })
    setEditing(false)
  }

  const setSubFields = (key, subFields) => setEditData(p => ({ ...p, conditionalFields: { ...p.conditionalFields, [key]: subFields } }))
  const clearSubFields = (key) => setEditData(p => { const nc = { ...p.conditionalFields }; delete nc[key]; return { ...p, conditionalFields: nc } })

  const totalConditional = Object.values(editData.conditionalFields).reduce((s, a) => s + a.length, 0)
  const inp = { width: '100%', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '12px', outline: 'none' }

  return (
    <div style={{ background: isDragging ? '#7E655108' : sectionBg, borderRadius: '10px', border: `1px solid ${isDragging ? '#7E6551' : border}`, overflow: 'hidden', opacity: isDragging ? 0.8 : 1, transition: 'border 0.15s, opacity 0.15s' }}>

      {!editing ? (
        /* ── Collapsed ── */
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
          <div {...dragHandleProps} style={{ cursor: 'grab', color: muted, display: 'flex', alignItems: 'center', flexShrink: 0, padding: '2px', userSelect: 'none' }}><GripVertical size={14} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label}</span>
              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: getTypeColor(field.type) + '22', color: getTypeColor(field.type), flexShrink: 0 }}>{field.type}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
              {(field.options || []).length > 0 && <span style={{ fontSize: '11px', color: muted }}>{field.options.length} options: {field.options.slice(0, 3).join(', ')}{field.options.length > 3 ? '…' : ''}</span>}
              {field.tooltip && <span style={{ fontSize: '11px', color: muted }}>💬 Tooltip</span>}
              {field.videoUrl && <span style={{ fontSize: '11px', color: '#2196f3' }}>🎥 Video</span>}
              {totalConditional > 0 && <span style={{ fontSize: '11px', color: '#e8a020' }}>⚡ {totalConditional} conditional sub-field{totalConditional !== 1 ? 's' : ''}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px', display: 'flex' }} title="Edit"><Pencil size={13} /></button>
            <button onClick={() => onRemove(field.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, padding: '4px', display: 'flex' }} title="Remove"><X size={13} /></button>
          </div>
        </div>
      ) : (
        /* ── Expanded edit ── */
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontSize: '12px', fontWeight: '500', color: text }}>Edit Field</span>
            <button onClick={handleCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted }}><X size={14} /></button>
          </div>

          {/* Label */}
          <div>
            <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Label</label>
            <input value={editData.label} onChange={e => setEditData(p => ({ ...p, label: e.target.value }))} style={inp} />
          </div>

          {/* Type */}
          <div>
            <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Type</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FIELD_TYPES.map(t => (
                <button key={t} onClick={() => setEditData(p => ({ ...p, type: t, options: ['Dropdown', 'Radio'].includes(t) ? p.options : [], conditionalFields: {} }))}
                  style={{ padding: '4px 10px', borderRadius: '20px', border: `1px solid ${editData.type === t ? getTypeColor(t) : border}`, background: editData.type === t ? getTypeColor(t) + '22' : 'transparent', color: editData.type === t ? getTypeColor(t) : muted, fontSize: '11px', cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Dropdown: options + conditional sub-fields */}
          {editData.type === 'Dropdown' && (
            <div>
              <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '6px' }}>
                Options — click ⚡ to add sub-fields shown when that option is selected
              </label>
              <OptionsBuilder
                options={editData.options}
                conditionalFields={editData.conditionalFields}
                onChange={opts => setEditData(p => ({ ...p, options: opts }))}
                onConditionals={nc => setEditData(p => ({ ...p, conditionalFields: nc }))}
                border={border} text={text} muted={muted} inputBg={inputBg} sectionBg={sectionBg}
                expandedCondition={editData.expandedCondition}
                onExpandCondition={opt => setEditData(p => ({ ...p, expandedCondition: opt }))}
                showConditionals={true}
              />
            </div>
          )}

          {/* Radio: options + conditionals (same as Dropdown) */}
          {editData.type === 'Radio' && (
            <div>
              <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '6px' }}>
                Options — click ⚡ to add sub-fields shown when that option is selected
              </label>
              <OptionsBuilder
                options={editData.options}
                conditionalFields={editData.conditionalFields}
                onChange={opts => setEditData(p => ({ ...p, options: opts }))}
                onConditionals={nc => setEditData(p => ({ ...p, conditionalFields: nc }))}
                border={border} text={text} muted={muted} inputBg={inputBg} sectionBg={sectionBg}
                expandedCondition={editData.expandedCondition}
                onExpandCondition={opt => setEditData(p => ({ ...p, expandedCondition: opt }))}
                showConditionals={true}
              />
              {editData.options.length < 2 && (
                <div style={{ fontSize: '11px', color: '#e05252', marginTop: '6px' }}>⚠ Add at least 2 options</div>
              )}
            </div>
          )}

          {/* Checkbox: optional sub-fields when checked */}
          {editData.type === 'Checkbox' && (
            <div>
              <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '6px' }}>
                Conditional sub-fields <span style={{ fontWeight: '300' }}>(optional — shown only when checked)</span>
              </label>
              <div style={{ borderRadius: '8px', border: `1px solid ${editData.expandedCondition === 'checked' ? '#e8a02066' : border}`, overflow: 'hidden', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', background: inputBg }}>
                  <span style={{ flex: 1, fontSize: '11px', color: text }}>When <strong>checked ✓</strong></span>
                  {(editData.conditionalFields['checked'] || []).length > 0 && (
                    <span style={{ fontSize: '10px', color: '#e8a020', padding: '1px 5px', background: '#e8a02015', borderRadius: '8px' }}>⚡ {editData.conditionalFields['checked'].length} sub</span>
                  )}
                  <button
                    onClick={() => setEditData(p => ({ ...p, expandedCondition: p.expandedCondition === 'checked' ? null : 'checked' }))}
                    style={{ background: editData.expandedCondition === 'checked' ? '#e8a02022' : 'transparent', border: `1px solid ${editData.expandedCondition === 'checked' ? '#e8a02066' : border}`, borderRadius: '6px', cursor: 'pointer', color: editData.expandedCondition === 'checked' ? '#e8a020' : muted, padding: '2px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    ⚡ {editData.expandedCondition === 'checked' ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                  </button>
                </div>
                {editData.expandedCondition === 'checked' && (
                  <div style={{ padding: '10px', background: '#e8a02005', borderTop: `1px solid #e8a02033` }}>
                    <div style={{ fontSize: '10px', color: '#e8a020', marginBottom: '7px', fontWeight: '500' }}>Sub-fields shown when checked:</div>
                    <SubFieldBuilder subFields={editData.conditionalFields['checked'] || []}
                      onChange={updated => updated.length === 0 ? clearSubFields('checked') : setSubFields('checked', updated)}
                      border={border} text={text} muted={muted} inputBg={inputBg} sectionBg={sectionBg} />
                  </div>
                )}
              </div>
              <div style={{ fontSize: '10px', color: muted }}>Leave empty for a regular checkbox with no sub-fields.</div>
            </div>
          )}

          {/* RichText: no extra config needed */}
          {editData.type === 'RichText' && (
            <div style={{ padding: '10px', background: '#e8a02008', borderRadius: '8px', border: `1px solid #e8a02033` }}>
              <div style={{ fontSize: '11px', color: '#e8a020', fontWeight: '500', marginBottom: '4px' }}>📝 Rich Text Field</div>
              <div style={{ fontSize: '11px', color: muted }}>Users get a text editor with bold, italic, and bullet list formatting. Great for descriptions, notes, or account details.</div>
            </div>
          )}

          {/* Tooltip + Video URL */}
          {showTooltip !== false && (
            <div>
              <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Tooltip <span style={{ fontWeight: '300' }}>(optional)</span></label>
              <input value={editData.tooltip} onChange={e => setEditData(p => ({ ...p, tooltip: e.target.value }))} placeholder="Help text shown to user" style={inp} />
            </div>
          )}
          {showVideoUrl !== false && (
            <div>
              <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Video URL <span style={{ fontWeight: '300' }}>(optional)</span></label>
              <input value={editData.videoUrl} onChange={e => setEditData(p => ({ ...p, videoUrl: e.target.value }))} placeholder="https://youtube.com/..." style={inp} />
            </div>
          )}

          <button onClick={handleSave}
            style={{ width: '100%', padding: '8px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Check size={13} /> Save Changes
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main FieldEditor ──────────────────────────────────────────────
export default function FieldEditor({ fields, onFieldsChange, border, text, muted, bg, inputBg, sectionBg, showTooltip = true, showVideoUrl = true }) {
  const [newField, setNewField] = useState({ label: '', type: 'Text', options: [], newOption: '', tooltip: '', videoUrl: '' })
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragNode = useRef(null)

  const handleUpdate = (id, updates) => onFieldsChange(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  const handleRemove = (id) => onFieldsChange(fields.filter(f => f.id !== id))

  const handleAddField = () => {
    if (!newField.label.trim()) return
    onFieldsChange([...fields, {
      id: uid(), label: newField.label, type: newField.type,
      options: ['Dropdown', 'Radio'].includes(newField.type) ? newField.options : [],
      tooltip: newField.tooltip || '', videoUrl: newField.videoUrl || '', conditionalFields: {}
    }])
    setNewField({ label: '', type: 'Text', options: [], newOption: '', tooltip: '', videoUrl: '' })
  }

  const handleDragStart = (e, index) => {
    setDragIndex(index); dragNode.current = e.currentTarget
    dragNode.current.addEventListener('dragend', handleDragEnd)
    setTimeout(() => { if (dragNode.current) dragNode.current.style.opacity = '0.4' }, 0)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragEnd = () => {
    if (dragNode.current) { dragNode.current.style.opacity = '1'; dragNode.current.removeEventListener('dragend', handleDragEnd) }
    setDragIndex(null); setDragOverIndex(null); dragNode.current = null
  }
  const handleDragOver = (e, index) => { e.preventDefault(); if (index !== dragOverIndex) setDragOverIndex(index) }
  const handleDrop = (e, index) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const nf = [...fields]; const [moved] = nf.splice(dragIndex, 1); nf.splice(index, 0, moved)
    onFieldsChange(nf); setDragIndex(null); setDragOverIndex(null)
  }

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: text, fontSize: '13px', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {fields.map((field, index) => (
        <div key={field.id} draggable onDragStart={e => handleDragStart(e, index)} onDragOver={e => handleDragOver(e, index)} onDrop={e => handleDrop(e, index)}
          style={{ outline: dragOverIndex === index && dragIndex !== index ? `2px solid #7E6551` : 'none', borderRadius: '10px', transition: 'outline 0.1s' }}>
          <FieldRow field={field} onUpdate={handleUpdate} onRemove={handleRemove} showTooltip={showTooltip} showVideoUrl={showVideoUrl}
            border={border} text={text} muted={muted} bg={bg} inputBg={inputBg} sectionBg={sectionBg}
            isDragging={dragIndex === index} dragHandleProps={{ onMouseDown: () => {} }} />
        </div>
      ))}

      {fields.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: muted, background: sectionBg, borderRadius: '10px', border: `1px dashed ${border}` }}>
          No fields yet — add one below
        </div>
      )}

      <div style={{ background: sectionBg, borderRadius: '10px', padding: '14px', border: `1px solid ${border}`, marginTop: '4px' }}>
        <div style={{ fontSize: '12px', fontWeight: '500', color: text, marginBottom: '10px' }}>Add Field</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleAddField()} placeholder="Field name e.g. Server" style={inputStyle} />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FIELD_TYPES.map(t => (
              <button key={t} onClick={() => setNewField(p => ({ ...p, type: t, options: [] }))}
                style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${newField.type === t ? getTypeColor(t) : border}`, background: newField.type === t ? getTypeColor(t) + '22' : 'transparent', color: newField.type === t ? getTypeColor(t) : muted, fontSize: '12px', cursor: 'pointer' }}>
                {t}
              </button>
            ))}
          </div>

          {/* Dropdown options in Add form */}
          {newField.type === 'Dropdown' && (
            <div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input value={newField.newOption} onChange={e => setNewField(p => ({ ...p, newOption: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && newField.newOption.trim()) setNewField(p => ({ ...p, options: [...p.options, p.newOption.trim()], newOption: '' })) }}
                  placeholder="Add option" style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }} />
                <button onClick={() => { if (newField.newOption.trim()) setNewField(p => ({ ...p, options: [...p.options, p.newOption.trim()], newOption: '' })) }}
                  style={{ padding: '7px 12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {newField.options.map((opt, i) => (
                  <span key={i} style={{ fontSize: '11px', padding: '2px 8px', background: '#9c27b022', color: '#9c27b0', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {opt}<button onClick={() => setNewField(p => ({ ...p, options: p.options.filter((_, idx) => idx !== i) }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9c27b0', padding: 0, display: 'flex' }}><X size={9} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Radio options in Add form */}
          {newField.type === 'Radio' && (
            <div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input value={newField.newOption} onChange={e => setNewField(p => ({ ...p, newOption: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && newField.newOption.trim()) setNewField(p => ({ ...p, options: [...p.options, p.newOption.trim()], newOption: '' })) }}
                  placeholder="Add option e.g. Bronze" style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }} />
                <button onClick={() => { if (newField.newOption.trim()) setNewField(p => ({ ...p, options: [...p.options, p.newOption.trim()], newOption: '' })) }}
                  style={{ padding: '7px 12px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {newField.options.map((opt, i) => (
                  <span key={i} style={{ fontSize: '11px', padding: '2px 8px', background: '#e0525222', color: '#e05252', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {opt}<button onClick={() => setNewField(p => ({ ...p, options: p.options.filter((_, idx) => idx !== i) }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#e05252', padding: 0, display: 'flex' }}><X size={9} /></button>
                  </span>
                ))}
              </div>
              {newField.options.length < 2 && newField.options.length > 0 && (
                <div style={{ fontSize: '11px', color: '#e05252', marginTop: '4px' }}>⚠ Add at least 2 options</div>
              )}
            </div>
          )}

          {/* RichText info */}
          {newField.type === 'RichText' && (
            <div style={{ padding: '8px 10px', background: '#e8a02008', borderRadius: '8px', border: `1px solid #e8a02033`, fontSize: '11px', color: '#e8a020' }}>
              📝 Users get a text editor with bold, italic, and bullet list formatting.
            </div>
          )}

          {showTooltip && <input value={newField.tooltip} onChange={e => setNewField(p => ({ ...p, tooltip: e.target.value }))} placeholder="Tooltip text (optional)" style={inputStyle} />}
          {showVideoUrl && <input value={newField.videoUrl} onChange={e => setNewField(p => ({ ...p, videoUrl: e.target.value }))} placeholder="Video URL (optional)" style={inputStyle} />}
          <button onClick={handleAddField}
            style={{ width: '100%', padding: '9px', background: '#7E6551', color: '#FDF4DC', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Field
          </button>
        </div>
      </div>
    </div>
  )
}

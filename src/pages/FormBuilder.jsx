import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getForm, createForm, updateForm } from '../lib/supabase'
import { useToast } from '../App'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Plus, Trash2, Copy, Settings2,
  Save, ArrowLeft, Type, AlignLeft, ChevronDown,
  CheckSquare, Circle, Hash, Mail, Phone, Calendar,
  Link2, Star, Upload, ToggleLeft, List, X,
  ExternalLink
} from 'lucide-react'

// ─── Field Type Definitions ──────────────────────
const FIELD_TYPES = [
  { type: 'text', label: 'Short Text', icon: Type },
  { type: 'textarea', label: 'Long Text', icon: AlignLeft },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'url', label: 'URL', icon: Link2 },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'select', label: 'Dropdown', icon: ChevronDown },
  { type: 'radio', label: 'Multiple Choice', icon: Circle },
  { type: 'checkbox', label: 'Checkboxes', icon: CheckSquare },
  { type: 'rating', label: 'Rating', icon: Star },
  { type: 'toggle', label: 'Yes / No', icon: ToggleLeft },
  { type: 'file', label: 'File Upload', icon: Upload },
  { type: 'heading', label: 'Heading', icon: List },
]

function createField(type) {
  const ft = FIELD_TYPES.find(f => f.type === type)
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: ft?.label || 'Field',
    placeholder: '',
    required: false,
    options: ['select', 'radio', 'checkbox'].includes(type) ? ['Option 1', 'Option 2'] : [],
    description: '',
    accept: type === 'file' ? 'image/*,.pdf,.doc,.docx' : '',
    maxSizeMB: type === 'file' ? 10 : 0,
  }
}

// ─── Add Field Button (between fields) ───────────
function AddFieldButton({ onAdd, position }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative flex items-center justify-center py-1 group" ref={ref}>
      <div className="absolute inset-x-8 top-1/2 h-px bg-transparent group-hover:bg-raven-200 transition-smooth" />
      <button
        onClick={() => setOpen(!open)}
        className={`relative z-10 w-6 h-6 flex items-center justify-center rounded-full border transition-smooth ${
          open
            ? 'bg-raven-300 border-raven-300 text-white'
            : 'bg-white border-raven-200 text-raven-500 opacity-0 group-hover:opacity-100 hover:border-raven-300 hover:text-raven-300'
        }`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white border border-raven-200 rounded-xl shadow-lg z-50 p-2 grid grid-cols-2 gap-0.5 max-h-80 overflow-y-auto">
          {FIELD_TYPES.map(ft => {
            const Icon = ft.icon
            return (
              <button
                key={ft.type}
                onClick={() => { onAdd(ft.type, position); setOpen(false) }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-raven-700 hover:bg-raven-900 rounded-lg transition-smooth text-left"
              >
                <Icon className="w-4 h-4 text-raven-300 shrink-0" />
                {ft.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Floating Toolbar ────────────────────────────
function FloatingToolbar({ field, onUpdate, onDelete, onDuplicate }) {
  const [showSettings, setShowSettings] = useState(false)
  const ref = useRef(null)
  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type)
  const isHeading = field.type === 'heading'

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setShowSettings(false)
    }
    if (showSettings) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSettings])

  return (
    <div
      ref={ref}
      data-toolbar="true"
      className="absolute -top-11 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 bg-white border border-raven-200 rounded-lg shadow-lg px-1 py-1"
      onClick={e => e.stopPropagation()}
    >
      {!isHeading && (
        <button
          onClick={() => onUpdate({ ...field, required: !field.required })}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-smooth ${
            field.required ? 'bg-raven-300 text-white' : 'text-raven-500 hover:bg-raven-900'
          }`}
        >
          Required
        </button>
      )}
      {(hasOptions || field.type === 'file' || !isHeading) && (
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-md transition-smooth ${
            showSettings ? 'bg-raven-900 text-raven-300' : 'text-raven-500 hover:bg-raven-900'
          }`}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      )}
      <button onClick={() => onDuplicate(field.id)} className="p-1.5 text-raven-500 hover:bg-raven-900 rounded-md transition-smooth">
        <Copy className="w-4 h-4" />
      </button>
      <button onClick={() => onDelete(field.id)} className="p-1.5 text-raven-500 hover:text-red-500 hover:bg-red-50 rounded-md transition-smooth">
        <Trash2 className="w-4 h-4" />
      </button>

      {showSettings && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-raven-200 rounded-xl shadow-lg z-50 p-4 space-y-3" onClick={e => e.stopPropagation()}>
          {!isHeading && !hasOptions && field.type !== 'rating' && field.type !== 'toggle' && field.type !== 'file' && (
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Placeholder</label>
              <input
                type="text"
                value={field.placeholder || ''}
                onChange={e => onUpdate({ ...field, placeholder: e.target.value })}
                placeholder="Placeholder text..."
                className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-raven-500 mb-1 font-medium">Help text</label>
            <input
              type="text"
              value={field.description || ''}
              onChange={e => onUpdate({ ...field, description: e.target.value })}
              placeholder="Help text below the field"
              className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50"
            />
          </div>
          {hasOptions && (
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Options</label>
              <div className="space-y-1.5">
                {(field.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={e => {
                        const newOpts = [...field.options]
                        newOpts[i] = e.target.value
                        onUpdate({ ...field, options: newOpts })
                      }}
                      className="flex-1 px-3 py-1.5 bg-white border border-raven-200 rounded text-sm text-raven-50"
                    />
                    <button onClick={() => onUpdate({ ...field, options: field.options.filter((_, j) => j !== i) })} className="p-1 text-raven-500 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => onUpdate({ ...field, options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}
                  className="text-xs text-raven-300 hover:text-raven-400 font-medium"
                >
                  + Add option
                </button>
              </div>
            </div>
          )}
          {field.type === 'file' && (
            <>
              <div>
                <label className="block text-xs text-raven-500 mb-1 font-medium">Accepted File Types</label>
                <input
                  type="text"
                  value={field.accept || 'image/*,.pdf,.doc,.docx'}
                  onChange={e => onUpdate({ ...field, accept: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-raven-500 mb-1 font-medium">Max Size (MB)</label>
                <input
                  type="number"
                  value={field.maxSizeMB || 10}
                  onChange={e => onUpdate({ ...field, maxSizeMB: parseInt(e.target.value) || 10 })}
                  min={1} max={50}
                  className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Inline Editable Label ───────────────────────
function InlineLabel({ value, onChange, className, placeholder }) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={e => { if (e.key === 'Enter') setEditing(false) }}
        className={`bg-transparent border-0 border-b-2 border-raven-300 outline-none w-full ${className}`}
        placeholder={placeholder}
      />
    )
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      className={`cursor-text hover:bg-raven-300/10 rounded px-1 -mx-1 transition-smooth inline-block ${className}`}
      title="Click to edit"
    >
      {value || <span className="text-raven-500/50 italic">{placeholder}</span>}
    </span>
  )
}

// ─── Sortable Field (WYSIWYG) ────────────────────
function SortableFormField({ field, isSelected, onSelect, onUpdate, onDelete, onDuplicate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(field.id)}
      className={`relative group rounded-xl p-5 transition-smooth cursor-pointer ${
        isSelected ? 'bg-white ring-2 ring-raven-300/40 shadow-sm' : 'bg-white hover:shadow-sm'
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-raven-200 hover:text-raven-500 transition-smooth"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {isSelected && (
        <FloatingToolbar field={field} onUpdate={onUpdate} onDelete={onDelete} onDuplicate={onDuplicate} />
      )}

      <div className="pl-4">
        {field.type === 'heading' ? (
          <InlineLabel
            value={field.label}
            onChange={val => onUpdate({ ...field, label: val })}
            className="font-display text-lg font-semibold text-raven-50"
            placeholder="Section heading..."
          />
        ) : (
          <>
            <div className="mb-2">
              <InlineLabel
                value={field.label}
                onChange={val => onUpdate({ ...field, label: val })}
                className="text-sm font-medium text-raven-50"
                placeholder="Field label..."
              />
              {field.required && <span className="text-raven-300 ml-0.5 text-sm">*</span>}
            </div>
            {field.description && <p className="text-xs text-raven-500 mb-2">{field.description}</p>}

            {/* Field preview */}
            {field.type === 'textarea' ? (
              <textarea rows={3} placeholder={field.placeholder || 'Type here...'} readOnly className="w-full px-3 py-2.5 bg-raven-900 border border-raven-200 rounded-lg text-sm text-raven-500 resize-none pointer-events-none" />
            ) : field.type === 'select' ? (
              <select className="w-full px-3 py-2.5 bg-raven-900 border border-raven-200 rounded-lg text-sm text-raven-500 pointer-events-none appearance-none">
                <option>Select an option...</option>
                {(field.options || []).map(o => <option key={o}>{o}</option>)}
              </select>
            ) : field.type === 'radio' ? (
              <div className="space-y-2">
                {(field.options || []).map(o => (
                  <label key={o} className="flex items-center gap-2.5 text-sm text-raven-700">
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-raven-200 shrink-0" />
                    {o}
                  </label>
                ))}
              </div>
            ) : field.type === 'checkbox' ? (
              <div className="space-y-2">
                {(field.options || []).map(o => (
                  <label key={o} className="flex items-center gap-2.5 text-sm text-raven-700">
                    <div className="w-[18px] h-[18px] rounded border-2 border-raven-200 shrink-0" />
                    {o}
                  </label>
                ))}
              </div>
            ) : field.type === 'rating' ? (
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => <Star key={n} className="w-7 h-7 text-raven-200" />)}
              </div>
            ) : field.type === 'toggle' ? (
              <div className="w-11 h-6 rounded-full bg-gray-300 relative">
                <div className="w-5 h-5 rounded-full bg-white shadow absolute top-0.5 left-0.5" />
              </div>
            ) : field.type === 'file' ? (
              <div className="border-2 border-dashed border-raven-200 rounded-lg p-6 text-center">
                <Upload className="w-6 h-6 text-raven-300 mx-auto mb-2" />
                <p className="text-sm text-raven-500">Click or drag to upload</p>
                <p className="text-xs text-raven-500/50 mt-1">Max {field.maxSizeMB || 10}MB</p>
              </div>
            ) : (
              <input
                type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                placeholder={field.placeholder || 'Type here...'}
                readOnly
                className="w-full px-3 py-2.5 bg-raven-900 border border-raven-200 rounded-lg text-sm text-raven-500 pointer-events-none"
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Settings Modal ──────────────────────────────
function SettingsModal({ settings, onUpdate, onClose, formDescription, onDescriptionChange }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-raven-200 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-raven-50">Form Settings</h3>
          <button onClick={onClose} className="p-1 text-raven-500 hover:text-raven-50"><X className="w-5 h-5" /></button>
        </div>
        <div>
          <label className="block text-xs text-raven-500 mb-1.5 font-medium">Form Description</label>
          <textarea value={formDescription} onChange={e => onDescriptionChange(e.target.value)} rows={2} placeholder="Optional subtitle" className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50 resize-none" />
        </div>
        <div>
          <label className="block text-xs text-raven-500 mb-1.5 font-medium">Submit Button Text</label>
          <input type="text" value={settings.submit_button_text || 'Submit'} onChange={e => onUpdate({ ...settings, submit_button_text: e.target.value })} className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50" />
        </div>
        <div>
          <label className="block text-xs text-raven-500 mb-1.5 font-medium">Thank You Message</label>
          <textarea value={settings.thank_you_message || ''} onChange={e => onUpdate({ ...settings, thank_you_message: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50 resize-none" />
        </div>
        <div>
          <label className="block text-xs text-raven-500 mb-1.5 font-medium">Redirect URL (optional)</label>
          <input type="url" value={settings.thank_you_url || ''} onChange={e => onUpdate({ ...settings, thank_you_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50" />
        </div>
        <div>
          <label className="block text-xs text-raven-500 mb-1.5 font-medium">Accent Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={settings.accent_color || '#b8923e'} onChange={e => onUpdate({ ...settings, accent_color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
            <span className="text-xs text-raven-500 font-mono">{settings.accent_color || '#b8923e'}</span>
          </div>
        </div>
        <div className="border-t border-raven-200 pt-4 space-y-3">
          <h4 className="text-xs text-raven-500 font-medium">Integrations</h4>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-raven-50 font-medium">Mailchimp</span>
              <p className="text-xs text-raven-500">Auto-subscribe email fields</p>
            </div>
            <button onClick={() => onUpdate({ ...settings, mailchimp_enabled: !settings.mailchimp_enabled })} className={`w-10 h-5 rounded-full transition-smooth relative ${settings.mailchimp_enabled ? 'bg-raven-300' : 'bg-gray-300'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-smooth ${settings.mailchimp_enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          {settings.mailchimp_enabled && (
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Email Field ID</label>
              <input type="text" value={settings.mailchimp_email_field || ''} onChange={e => onUpdate({ ...settings, mailchimp_email_field: e.target.value })} placeholder="e.g. field_abc123" className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50 font-mono" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-raven-50 font-medium">Email Notifications</span>
              <p className="text-xs text-raven-500">Get notified on submissions</p>
            </div>
            <button onClick={() => onUpdate({ ...settings, notification_enabled: !settings.notification_enabled })} className={`w-10 h-5 rounded-full transition-smooth relative ${settings.notification_enabled ? 'bg-raven-300' : 'bg-gray-300'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-smooth ${settings.notification_enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
        <button onClick={onClose} className="w-full py-2.5 bg-raven-300 text-white font-semibold rounded-lg hover:bg-raven-400 transition-smooth text-sm">Done</button>
      </div>
    </div>
  )
}

// ─── Main FormBuilder ────────────────────────────
export default function FormBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const isNew = !id

  const [formTitle, setFormTitle] = useState('Untitled Form')
  const [formDescription, setFormDescription] = useState('')
  const [fields, setFields] = useState([])
  const [settings, setSettings] = useState({
    thank_you_message: 'Thanks for submitting!',
    thank_you_url: '',
    mailchimp_enabled: false,
    mailchimp_email_field: '',
    notification_enabled: true,
    submit_button_text: 'Submit',
    accent_color: '#b8923e',
  })
  const [published, setPublished] = useState(false)
  const [slug, setSlug] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [showSettings, setShowSettings] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Click outside to deselect
  useEffect(() => {
    function handler(e) {
      if (!e.target.closest('[data-field-container]') && !e.target.closest('[data-toolbar]')) {
        setSelectedFieldId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load existing form
  useEffect(() => {
    if (!isNew) {
      getForm(id).then(form => {
        setFormTitle(form.title)
        setFormDescription(form.description || '')
        setFields(form.fields || [])
        setSettings(form.settings || {})
        setPublished(form.published)
        setSlug(form.slug)
        setLoading(false)
      }).catch(() => {
        toast('Form not found', 'error')
        navigate('/dashboard')
      })
    }
  }, [id])

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      setFields(prev => {
        const oldIdx = prev.findIndex(f => f.id === active.id)
        const newIdx = prev.findIndex(f => f.id === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  function addFieldAt(type, position) {
    const newField = createField(type)
    setFields(prev => { const next = [...prev]; next.splice(position, 0, newField); return next })
    setSelectedFieldId(newField.id)
  }

  function deleteField(fieldId) {
    setFields(prev => prev.filter(f => f.id !== fieldId))
    if (selectedFieldId === fieldId) setSelectedFieldId(null)
  }

  function duplicateField(fieldId) {
    const field = fields.find(f => f.id === fieldId)
    if (!field) return
    const dup = { ...field, id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, label: `${field.label} (copy)` }
    const idx = fields.findIndex(f => f.id === fieldId)
    setFields(prev => [...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)])
    setSelectedFieldId(dup.id)
  }

  function updateField(updated) {
    setFields(prev => prev.map(f => f.id === updated.id ? updated : f))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const formData = { title: formTitle, description: formDescription, fields, settings, published }
      if (isNew) {
        const created = await createForm(formData)
        toast('Form created!')
        navigate(`/forms/${created.id}/edit`, { replace: true })
      } else {
        await updateForm(id, formData)
        toast('Form saved!')
      }
    } catch (err) {
      toast('Save failed: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleTogglePublish() {
    const next = !published
    setPublished(next)
    if (!isNew) {
      try {
        await updateForm(id, { published: next })
        toast(next ? 'Form published!' : 'Form unpublished')
      } catch (err) {
        setPublished(!next)
        toast('Failed to update', 'error')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-raven-300 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const accentColor = settings.accent_color || '#b8923e'

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-raven-200">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 text-raven-500 hover:text-raven-50 transition-smooth">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-raven-500 hover:text-raven-50 border border-raven-200 rounded-lg transition-smooth">
            <Settings2 className="w-3.5 h-3.5" /> Settings
          </button>
          {slug && published && (
            <button onClick={() => window.open(`/f/${slug}`, '_blank')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-raven-500 hover:text-raven-50 border border-raven-200 rounded-lg transition-smooth">
              <ExternalLink className="w-3.5 h-3.5" /> View Live
            </button>
          )}
          <button onClick={handleTogglePublish} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-smooth ${published ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-white text-raven-500 border border-raven-200 hover:text-raven-50'}`}>
            {published ? 'Published' : 'Publish'}
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-raven-300 hover:bg-raven-400 text-white text-sm font-semibold rounded-lg transition-smooth disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* WYSIWYG Canvas */}
      <div className="max-w-2xl mx-auto" data-field-container>
        <div className="mb-6">
          <InlineLabel value={formTitle} onChange={setFormTitle} className="font-display text-2xl font-bold text-raven-50" placeholder="Form title..." />
          {formDescription && <p className="text-sm text-raven-500 mt-1">{formDescription}</p>}
        </div>

        <AddFieldButton onAdd={addFieldAt} position={0} />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((field, index) => (
              <div key={field.id}>
                <SortableFormField
                  field={field}
                  isSelected={selectedFieldId === field.id}
                  onSelect={setSelectedFieldId}
                  onUpdate={updateField}
                  onDelete={deleteField}
                  onDuplicate={duplicateField}
                />
                <AddFieldButton onAdd={addFieldAt} position={index + 1} />
              </div>
            ))}
          </SortableContext>
        </DndContext>

        {fields.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-raven-200 rounded-xl">
            <Plus className="w-8 h-8 text-raven-300 mx-auto mb-3" />
            <p className="text-raven-500 text-sm">Hover between the lines and click <strong>+</strong> to add your first field</p>
          </div>
        )}

        {fields.length > 0 && (
          <div className="mt-4 mb-8">
            <button className="w-full py-3 rounded-lg text-sm font-semibold text-white pointer-events-none" style={{ backgroundColor: accentColor }}>
              {settings.submit_button_text || 'Submit'}
            </button>
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal settings={settings} onUpdate={setSettings} onClose={() => setShowSettings(false)} formDescription={formDescription} onDescriptionChange={setFormDescription} />
      )}
    </div>
  )
}

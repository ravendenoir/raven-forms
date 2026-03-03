import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getForm, createForm, updateForm } from '../lib/supabase'
import { useToast } from '../App'
import {
  DndContext, closestCenter, KeyboardSensor,
  PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Plus, Trash2, Copy, Settings, Eye,
  Save, ArrowLeft, Type, AlignLeft, ChevronDown,
  CheckSquare, Circle, Hash, Mail, Phone, Calendar,
  Link2, Star, Upload, ToggleLeft, List
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
  { type: 'heading', label: 'Heading', icon: List },
]

function createField(type) {
  const fieldType = FIELD_TYPES.find(f => f.type === type)
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: fieldType?.label || 'Field',
    placeholder: '',
    required: false,
    options: ['select', 'radio', 'checkbox'].includes(type)
      ? ['Option 1', 'Option 2']
      : [],
    description: '',
  }
}

// ─── Sortable Field Item ─────────────────────────
function SortableField({ field, isSelected, onSelect, onDelete, onDuplicate }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = FIELD_TYPES.find(f => f.type === field.type)?.icon || Type

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(field.id)}
      className={`group flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-smooth ${
        isSelected
          ? 'border-raven-300/40 bg-raven-800/50'
          : 'border-raven-800/30 bg-raven-850 hover:border-raven-800/60'
      }`}
    >
      <button {...attributes} {...listeners} className="text-raven-300/30 hover:text-raven-300/60 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </button>

      <Icon className="w-4 h-4 text-raven-300/50 shrink-0" />

      <div className="flex-1 min-w-0">
        <span className="text-sm text-raven-50 truncate block">{field.label}</span>
        <span className="text-xs text-raven-300/40">{FIELD_TYPES.find(f => f.type === field.type)?.label}</span>
      </div>

      {field.required && (
        <span className="text-xs text-raven-300/70 font-medium">Required</span>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-smooth">
        <button
          onClick={e => { e.stopPropagation(); onDuplicate(field.id) }}
          className="p-1 text-raven-300/40 hover:text-raven-300 rounded transition-smooth"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(field.id) }}
          className="p-1 text-raven-300/40 hover:text-red-400 rounded transition-smooth"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Field Properties Panel ──────────────────────
function FieldProperties({ field, onUpdate }) {
  if (!field) {
    return (
      <div className="h-full flex items-center justify-center text-raven-300/30 text-sm">
        Select a field to edit its properties
      </div>
    )
  }

  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type)
  const isHeading = field.type === 'heading'

  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-semibold text-raven-50 flex items-center gap-2">
        <Settings className="w-4 h-4 text-raven-300/50" />
        Field Properties
      </h3>

      {/* Label */}
      <div>
        <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Label</label>
        <input
          type="text"
          value={field.label}
          onChange={e => onUpdate({ ...field, label: e.target.value })}
          className="w-full px-3 py-2 bg-raven-900 border border-raven-800/50 rounded-lg text-sm text-raven-50"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Description (optional)</label>
        <input
          type="text"
          value={field.description || ''}
          onChange={e => onUpdate({ ...field, description: e.target.value })}
          placeholder="Help text below the field"
          className="w-full px-3 py-2 bg-raven-900 border border-raven-800/50 rounded-lg text-sm text-raven-50 placeholder:text-raven-300/30"
        />
      </div>

      {/* Placeholder */}
      {!isHeading && !hasOptions && field.type !== 'rating' && field.type !== 'toggle' && (
        <div>
          <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Placeholder</label>
          <input
            type="text"
            value={field.placeholder || ''}
            onChange={e => onUpdate({ ...field, placeholder: e.target.value })}
            placeholder="Placeholder text..."
            className="w-full px-3 py-2 bg-raven-900 border border-raven-800/50 rounded-lg text-sm text-raven-50 placeholder:text-raven-300/30"
          />
        </div>
      )}

      {/* Options for select/radio/checkbox */}
      {hasOptions && (
        <div>
          <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Options</label>
          <div className="space-y-2">
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
                  className="flex-1 px-3 py-1.5 bg-raven-900 border border-raven-800/50 rounded text-sm text-raven-50"
                />
                <button
                  onClick={() => {
                    const newOpts = field.options.filter((_, j) => j !== i)
                    onUpdate({ ...field, options: newOpts })
                  }}
                  className="p-1 text-raven-300/40 hover:text-red-400 transition-smooth"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => onUpdate({ ...field, options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}
              className="text-xs text-raven-300/60 hover:text-raven-300 transition-smooth"
            >
              + Add option
            </button>
          </div>
        </div>
      )}

      {/* Required toggle */}
      {!isHeading && (
        <div className="flex items-center justify-between py-2">
          <label className="text-xs text-raven-300/60 font-medium">Required</label>
          <button
            onClick={() => onUpdate({ ...field, required: !field.required })}
            className={`w-10 h-5 rounded-full transition-smooth relative ${
              field.required ? 'bg-raven-300' : 'bg-raven-800/60'
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-smooth ${
              field.required ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Form Settings Panel ─────────────────────────
function FormSettings({ settings, onUpdate }) {
  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-semibold text-raven-50">Form Settings</h3>

      <div>
        <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Submit Button Text</label>
        <input
          type="text"
          value={settings.submit_button_text || 'Submit'}
          onChange={e => onUpdate({ ...settings, submit_button_text: e.target.value })}
          className="w-full px-3 py-2 bg-raven-900 border border-raven-800/50 rounded-lg text-sm text-raven-50"
        />
      </div>

      <div>
        <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Thank You Message</label>
        <textarea
          value={settings.thank_you_message || ''}
          onChange={e => onUpdate({ ...settings, thank_you_message: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 bg-raven-900 border border-raven-800/50 rounded-lg text-sm text-raven-50 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Redirect URL (optional)</label>
        <input
          type="url"
          value={settings.thank_you_url || ''}
          onChange={e => onUpdate({ ...settings, thank_you_url: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 bg-raven-900 border border-raven-800/50 rounded-lg text-sm text-raven-50 placeholder:text-raven-300/30"
        />
      </div>

      <div>
        <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Accent Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.accent_color || '#c9a55c'}
            onChange={e => onUpdate({ ...settings, accent_color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
          />
          <span className="text-xs text-raven-300/50 font-mono">{settings.accent_color || '#c9a55c'}</span>
        </div>
      </div>

      <div className="border-t border-raven-800/30 pt-4">
        <h4 className="text-xs text-raven-300/60 font-medium mb-3">Integrations</h4>

        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm text-raven-50">Mailchimp</span>
            <p className="text-xs text-raven-300/40">Auto-subscribe email fields</p>
          </div>
          <button
            onClick={() => onUpdate({ ...settings, mailchimp_enabled: !settings.mailchimp_enabled })}
            className={`w-10 h-5 rounded-full transition-smooth relative ${
              settings.mailchimp_enabled ? 'bg-raven-300' : 'bg-raven-800/60'
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-smooth ${
              settings.mailchimp_enabled ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {settings.mailchimp_enabled && (
          <div className="mt-2">
            <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Email Field ID (from your form)</label>
            <input
              type="text"
              value={settings.mailchimp_email_field || ''}
              onChange={e => onUpdate({ ...settings, mailchimp_email_field: e.target.value })}
              placeholder="e.g. field_abc123"
              className="w-full px-3 py-2 bg-raven-900 border border-raven-800/50 rounded-lg text-sm text-raven-50 placeholder:text-raven-300/30 font-mono"
            />
          </div>
        )}

        <div className="flex items-center justify-between py-2 mt-2">
          <div>
            <span className="text-sm text-raven-50">Email Notifications</span>
            <p className="text-xs text-raven-300/40">Get notified on submissions</p>
          </div>
          <button
            onClick={() => onUpdate({ ...settings, notification_enabled: !settings.notification_enabled })}
            className={`w-10 h-5 rounded-full transition-smooth relative ${
              settings.notification_enabled ? 'bg-raven-300' : 'bg-raven-800/60'
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-smooth ${
              settings.notification_enabled ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main FormBuilder Component ──────────────────
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
    accent_color: '#c9a55c',
  })
  const [published, setPublished] = useState(false)
  const [slug, setSlug] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState(null)
  const [rightPanel, setRightPanel] = useState('properties') // 'properties' | 'settings'
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [showFieldPicker, setShowFieldPicker] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

  const selectedField = fields.find(f => f.id === selectedFieldId)

  // Drag end handler
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

  // Add field
  function addField(type) {
    const newField = createField(type)
    setFields(prev => [...prev, newField])
    setSelectedFieldId(newField.id)
    setRightPanel('properties')
    setShowFieldPicker(false)
  }

  // Delete field
  function deleteField(fieldId) {
    setFields(prev => prev.filter(f => f.id !== fieldId))
    if (selectedFieldId === fieldId) setSelectedFieldId(null)
  }

  // Duplicate field
  function duplicateField(fieldId) {
    const field = fields.find(f => f.id === fieldId)
    if (!field) return
    const dup = {
      ...field,
      id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: `${field.label} (copy)`,
    }
    const idx = fields.findIndex(f => f.id === fieldId)
    setFields(prev => [...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)])
    setSelectedFieldId(dup.id)
  }

  // Update field
  function updateField(updatedField) {
    setFields(prev => prev.map(f => f.id === updatedField.id ? updatedField : f))
  }

  // Save form
  async function handleSave() {
    setSaving(true)
    try {
      const formData = {
        title: formTitle,
        description: formDescription,
        fields,
        settings,
        published,
      }
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

  // Toggle publish
  async function handleTogglePublish() {
    const next = !published
    setPublished(next)
    if (!isNew) {
      try {
        await updateForm(id, { published: next })
        toast(next ? 'Form published!' : 'Form unpublished')
      } catch (err) {
        setPublished(!next)
        toast('Failed to update publish status', 'error')
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-4 border-b border-raven-800/30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-1.5 text-raven-300/50 hover:text-raven-300 transition-smooth">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            className="bg-transparent border-0 font-display text-lg font-bold text-raven-50 focus:outline-none focus:ring-0 w-64"
            placeholder="Form title..."
          />
        </div>

        <div className="flex items-center gap-2">
          {slug && (
            <button
              onClick={() => window.open(`/f/${slug}`, '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-raven-300/60 hover:text-raven-300 border border-raven-800/40 rounded-lg transition-smooth"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          )}
          <button
            onClick={handleTogglePublish}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-smooth ${
              published
                ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/50'
                : 'bg-raven-800/40 text-raven-300/60 border border-raven-800/40 hover:text-raven-300'
            }`}
          >
            {published ? 'Published' : 'Publish'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-raven-300 hover:bg-raven-200 text-raven-950 text-sm font-semibold rounded-lg transition-smooth disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content: 3-column layout */}
      <div className="flex flex-1 gap-4 pt-4 overflow-hidden">
        {/* LEFT: Field List */}
        <div className="w-80 shrink-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-raven-300/60 uppercase tracking-wider">Fields</h3>
            <button
              onClick={() => setShowFieldPicker(!showFieldPicker)}
              className="flex items-center gap-1 text-xs text-raven-300 hover:text-raven-200 transition-smooth"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {/* Field type picker dropdown */}
          {showFieldPicker && (
            <div className="mb-3 p-2 bg-raven-850 border border-raven-800/50 rounded-lg grid grid-cols-2 gap-1 max-h-72 overflow-y-auto">
              {FIELD_TYPES.map(ft => {
                const Icon = ft.icon
                return (
                  <button
                    key={ft.type}
                    onClick={() => addField(ft.type)}
                    className="flex items-center gap-2 px-2.5 py-2 text-xs text-raven-300/70 hover:text-raven-50 hover:bg-raven-800/50 rounded-md transition-smooth text-left"
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {ft.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Sortable field list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {fields.length === 0 ? (
              <div className="text-center py-12 text-raven-300/30 text-xs">
                Click "+ Add" to start building your form
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  {fields.map(field => (
                    <SortableField
                      key={field.id}
                      field={field}
                      isSelected={selectedFieldId === field.id}
                      onSelect={setSelectedFieldId}
                      onDelete={deleteField}
                      onDuplicate={duplicateField}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* CENTER: Live Preview */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto">
            <div className="bg-raven-850 border border-raven-800/30 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-display text-xl font-bold text-raven-50">{formTitle || 'Untitled Form'}</h2>
                {formDescription && (
                  <p className="text-sm text-raven-300/60 mt-1">{formDescription}</p>
                )}
              </div>
              {fields.map(field => (
                <div
                  key={field.id}
                  onClick={() => { setSelectedFieldId(field.id); setRightPanel('properties') }}
                  className={`p-3 rounded-lg border transition-smooth cursor-pointer ${
                    selectedFieldId === field.id
                      ? 'border-raven-300/30 bg-raven-800/20'
                      : 'border-transparent hover:border-raven-800/20'
                  }`}
                >
                  {field.type === 'heading' ? (
                    <h3 className="font-display text-base font-semibold text-raven-50">{field.label}</h3>
                  ) : (
                    <>
                      <label className="block text-sm text-raven-50 mb-1.5">
                        {field.label}
                        {field.required && <span className="text-raven-300 ml-1">*</span>}
                      </label>
                      {field.description && (
                        <p className="text-xs text-raven-300/40 mb-2">{field.description}</p>
                      )}
                      {field.type === 'textarea' ? (
                        <textarea rows={3} placeholder={field.placeholder} readOnly
                          className="w-full px-3 py-2 bg-raven-900/50 border border-raven-800/40 rounded-lg text-sm text-raven-300/30 resize-none" />
                      ) : field.type === 'select' ? (
                        <select className="w-full px-3 py-2 bg-raven-900/50 border border-raven-800/40 rounded-lg text-sm text-raven-300/50">
                          <option>Select...</option>
                          {(field.options || []).map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : field.type === 'radio' ? (
                        <div className="space-y-1.5">
                          {(field.options || []).map(o => (
                            <label key={o} className="flex items-center gap-2 text-sm text-raven-300/60">
                              <div className="w-4 h-4 rounded-full border border-raven-800/50" />
                              {o}
                            </label>
                          ))}
                        </div>
                      ) : field.type === 'checkbox' ? (
                        <div className="space-y-1.5">
                          {(field.options || []).map(o => (
                            <label key={o} className="flex items-center gap-2 text-sm text-raven-300/60">
                              <div className="w-4 h-4 rounded border border-raven-800/50" />
                              {o}
                            </label>
                          ))}
                        </div>
                      ) : field.type === 'rating' ? (
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} className="w-6 h-6 text-raven-800/40" />
                          ))}
                        </div>
                      ) : field.type === 'toggle' ? (
                        <div className="w-10 h-5 rounded-full bg-raven-800/50 relative">
                          <div className="w-4 h-4 rounded-full bg-raven-300/30 absolute top-0.5 left-0.5" />
                        </div>
                      ) : (
                        <input type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          placeholder={field.placeholder} readOnly
                          className="w-full px-3 py-2 bg-raven-900/50 border border-raven-800/40 rounded-lg text-sm text-raven-300/30" />
                      )}
                    </>
                  )}
                </div>
              ))}
              {fields.length > 0 && (
                <button
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-raven-950"
                  style={{ backgroundColor: settings.accent_color || '#c9a55c' }}
                >
                  {settings.submit_button_text || 'Submit'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Properties / Settings */}
        <div className="w-72 shrink-0 overflow-y-auto">
          <div className="flex items-center gap-1 mb-4">
            <button
              onClick={() => setRightPanel('properties')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-smooth ${
                rightPanel === 'properties'
                  ? 'bg-raven-800/60 text-raven-50'
                  : 'text-raven-300/50 hover:text-raven-300'
              }`}
            >
              Properties
            </button>
            <button
              onClick={() => setRightPanel('settings')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-smooth ${
                rightPanel === 'settings'
                  ? 'bg-raven-800/60 text-raven-50'
                  : 'text-raven-300/50 hover:text-raven-300'
              }`}
            >
              Settings
            </button>
          </div>

          {rightPanel === 'properties' ? (
            <FieldProperties field={selectedField} onUpdate={updateField} />
          ) : (
            <FormSettings settings={settings} onUpdate={setSettings} />
          )}

          {/* Form description (in settings panel) */}
          {rightPanel === 'settings' && (
            <div className="mt-4 pt-4 border-t border-raven-800/30">
              <label className="block text-xs text-raven-300/60 mb-1.5 font-medium">Form Description</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                rows={2}
                placeholder="Optional subtitle for your form"
                className="w-full px-3 py-2 bg-raven-900 border border-raven-800/50 rounded-lg text-sm text-raven-50 resize-none placeholder:text-raven-300/30"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

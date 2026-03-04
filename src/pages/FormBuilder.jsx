import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getForm, createForm, updateForm, uploadFile } from '../lib/supabase'
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
  ExternalLink, Image, UserCircle, FileText,
  Columns, Loader2, Bold, Italic, Underline,
  ListOrdered, Quote, Palette, ALargeSmall
} from 'lucide-react'

const FIELD_TYPES = [
  { type: 'banner_image', label: 'Banner Image', icon: Image, category: 'content' },
  { type: 'avatar_image', label: 'Avatar Image', icon: UserCircle, category: 'content' },
  { type: 'richtext', label: 'Text Block', icon: FileText, category: 'content' },
  { type: 'heading', label: 'Heading', icon: List, category: 'content' },
  { type: 'text', label: 'Short Text', icon: Type, category: 'input' },
  { type: 'textarea', label: 'Long Text', icon: AlignLeft, category: 'input' },
  { type: 'email', label: 'Email', icon: Mail, category: 'input' },
  { type: 'number', label: 'Number', icon: Hash, category: 'input' },
  { type: 'phone', label: 'Phone', icon: Phone, category: 'input' },
  { type: 'url', label: 'URL', icon: Link2, category: 'input' },
  { type: 'date', label: 'Date', icon: Calendar, category: 'input' },
  { type: 'select', label: 'Dropdown', icon: ChevronDown, category: 'input' },
  { type: 'radio', label: 'Multiple Choice', icon: Circle, category: 'input' },
  { type: 'checkbox', label: 'Checkboxes', icon: CheckSquare, category: 'input' },
  { type: 'rating', label: 'Rating', icon: Star, category: 'input' },
  { type: 'toggle', label: 'Yes / No', icon: ToggleLeft, category: 'input' },
  { type: 'file', label: 'Image', icon: Upload, category: 'content' },
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
    accept: '',
    maxSizeMB: 0,
    width: type === 'banner_image' ? 'full' : type === 'avatar_image' ? 'full' : 'full',
    content: type === 'richtext' ? 'Click to edit this text block...' : '',
    imageUrl: '',
    imageWidthPx: 0,
    imagePositionY: 50,
  }
}

// ─── Add Field Button ────────────────────────────
function AddFieldButton({ onAdd, position, alwaysShow }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative flex items-center justify-center py-2 group" ref={ref}>
      <div className="absolute inset-x-8 top-1/2 h-px bg-transparent group-hover:bg-raven-200 transition-smooth" />
      <button
        onClick={() => setOpen(!open)}
        className={`relative z-10 w-7 h-7 flex items-center justify-center rounded-full border transition-smooth ${
          open ? 'bg-raven-300 border-raven-300 text-white'
            : alwaysShow ? 'bg-white border-raven-300 text-raven-300 hover:bg-raven-300 hover:text-white shadow-sm'
            : 'bg-white border-raven-200 text-raven-500 opacity-0 group-hover:opacity-100 hover:border-raven-300 hover:text-raven-300'
        }`}
      >
        <Plus className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[340px] bg-white border border-raven-200 rounded-xl shadow-lg z-50 p-3 max-h-96 overflow-y-auto">
          <p className="text-[10px] font-semibold text-raven-500 uppercase tracking-wider mb-1.5 px-1">Content</p>
          <div className="grid grid-cols-2 gap-0.5 mb-2">
            {FIELD_TYPES.filter(f => f.category === 'content').map(ft => {
              const Icon = ft.icon
              return (
                <button key={ft.type} onClick={() => { onAdd(ft.type, position); setOpen(false) }}
                  className="flex items-center gap-2 px-2.5 py-2 text-sm text-raven-700 hover:bg-raven-900 rounded-lg transition-smooth text-left">
                  <Icon className="w-4 h-4 text-raven-300 shrink-0" /> {ft.label}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] font-semibold text-raven-500 uppercase tracking-wider mb-1.5 px-1">Form Fields</p>
          <div className="grid grid-cols-2 gap-0.5">
            {FIELD_TYPES.filter(f => f.category === 'input').map(ft => {
              const Icon = ft.icon
              return (
                <button key={ft.type} onClick={() => { onAdd(ft.type, position); setOpen(false) }}
                  className="flex items-center gap-2 px-2.5 py-2 text-sm text-raven-700 hover:bg-raven-900 rounded-lg transition-smooth text-left">
                  <Icon className="w-4 h-4 text-raven-300 shrink-0" /> {ft.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Floating Toolbar ────────────────────────────
function FloatingToolbar({ field, onUpdate, onDelete, onDuplicate, fields }) {
  const [showSettings, setShowSettings] = useState(false)
  const ref = useRef(null)
  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type)
  const isContent = ['heading', 'banner_image', 'avatar_image', 'richtext', 'file'].includes(field.type)
  const hasWidth = !['banner_image'].includes(field.type)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setShowSettings(false) }
    if (showSettings) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSettings])

  return (
    <div ref={ref} data-toolbar="true"
      className="absolute -top-11 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 bg-white border border-raven-200 rounded-lg shadow-lg px-1 py-1"
      onClick={e => e.stopPropagation()}>

      {!isContent && (
        <button onClick={() => onUpdate({ ...field, required: !field.required })}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-smooth ${field.required ? 'bg-raven-300 text-white' : 'text-raven-500 hover:bg-raven-900'}`}>
          Required
        </button>
      )}

      {/* Width control */}
      {hasWidth && (
        <div className="flex items-center border-l border-raven-200 ml-0.5 pl-0.5">
          {['full', 'half', 'third'].map(w => (
            <button key={w} onClick={() => onUpdate({ ...field, width: w })}
              className={`px-2 py-1.5 text-[10px] font-medium rounded-md transition-smooth ${field.width === w ? 'bg-raven-900 text-raven-300' : 'text-raven-500 hover:bg-raven-900'}`}
              title={w === 'full' ? '100%' : w === 'half' ? '50%' : '33%'}>
              {w === 'full' ? '1/1' : w === 'half' ? '1/2' : '1/3'}
            </button>
          ))}
        </div>
      )}

      <button onClick={() => setShowSettings(!showSettings)}
        className={`p-1.5 rounded-md transition-smooth ${showSettings ? 'bg-raven-900 text-raven-300' : 'text-raven-500 hover:bg-raven-900'}`}>
        <Settings2 className="w-4 h-4" />
      </button>
      <button onClick={() => onDuplicate(field.id)} className="p-1.5 text-raven-500 hover:bg-raven-900 rounded-md transition-smooth">
        <Copy className="w-4 h-4" />
      </button>
      <button onClick={() => onDelete(field.id)} className="p-1.5 text-raven-500 hover:text-red-500 hover:bg-red-50 rounded-md transition-smooth">
        <Trash2 className="w-4 h-4" />
      </button>

      {showSettings && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-raven-200 rounded-xl shadow-lg z-50 p-4 space-y-3" onClick={e => e.stopPropagation()}>
          {!isContent && !hasOptions && field.type !== 'rating' && field.type !== 'toggle' && field.type !== 'file' && (
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Placeholder</label>
              <input type="text" value={field.placeholder || ''} onChange={e => onUpdate({ ...field, placeholder: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50" />
            </div>
          )}
          {!['banner_image', 'avatar_image', 'file'].includes(field.type) && (
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Help text</label>
              <input type="text" value={field.description || ''} onChange={e => onUpdate({ ...field, description: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50" />
            </div>
          )}
          {hasOptions && (
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Options</label>
              <div className="space-y-1.5">
                {(field.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={opt}
                      onChange={e => { const o = [...field.options]; o[i] = e.target.value; onUpdate({ ...field, options: o }) }}
                      className="flex-1 px-3 py-1.5 bg-white border border-raven-200 rounded text-sm text-raven-50" />
                    <button onClick={() => onUpdate({ ...field, options: field.options.filter((_, j) => j !== i) })} className="p-1 text-raven-500 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button onClick={() => onUpdate({ ...field, options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}
                  className="text-xs text-raven-300 hover:text-raven-400 font-medium">+ Add option</button>
              </div>
            </div>
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
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select() } }, [editing])

  if (editing) {
    return <input ref={inputRef} type="text" value={value} onChange={e => onChange(e.target.value)}
      onBlur={() => setEditing(false)} onKeyDown={e => { if (e.key === 'Enter') setEditing(false) }}
      className={`bg-transparent border-0 border-b-2 border-raven-300 outline-none w-full ${className}`} placeholder={placeholder} />
  }
  return (
    <span onClick={e => { e.stopPropagation(); setEditing(true) }}
      className={`cursor-text hover:bg-raven-300/10 rounded px-1 -mx-1 transition-smooth inline-block ${className}`} title="Click to edit">
      {value || <span className="text-raven-500/50 italic">{placeholder}</span>}
    </span>
  )
}

// ─── Inline Rich Text Editor ─────────────────────
function InlineRichText({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const editorRef = useRef(null)
  const containerRef = useRef(null)
  const [showColor, setShowColor] = useState(false)
  const [showFont, setShowFont] = useState(false)
  const [showSize, setShowSize] = useState(false)

  const FONTS = [
    { label: 'Sans Serif', val: 'DM Sans, sans-serif' },
    { label: 'Serif', val: 'Georgia, Times New Roman, serif' },
    { label: 'Monospace', val: 'Courier New, monospace' },
    { label: 'Cursive', val: 'Brush Script MT, cursive' },
  ]
  const SIZES = [
    { label: 'Small', val: '2' },
    { label: 'Normal', val: '3' },
    { label: 'Large', val: '5' },
    { label: 'X-Large', val: '6' },
  ]
  const COLORS = ['#2a2520','#b8923e','#dc2626','#2563eb','#16a34a','#9333ea','#ea580c','#ffffff']

  useEffect(() => {
    if (editing && editorRef.current) {
      editorRef.current.innerHTML = value || ''
      editorRef.current.focus()
    }
  }, [editing])

  useEffect(() => {
    function outside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        save()
        setEditing(false)
      }
    }
    if (editing) document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [editing])

  function save() {
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  function exec(cmd, val) {
    document.execCommand(cmd, false, val || null)
    editorRef.current?.focus()
  }

  function closeAll() { setShowColor(false); setShowFont(false); setShowSize(false) }

  function TBtn({ onMouseDown: handler, active, children, title }) {
    return (
      <button type="button" title={title}
        onMouseDown={e => { e.preventDefault(); handler() }}
        className={`p-1.5 rounded transition-smooth ${active ? 'bg-raven-300 text-white' : 'text-raven-500 hover:bg-raven-900 hover:text-raven-50'}`}>
        {children}
      </button>
    )
  }

  if (editing) {
    return (
      <div ref={containerRef} className="border border-raven-300 rounded-lg overflow-visible" onClick={e => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-raven-900 border-b border-raven-200 relative">
          {/* Font picker */}
          <div className="relative">
            <button type="button" onMouseDown={e => { e.preventDefault(); closeAll(); setShowFont(!showFont) }}
              className="px-2 py-1 text-[11px] text-raven-500 hover:bg-white rounded transition-smooth flex items-center gap-1">
              <Type className="w-3.5 h-3.5" /> Font <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showFont && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-raven-200 rounded-lg shadow-lg z-50 py-1">
                {FONTS.map(f => (
                  <button key={f.val} type="button"
                    onMouseDown={e => { e.preventDefault(); exec('fontName', f.val); setShowFont(false) }}
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-raven-900 transition-smooth"
                    style={{ fontFamily: f.val }}>{f.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Size picker */}
          <div className="relative">
            <button type="button" onMouseDown={e => { e.preventDefault(); closeAll(); setShowSize(!showSize) }}
              className="px-2 py-1 text-[11px] text-raven-500 hover:bg-white rounded transition-smooth flex items-center gap-1">
              <ALargeSmall className="w-3.5 h-3.5" /> Size <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showSize && (
              <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-raven-200 rounded-lg shadow-lg z-50 py-1">
                {SIZES.map(s => (
                  <button key={s.val} type="button"
                    onMouseDown={e => { e.preventDefault(); exec('fontSize', s.val); setShowSize(false) }}
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-raven-900 transition-smooth">{s.label}</button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-raven-200 mx-0.5" />

          <TBtn onMouseDown={() => exec('bold')} title="Bold"><Bold className="w-3.5 h-3.5" /></TBtn>
          <TBtn onMouseDown={() => exec('italic')} title="Italic"><Italic className="w-3.5 h-3.5" /></TBtn>
          <TBtn onMouseDown={() => exec('underline')} title="Underline"><Underline className="w-3.5 h-3.5" /></TBtn>

          <div className="w-px h-5 bg-raven-200 mx-0.5" />

          {/* Color picker */}
          <div className="relative">
            <button type="button" onMouseDown={e => { e.preventDefault(); closeAll(); setShowColor(!showColor) }}
              className="p-1.5 text-raven-500 hover:bg-raven-900 rounded transition-smooth" title="Text Color">
              <Palette className="w-3.5 h-3.5" />
            </button>
            {showColor && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-raven-200 rounded-lg shadow-lg z-50 p-2 flex gap-1.5">
                {COLORS.map(c => (
                  <button key={c} type="button"
                    onMouseDown={e => { e.preventDefault(); exec('foreColor', c); setShowColor(false) }}
                    className="w-6 h-6 rounded-full border border-raven-200 hover:scale-110 transition-smooth"
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-raven-200 mx-0.5" />

          <TBtn onMouseDown={() => exec('insertUnorderedList')} title="Bullet List"><List className="w-3.5 h-3.5" /></TBtn>
          <TBtn onMouseDown={() => exec('insertOrderedList')} title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></TBtn>
          <TBtn onMouseDown={() => exec('formatBlock', 'blockquote')} title="Quote"><Quote className="w-3.5 h-3.5" /></TBtn>
        </div>

        {/* Editable area */}
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          className="min-h-[120px] px-4 py-3 text-sm text-raven-50 leading-relaxed focus:outline-none prose prose-sm max-w-none
            [&_blockquote]:border-l-4 [&_blockquote]:border-raven-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-raven-500
            [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5"
          onInput={save}
          onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); exec('insertText', '    ') } }}
        />
      </div>
    )
  }

  // Preview mode
  return (
    <div onClick={e => { e.stopPropagation(); setEditing(true) }}
      className="cursor-text text-sm text-raven-700 leading-relaxed hover:bg-raven-300/5 rounded-lg p-2 -m-2 transition-smooth prose prose-sm max-w-none
        [&_blockquote]:border-l-4 [&_blockquote]:border-raven-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-raven-500
        [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5"
      dangerouslySetInnerHTML={{ __html: value || '<span class="text-raven-500/50 italic">Click to edit text block...</span>' }} />
  )
}

// ─── Image Upload Block (for builder) ────────────
function ImageUploadBlock({ field, onUpdate, type }) {
  const [uploading, setUploading] = useState(false)
  const [resizing, setResizing] = useState(false)
  const inputRef = useRef(null)
  const imgContainerRef = useRef(null)
  const isBanner = type === 'banner_image'
  const isAvatar = type === 'avatar_image'
  const isImage = type === 'file_upload'

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file, 'builder')
      onUpdate({ ...field, imageUrl: url })
    } catch (err) {
      alert('Upload failed: ' + (err.message || 'Check Supabase storage policies'))
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  function startResize(e) {
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    const startX = e.clientX
    const startWidth = imgContainerRef.current?.offsetWidth || 400

    function onMove(ev) {
      const delta = ev.clientX - startX
      const newWidth = Math.max(100, Math.min(startWidth + delta, 800))
      onUpdate({ ...field, imageWidthPx: newWidth })
    }
    function onUp() {
      setResizing(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  if (field.imageUrl) {
    const posY = field.imagePositionY ?? 50

    if (isBanner) {
      return (
        <div className="relative group/img">
          <img src={field.imageUrl} alt="Banner" className="w-full h-48 object-cover rounded-lg"
            style={{ objectPosition: `center ${posY}%` }} />
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover/img:opacity-100 transition-smooth">
            <span className="text-[10px] text-raven-500 shrink-0">Position</span>
            <input type="range" min="0" max="100" value={posY}
              onChange={e => onUpdate({ ...field, imagePositionY: parseInt(e.target.value) })}
              className="flex-1 h-1 accent-raven-300 cursor-pointer" />
          </div>
          <button onClick={() => onUpdate({ ...field, imageUrl: '' })}
            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full text-raven-500 hover:text-red-500 opacity-0 group-hover/img:opacity-100 transition-smooth shadow">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }

    if (isAvatar) {
      return (
        <div className="relative group/img">
          <div className="flex items-center gap-3">
            <img src={field.imageUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow" />
            <span className="text-xs text-raven-500">Avatar image</span>
          </div>
          <button onClick={() => onUpdate({ ...field, imageUrl: '' })}
            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full text-raven-500 hover:text-red-500 opacity-0 group-hover/img:opacity-100 transition-smooth shadow">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }

    // Regular image — full size with resize handle
    const imgWidth = field.imageWidthPx || 0
    return (
      <div className="relative group/img">
        <div ref={imgContainerRef} className="relative inline-block"
          style={imgWidth > 0 ? { width: `${imgWidth}px` } : {}}>
          <img src={field.imageUrl} alt="Uploaded"
            className="rounded-lg object-contain"
            style={imgWidth > 0 ? { width: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' }} />
          {/* Right resize handle */}
          <div onMouseDown={startResize}
            className="absolute top-0 right-0 w-3 h-full cursor-ew-resize opacity-0 group-hover/img:opacity-100 transition-smooth flex items-center justify-center"
            style={{ transform: 'translateX(50%)' }}>
            <div className="w-1 h-8 bg-raven-300 rounded-full" />
          </div>
          {/* Bottom-right corner resize handle */}
          <div onMouseDown={startResize}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover/img:opacity-100 transition-smooth"
            style={{ transform: 'translate(25%, 25%)' }}>
            <div className="w-3 h-3 border-r-2 border-b-2 border-raven-300 rounded-br" />
          </div>
        </div>
        <button onClick={() => onUpdate({ ...field, imageUrl: '' })}
          className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full text-raven-500 hover:text-red-500 opacity-0 group-hover/img:opacity-100 transition-smooth shadow z-10">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <label className={`flex flex-col items-center justify-center border-2 border-dashed border-raven-200 rounded-lg cursor-pointer hover:border-raven-300 transition-smooth ${
      isBanner ? 'py-10' : 'py-6'
    }`}>
      {uploading ? (
        <Loader2 className="w-6 h-6 text-raven-300 animate-spin" />
      ) : (
        <>
          {isBanner ? <Image className="w-8 h-8 text-raven-300 mb-2" />
            : isAvatar ? <UserCircle className="w-8 h-8 text-raven-300 mb-2" />
            : <Upload className="w-6 h-6 text-raven-300 mb-2" />}
          <p className="text-sm text-raven-500">
            {isBanner ? 'Upload banner image' : isAvatar ? 'Upload avatar image' : 'Upload an image'}
          </p>
          <p className="text-xs text-raven-500/50 mt-0.5">PNG or JPEG only</p>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="sr-only" onChange={handleFile} />
    </label>
  )
}

// ─── Sortable Field ──────────────────────────────
function SortableFormField({ field, isSelected, onSelect, onUpdate, onDelete, onDuplicate, fields }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const widthClass = field.width === 'half' ? 'w-[calc(50%-8px)]' : field.width === 'third' ? 'w-[calc(33.33%-8px)]' : 'w-full'

  return (
    <div ref={setNodeRef} style={style} onClick={() => onSelect(field.id)}
      className={`relative group rounded-xl p-5 transition-smooth cursor-pointer inline-block align-top ${widthClass} ${
        isSelected ? 'bg-white ring-2 ring-raven-300/40 shadow-sm' : 'bg-white hover:shadow-sm'
      }`}>
      <div {...attributes} {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-raven-200 hover:text-raven-500 transition-smooth">
        <GripVertical className="w-4 h-4" />
      </div>
      {isSelected && <FloatingToolbar field={field} onUpdate={onUpdate} onDelete={onDelete} onDuplicate={onDuplicate} fields={fields} />}

      <div className="pl-4">
        {field.type === 'banner_image' ? (
          <ImageUploadBlock field={field} onUpdate={onUpdate} type="banner_image" />
        ) : field.type === 'avatar_image' ? (
          <ImageUploadBlock field={field} onUpdate={onUpdate} type="avatar_image" />
        ) : field.type === 'richtext' ? (
          <InlineRichText value={field.content} onChange={val => onUpdate({ ...field, content: val })} />
        ) : field.type === 'heading' ? (
          <InlineLabel value={field.label} onChange={val => onUpdate({ ...field, label: val })}
            className="font-display text-lg font-semibold text-raven-50" placeholder="Section heading..." />
        ) : field.type === 'file' ? (
          <ImageUploadBlock field={field} onUpdate={onUpdate} type="file_upload" />
        ) : (
          <>
            <div className="mb-2">
              <InlineLabel value={field.label} onChange={val => onUpdate({ ...field, label: val })}
                className="text-sm font-medium text-raven-50" placeholder="Field label..." />
              {field.required && <span className="text-raven-300 ml-0.5 text-sm">*</span>}
            </div>
            {field.description && <p className="text-xs text-raven-500 mb-2">{field.description}</p>}

            {field.type === 'textarea' ? (
              <textarea rows={3} placeholder={field.placeholder || 'Type here...'} readOnly
                className="w-full px-3 py-2.5 bg-raven-900 border border-raven-200 rounded-lg text-sm text-raven-500 resize-none pointer-events-none" />
            ) : field.type === 'select' ? (
              <select className="w-full px-3 py-2.5 bg-raven-900 border border-raven-200 rounded-lg text-sm text-raven-500 pointer-events-none appearance-none">
                <option>Select an option...</option>
                {(field.options || []).map(o => <option key={o}>{o}</option>)}
              </select>
            ) : field.type === 'radio' ? (
              <div className="space-y-2">
                {(field.options || []).map(o => (
                  <label key={o} className="flex items-center gap-2.5 text-sm text-raven-700">
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-raven-200 shrink-0" />{o}
                  </label>
                ))}
              </div>
            ) : field.type === 'checkbox' ? (
              <div className="space-y-2">
                {(field.options || []).map(o => (
                  <label key={o} className="flex items-center gap-2.5 text-sm text-raven-700">
                    <div className="w-[18px] h-[18px] rounded border-2 border-raven-200 shrink-0" />{o}
                  </label>
                ))}
              </div>
            ) : field.type === 'rating' ? (
              <div className="flex gap-1">{[1,2,3,4,5].map(n => <Star key={n} className="w-7 h-7 text-raven-200" />)}</div>
            ) : field.type === 'toggle' ? (
              <div className="w-11 h-6 rounded-full bg-gray-300 relative">
                <div className="w-5 h-5 rounded-full bg-white shadow absolute top-0.5 left-0.5" />
              </div>
            ) : (
              <input type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                placeholder={field.placeholder || 'Type here...'} readOnly
                className="w-full px-3 py-2.5 bg-raven-900 border border-raven-200 rounded-lg text-sm text-raven-500 pointer-events-none" />
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
          <textarea value={formDescription} onChange={e => onDescriptionChange(e.target.value)} rows={2}
            className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50 resize-none" />
        </div>
        <div>
          <label className="block text-xs text-raven-500 mb-1.5 font-medium">Submit Button Text</label>
          <input type="text" value={settings.submit_button_text || 'Submit'} onChange={e => onUpdate({ ...settings, submit_button_text: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50" />
        </div>
        <div>
          <label className="block text-xs text-raven-500 mb-1.5 font-medium">Thank You Message</label>
          <textarea value={settings.thank_you_message || ''} onChange={e => onUpdate({ ...settings, thank_you_message: e.target.value })} rows={2}
            className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50 resize-none" />
        </div>
        <div>
          <label className="block text-xs text-raven-500 mb-1.5 font-medium">Redirect URL (optional)</label>
          <input type="url" value={settings.thank_you_url || ''} onChange={e => onUpdate({ ...settings, thank_you_url: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50" />
        </div>

        {/* Colors */}
        <div className="border-t border-raven-200 pt-4">
          <h4 className="text-xs text-raven-500 font-medium mb-3">Appearance</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Accent Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.accent_color || '#b8923e'} onChange={e => onUpdate({ ...settings, accent_color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <span className="text-xs text-raven-500 font-mono">{settings.accent_color || '#b8923e'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Background Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.background_color || '#faf7f2'} onChange={e => onUpdate({ ...settings, background_color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <span className="text-xs text-raven-500 font-mono">{settings.background_color || '#faf7f2'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Text Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.text_color || '#2a2520'} onChange={e => onUpdate({ ...settings, text_color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <span className="text-xs text-raven-500 font-mono">{settings.text_color || '#2a2520'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Card Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.card_color || '#ffffff'} onChange={e => onUpdate({ ...settings, card_color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <span className="text-xs text-raven-500 font-mono">{settings.card_color || '#ffffff'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="border-t border-raven-200 pt-4 space-y-3">
          <h4 className="text-xs text-raven-500 font-medium">Integrations</h4>
          <div className="flex items-center justify-between">
            <div><span className="text-sm text-raven-50 font-medium">Mailchimp</span><p className="text-xs text-raven-500">Auto-subscribe email fields</p></div>
            <button onClick={() => onUpdate({ ...settings, mailchimp_enabled: !settings.mailchimp_enabled })}
              className={`w-10 h-5 rounded-full transition-smooth relative ${settings.mailchimp_enabled ? 'bg-raven-300' : 'bg-gray-300'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-smooth ${settings.mailchimp_enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          {settings.mailchimp_enabled && (
            <div>
              <label className="block text-xs text-raven-500 mb-1 font-medium">Email Field ID</label>
              <input type="text" value={settings.mailchimp_email_field || ''} onChange={e => onUpdate({ ...settings, mailchimp_email_field: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50 font-mono" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div><span className="text-sm text-raven-50 font-medium">Email Notifications</span><p className="text-xs text-raven-500">Get notified on submissions</p></div>
            <button onClick={() => onUpdate({ ...settings, notification_enabled: !settings.notification_enabled })}
              className={`w-10 h-5 rounded-full transition-smooth relative ${settings.notification_enabled ? 'bg-raven-300' : 'bg-gray-300'}`}>
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
    background_color: '#faf7f2',
    text_color: '#2a2520',
    card_color: '#ffffff',
  })
  const [published, setPublished] = useState(false)
  const [slug, setSlug] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [showSettings, setShowSettings] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    function handler(e) {
      if (!e.target.closest('[data-field-container]') && !e.target.closest('[data-toolbar]')) setSelectedFieldId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!isNew) {
      getForm(id).then(form => {
        setFormTitle(form.title)
        setFormDescription(form.description || '')
        setFields(form.fields || [])
        setSettings(s => ({ ...s, ...(form.settings || {}) }))
        setPublished(form.published)
        setSlug(form.slug)
        setLoading(false)
      }).catch(() => { toast('Form not found', 'error'); navigate('/dashboard') })
    }
  }, [id])

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      setFields(prev => arrayMove(prev, prev.findIndex(f => f.id === active.id), prev.findIndex(f => f.id === over.id)))
    }
  }

  function addFieldAt(type, position) {
    const f = createField(type)
    setFields(prev => { const n = [...prev]; n.splice(position, 0, f); return n })
    setSelectedFieldId(f.id)
  }

  function deleteField(id) { setFields(prev => prev.filter(f => f.id !== id)); if (selectedFieldId === id) setSelectedFieldId(null) }

  function duplicateField(id) {
    const f = fields.find(x => x.id === id)
    if (!f) return
    const dup = { ...f, id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, label: `${f.label} (copy)` }
    const idx = fields.findIndex(x => x.id === id)
    setFields(prev => [...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)])
    setSelectedFieldId(dup.id)
  }

  function updateField(u) { setFields(prev => prev.map(f => f.id === u.id ? u : f)) }

  async function handleSave() {
    setSaving(true)
    try {
      const data = { title: formTitle, description: formDescription, fields, settings, published }
      if (isNew) {
        const created = await createForm(data)
        toast('Form created!')
        navigate(`/forms/${created.id}/edit`, { replace: true })
      } else {
        await updateForm(id, data)
        toast('Form saved!')
      }
    } catch (err) { toast('Save failed: ' + err.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleTogglePublish() {
    const next = !published
    setPublished(next)
    if (!isNew) {
      try { await updateForm(id, { published: next }); toast(next ? 'Form published!' : 'Form unpublished') }
      catch (err) { setPublished(!next); toast('Failed to update', 'error') }
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-raven-300 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div>
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-raven-200">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 text-raven-500 hover:text-raven-50 transition-smooth"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-raven-500 hover:text-raven-50 border border-raven-200 rounded-lg transition-smooth">
            <Settings2 className="w-3.5 h-3.5" /> Settings
          </button>
          {slug && published && (
            <button onClick={() => window.open(`/f/${slug}`, '_blank')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-raven-500 hover:text-raven-50 border border-raven-200 rounded-lg transition-smooth">
              <ExternalLink className="w-3.5 h-3.5" /> View Live
            </button>
          )}
          <button onClick={handleTogglePublish}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-smooth ${published ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-white text-raven-500 border border-raven-200 hover:text-raven-50'}`}>
            {published ? 'Published' : 'Publish'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-raven-300 hover:bg-raven-400 text-white text-sm font-semibold rounded-lg transition-smooth disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto" data-field-container>
        <div className="mb-6">
          <InlineLabel value={formTitle} onChange={setFormTitle} className="font-display text-2xl font-bold text-raven-50" placeholder="Form title..." />
          {formDescription && <p className="text-sm text-raven-500 mt-1">{formDescription}</p>}
        </div>

        <AddFieldButton onAdd={addFieldAt} position={0} alwaysShow={fields.length < 3} />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-wrap gap-2">
              {fields.map((field, index) => (
                <div key={field.id} className={field.width === 'full' || !field.width ? 'w-full' : ''}>
                  <SortableFormField field={field} isSelected={selectedFieldId === field.id}
                    onSelect={setSelectedFieldId} onUpdate={updateField} onDelete={deleteField}
                    onDuplicate={duplicateField} fields={fields} />
                  {field.width === 'full' || !field.width ? (
                    <AddFieldButton onAdd={addFieldAt} position={index + 1} alwaysShow={fields.length < 3} />
                  ) : null}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {fields.length === 0 && (
          <div className="text-center py-12">
            <p className="text-raven-500 text-sm mb-1">Click the <strong>+</strong> button above to add your first field</p>
            <p className="text-raven-500/50 text-xs">Or choose a quick start below</p>
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2 max-w-md mx-auto">
              {FIELD_TYPES.slice(0, 8).map(ft => {
                const Icon = ft.icon
                return (
                  <button key={ft.type} onClick={() => addFieldAt(ft.type, 0)}
                    className="flex flex-col items-center gap-1.5 px-3 py-3 text-xs text-raven-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-raven-200 rounded-lg transition-smooth">
                    <Icon className="w-5 h-5 text-raven-300" /> {ft.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {fields.length > 0 && (
          <div className="mt-4 mb-8">
            <button className="w-full py-3 rounded-lg text-sm font-semibold text-white pointer-events-none"
              style={{ backgroundColor: settings.accent_color || '#b8923e' }}>
              {settings.submit_button_text || 'Submit'}
            </button>
          </div>
        )}
      </div>

      {showSettings && <SettingsModal settings={settings} onUpdate={setSettings} onClose={() => setShowSettings(false)}
        formDescription={formDescription} onDescriptionChange={setFormDescription} />}
    </div>
  )
}

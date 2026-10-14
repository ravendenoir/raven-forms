import { useEffect, useMemo, useRef, useState } from 'react'
import { getAllCouples, getCoupleVotes, saveCouple, saveCouples } from '../lib/supabase'
import { useToast } from '../App'
import { normalize } from '../components/CouplePicker'
import { Heart, Plus, Pencil, Eye, EyeOff, Loader2, Search, Download, Upload, Archive, RotateCcw } from 'lucide-react'

const BLUE = '#03ABFA'
const EMPTY = { id: '', book_title: '', couple_names: '', series: '', search_terms: '', active: true }
const COLUMNS = ['id', 'book_title', 'couple_names', 'series', 'search_terms', 'active']

function slugify(s) {
  return normalize(s).replace(/ /g, '-').slice(0, 60)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Quote-aware CSV parser. Handles commas, quotes and line breaks inside quoted cells.
function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

// Accepts friendly header spellings: "Book Title", "book title", "Couple", "Couple Names", etc.
function headerKey(h) {
  const n = normalize(h).replace(/ /g, '_')
  if (['id', 'slug'].includes(n)) return 'id'
  if (['book_title', 'title', 'book'].includes(n)) return 'book_title'
  if (['couple_names', 'couple', 'names', 'couple_name'].includes(n)) return 'couple_names'
  if (['series', 'series_name'].includes(n)) return 'series'
  if (['search_terms', 'aliases', 'extra_search_words', 'search_words', 'tags'].includes(n)) return 'search_terms'
  if (['active', 'live', 'visible'].includes(n)) return 'active'
  return null
}

function parseActive(v) {
  if (v === undefined || v === null || String(v).trim() === '') return true
  return !['false', '0', 'no', 'n', 'hidden', 'off'].includes(String(v).trim().toLowerCase())
}

// Turn raw rows into clean couple records with ids, matching existing couples where possible.
function prepareRows(raw, existing) {
  const byId = Object.fromEntries(existing.map(c => [c.id, c]))
  const byPair = Object.fromEntries(existing.map(c => [`${normalize(c.book_title)}|${normalize(c.couple_names)}`, c.id]))
  const taken = new Set(existing.map(c => c.id))
  const out = [], skipped = []
  const seen = new Set()
  raw.forEach((r, i) => {
    const book_title = (r.book_title || '').toString().trim()
    const couple_names = (r.couple_names || '').toString().trim()
    if (!book_title || !couple_names) { skipped.push(i + 1); return }
    let id = (r.id || '').toString().trim()
    if (!id) {
      id = byPair[`${normalize(book_title)}|${normalize(couple_names)}`]
      if (!id) {
        id = slugify(book_title)
        if (taken.has(id)) id = slugify(`${book_title} ${couple_names}`)
        let n = 2
        const base = id
        while (taken.has(id)) id = `${base}-${n++}`
      }
    }
    if (seen.has(id)) { skipped.push(i + 1); return }
    seen.add(id)
    taken.add(id)
    out.push({
      id,
      book_title,
      couple_names,
      series: (r.series || '').toString().trim(),
      search_terms: (r.search_terms || '').toString().trim(),
      active: typeof r.active === 'boolean' ? r.active : parseActive(r.active),
      isNew: !byId[id],
    })
  })
  return { rows: out, skipped }
}

function monthKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export default function Couples() {
  const toast = useToast()
  const [couples, setCouples] = useState([])
  const [votes, setVotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState('all')
  const [draft, setDraft] = useState(EMPTY)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')
  const [pending, setPending] = useState(null) // { source: 'CSV'|'JSON', fileName, rows, skipped }
  const [importing, setImporting] = useState(false)
  const csvRef = useRef(null)
  const jsonRef = useRef(null)

  function exportCsv() {
    const lines = [COLUMNS.join(',')].concat(couples.map(c => COLUMNS.map(k => csvCell(c[k])).join(',')))
    download(`askli-couples-${today()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8')
    toast(`Exported ${couples.length} couples to CSV`)
  }

  function backupJson() {
    const payload = { app: 'askli', kind: 'couples-backup', version: 1, exported_at: new Date().toISOString(), count: couples.length, couples }
    download(`askli-couples-backup-${today()}.json`, JSON.stringify(payload, null, 2), 'application/json')
    toast(`Backed up ${couples.length} couples`)
  }

  async function readFile(e, source) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      let raw = []
      if (source === 'CSV') {
        const grid = parseCsv(text)
        if (grid.length < 2) throw new Error('The CSV needs a header row and at least one couple.')
        const keys = grid[0].map(headerKey)
        if (!keys.includes('book_title') || !keys.includes('couple_names')) {
          throw new Error('The CSV needs book_title and couple_names columns.')
        }
        raw = grid.slice(1).map(cells => {
          const o = {}
          keys.forEach((k, i) => { if (k) o[k] = cells[i] ?? '' })
          return o
        })
      } else {
        const data = JSON.parse(text)
        raw = Array.isArray(data) ? data : data?.couples
        if (!Array.isArray(raw)) throw new Error('This file is not an Askli couples backup.')
      }
      const { rows, skipped } = prepareRows(raw, couples)
      if (!rows.length) throw new Error('No usable couples found in that file.')
      setPending({ source, fileName: file.name, rows, skipped })
    } catch (err) {
      toast(err.message || 'Could not read that file', 'error')
    }
  }

  async function confirmImport() {
    if (!pending) return
    setImporting(true)
    try {
      const rows = pending.rows.map(({ isNew, ...r }) => r)
      for (let i = 0; i < rows.length; i += 200) await saveCouples(rows.slice(i, i + 200))
      const added = pending.rows.filter(r => r.isNew).length
      toast(`${pending.source} import done: ${added} added, ${rows.length - added} updated`)
      setPending(null)
      load()
    } catch (err) {
      toast('Import failed. Nothing was deleted.', 'error')
    } finally {
      setImporting(false)
    }
  }

  async function load() {
    try {
      const [c, v] = await Promise.all([getAllCouples(), getCoupleVotes()])
      setCouples(c)
      setVotes(v)
    } catch (e) {
      toast('Could not load couples', 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // Flatten each submission's picks into one row per pick
  const picks = useMemo(() => {
    const rows = []
    votes.forEach(v => {
      Object.values(v.metadata?.couple_picks || {}).forEach(p => {
        rows.push({ ...p, formTitle: v.forms?.title || 'Form', formSlug: v.forms?.slug || '', createdAt: v.created_at })
      })
    })
    return rows
  }, [votes])

  const months = useMemo(() => Array.from(new Set(picks.map(p => monthKey(p.createdAt)))).sort().reverse(), [picks])
  const inRange = picks.filter(p => month === 'all' || monthKey(p.createdAt) === month)
  const formSlugs = Array.from(new Set(picks.map(p => p.formSlug))).sort()

  const byId = Object.fromEntries(couples.map(c => [c.id, c]))
  const tally = useMemo(() => {
    const m = {}
    inRange.filter(p => p.coupleId && p.coupleId !== 'other').forEach(p => {
      const row = m[p.coupleId] || (m[p.coupleId] = { id: p.coupleId, total: 0, perForm: {}, book: p.bookTitle, names: p.coupleNames })
      row.total += 1
      row.perForm[p.formSlug] = (row.perForm[p.formSlug] || 0) + 1
    })
    return Object.values(m).sort((a, b) => b.total - a.total)
  }, [inRange])
  const others = inRange.filter(p => p.coupleId === 'other')

  async function handleSave(e) {
    e.preventDefault()
    if (!draft.book_title.trim() || !draft.couple_names.trim()) {
      toast('Book title and couple names are required', 'error')
      return
    }
    setSaving(true)
    try {
      let id = draft.id
      if (!editing) {
        id = slugify(draft.book_title)
        if (byId[id]) id = slugify(`${draft.book_title} ${draft.couple_names}`)
        if (byId[id]) { toast('That couple is already on the list', 'error'); setSaving(false); return }
      }
      await saveCouple({
        id,
        book_title: draft.book_title.trim(),
        couple_names: draft.couple_names.trim(),
        series: draft.series.trim(),
        search_terms: draft.search_terms.trim(),
        active: draft.active,
      })
      toast(editing ? 'Couple updated' : 'Couple added, live on the vote forms now')
      setDraft(EMPTY)
      setEditing(false)
      load()
    } catch (err) {
      toast('Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(c) {
    try {
      await saveCouple({ ...c, active: !c.active })
      setCouples(cs => cs.map(x => x.id === c.id ? { ...x, active: !c.active } : x))
    } catch { toast('Update failed', 'error') }
  }

  const shownCouples = couples.filter(c => {
    const q = normalize(filter)
    return !q || normalize(`${c.book_title} ${c.couple_names} ${c.series} ${c.search_terms}`).includes(q)
  })

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: BLUE }} /></div>
  }

  const input = 'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#03ABFA]'

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <Heart className="w-6 h-6" style={{ color: BLUE }} />
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Couples</h1>
          <p className="text-sm text-gray-500">Votes from every form with a Couple Picker, plus the list readers search.</p>
        </div>
      </div>

      {/* Import / export / backup */}
      <section className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Export CSV', icon: Download, onClick: exportCsv },
            { label: 'Import CSV', icon: Upload, onClick: () => csvRef.current?.click() },
            { label: 'Backup JSON', icon: Archive, onClick: backupJson },
            { label: 'Restore JSON', icon: RotateCcw, onClick: () => jsonRef.current?.click() },
          ].map(b => (
            <button key={b.label} type="button" onClick={b.onClick}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border border-gray-200 bg-white text-gray-700 hover:border-[#03ABFA] hover:text-[#03ABFA]">
              <b.icon className="w-4 h-4" /> {b.label}
            </button>
          ))}
          <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => readFile(e, 'CSV')} />
          <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden" onChange={e => readFile(e, 'JSON')} />
        </div>
        <p className="text-xs text-gray-400">
          CSV columns: book_title, couple_names, series, search_terms, active (id optional). Imports add new couples and update matching ones. Nothing is ever deleted.
        </p>

        {pending && (
          <div className="rounded-lg p-4 space-y-3" style={{ background: `${BLUE}0F`, border: `1px solid ${BLUE}55` }}>
            <p className="text-sm text-gray-900">
              <span className="font-semibold">{pending.fileName}</span>:{' '}
              {pending.rows.filter(r => r.isNew).length} new, {pending.rows.filter(r => !r.isNew).length} updates
              {pending.skipped.length ? `, ${pending.skipped.length} skipped (missing title/names or duplicate, rows ${pending.skipped.slice(0, 8).join(', ')}${pending.skipped.length > 8 ? '…' : ''})` : ''}
            </p>
            <div className="max-h-56 overflow-y-auto bg-white rounded-lg border border-gray-100 divide-y divide-gray-100">
              {pending.rows.map(r => (
                <div key={r.id} className="px-3 py-2 text-sm flex gap-2 items-center">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${r.isNew ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.isNew ? 'New' : 'Update'}
                  </span>
                  <span className="font-medium text-gray-900">{r.book_title}</span>
                  <span className="text-gray-500 truncate">· {r.couple_names}{r.series ? ` · ${r.series}` : ''}{r.active ? '' : ' · hidden'}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={confirmImport} disabled={importing}
                className="flex items-center gap-1.5 px-5 py-2 text-white text-sm font-semibold rounded-full disabled:opacity-50"
                style={{ backgroundColor: BLUE }}>
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Import {pending.rows.length}
              </button>
              <button type="button" onClick={() => setPending(null)} className="text-sm text-gray-500 hover:text-gray-800">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Tally */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-gray-900">Vote tally <span className="text-gray-400 font-normal">· {inRange.length} vote{inRange.length !== 1 ? 's' : ''}</span></h2>
          <select value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
            <option value="all">All time</option>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Couple</th>
                {formSlugs.map(s => <th key={s} className="px-4 py-2.5 font-medium whitespace-nowrap">{s}</th>)}
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {tally.length === 0 && (
                <tr><td colSpan={3 + formSlugs.length} className="px-4 py-8 text-center text-gray-400">No picked couples yet for this period.</td></tr>
              )}
              {tally.map((t, i) => {
                const c = byId[t.id]
                return (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{c?.book_title || t.book}</span>
                      <span className="text-gray-500"> · {c?.couple_names || t.names}</span>
                    </td>
                    {formSlugs.map(s => <td key={s} className="px-4 py-2.5 text-gray-600">{t.perForm[s] || 0}</td>)}
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: BLUE }}>{t.total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Other write-ins */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-1">“Other” write-ins <span className="text-gray-400 font-normal">· {others.length}</span></h2>
        <p className="text-sm text-gray-500 mb-3">Typed answers that didn't match the list. If one is a couple you forgot, add it below.</p>
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
          {others.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">None yet.</p>}
          {others.map((o, i) => (
            <div key={i} className="px-4 py-2.5 flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-gray-900">{o.otherText}</span>
              <span className="text-gray-400">{o.formSlug} · {new Date(o.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Add / edit */}
      <section id="couple-form">
        <h2 className="font-semibold text-gray-900 mb-3">{editing ? 'Edit couple' : 'Add a couple'}</h2>
        <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-3 border border-gray-200 rounded-xl p-4">
          <input className={input} placeholder="Book title (e.g. The Don)" value={draft.book_title}
            onChange={e => setDraft({ ...draft, book_title: e.target.value })} />
          <input className={input} placeholder="Couple names (e.g. Reyna & Vadim)" value={draft.couple_names}
            onChange={e => setDraft({ ...draft, couple_names: e.target.value })} />
          <input className={input} placeholder="Series (blank for standalone)" value={draft.series}
            onChange={e => setDraft({ ...draft, series: e.target.value })} />
          <input className={input} placeholder="Extra search words, comma separated (optional)" value={draft.search_terms}
            onChange={e => setDraft({ ...draft, search_terms: e.target.value })} />
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 text-white text-sm font-semibold rounded-full disabled:opacity-50"
              style={{ backgroundColor: BLUE }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editing ? 'Save changes' : 'Add couple'}
            </button>
            {editing && (
              <button type="button" onClick={() => { setDraft(EMPTY); setEditing(false) }} className="text-sm text-gray-500 hover:text-gray-800">Cancel</button>
            )}
          </div>
        </form>
      </section>

      {/* List */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-gray-900">The list <span className="text-gray-400 font-normal">· {couples.filter(c => c.active).length} live, {couples.filter(c => !c.active).length} hidden</span></h2>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="Filter"
              value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
        </div>
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
          {shownCouples.map(c => (
            <div key={c.id} className={`px-4 py-3 flex items-center gap-3 text-sm ${c.active ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900"><span className="font-medium">{c.book_title}</span> · {c.couple_names}</p>
                <p className="text-xs text-gray-400 truncate">{c.series || 'Standalone'}{c.search_terms ? ` · also: ${c.search_terms}` : ''}</p>
              </div>
              <button title="Edit" onClick={() => { setDraft({ ...EMPTY, ...c }); setEditing(true); document.getElementById('couple-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}
                className="p-2 text-gray-400 hover:text-[#03ABFA]"><Pencil className="w-4 h-4" /></button>
              <button title={c.active ? 'Hide from vote forms' : 'Show on vote forms'} onClick={() => toggleActive(c)}
                className="p-2 text-gray-400 hover:text-[#03ABFA]">{c.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

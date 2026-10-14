import { useEffect, useMemo, useState } from 'react'
import { getAllCouples, getCoupleVotes, saveCouple } from '../lib/supabase'
import { useToast } from '../App'
import { normalize } from '../components/CouplePicker'
import { Heart, Plus, Pencil, Eye, EyeOff, Loader2, Search } from 'lucide-react'

const BLUE = '#03ABFA'
const EMPTY = { id: '', book_title: '', couple_names: '', series: '', search_terms: '', active: true }

function slugify(s) {
  return normalize(s).replace(/ /g, '-').slice(0, 60)
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

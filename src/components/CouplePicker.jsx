import { useEffect, useMemo, useRef, useState } from 'react'

// Lowercase, strip punctuation and accents, collapse spaces.
// "Seabrook's Broken Veil" -> "seabrooks broken veil", "So, About Last Night" -> "so about last night"
export function normalize(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function coupleLabel(c) {
  return `${c.book_title} · ${c.couple_names}`
}

// Score a couple against a query. 0 means no match. Higher ranks first.
function score(c, q) {
  const tokens = q.split(' ').filter(Boolean)
  if (!tokens.length) return 0
  const title = normalize(c.book_title)
  const names = normalize(c.couple_names)
  const series = normalize(c.series)
  const extra = normalize(c.search_terms)
  const hay = `${title} ${names} ${series} ${extra}`
  if (!tokens.every(t => hay.includes(t))) return 0
  let s = 1
  if (title.startsWith(q)) s += 6
  else if (title.includes(q)) s += 4
  if (names.split(' ').some(w => w.startsWith(tokens[0]))) s += 5
  if (series.startsWith(q)) s += 2
  return s
}

/**
 * Type-ahead couple picker.
 * value: { display, coupleId, bookTitle, coupleNames, otherText } or null
 * onChange(value)
 * The suggestion list renders inline (not floating) so the phone keyboard never covers it.
 */
export default function CouplePicker({ couples, value, onChange, placeholder, textColor, cardColor, accentColor }) {
  const [query, setQuery] = useState(value?.display || '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { setQuery(value?.display || '') }, [value?.display])

  const q = normalize(query)
  const results = useMemo(() => {
    if (q.length < 1) return []
    return couples
      .map(c => ({ c, s: score(c, q) }))
      .filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s || a.c.book_title.localeCompare(b.c.book_title))
      .slice(0, 6)
      .map(r => r.c)
  }, [couples, q])

  const selected = value?.coupleId && value.coupleId !== 'other'

  function pick(c) {
    const v = { display: coupleLabel(c), coupleId: c.id, bookTitle: c.book_title, coupleNames: c.couple_names, otherText: '' }
    onChange(v)
    setQuery(v.display)
    setOpen(false)
    inputRef.current?.blur()
  }

  function typed(text) {
    setQuery(text)
    setActive(0)
    setOpen(true)
    // Until they tap a suggestion, whatever they typed counts as "Other".
    const t = text.trim()
    onChange(t ? { display: t, coupleId: 'other', bookTitle: '', coupleNames: '', otherText: t } : null)
  }

  function onKeyDown(e) {
    if (!open || !results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  function onFocus() {
    setOpen(true)
    // On phones, lift the field to the top so the suggestions sit above the keyboard.
    if (window.matchMedia('(max-width: 640px)').matches) {
      setTimeout(() => wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    }
  }

  useEffect(() => {
    function close(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const showList = open && q.length >= 1 && !selected
  const listBg = cardColor || '#ffffff'

  return (
    <div ref={wrapRef} style={{ scrollMarginTop: 16 }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => typed(e.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={placeholder || 'Start typing a title or a name...'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          style={selected ? { paddingRight: '2.5rem' } : undefined}
        />
        {selected && (
          <button type="button" aria-label="Clear"
            onClick={() => { onChange(null); setQuery(''); setOpen(true); inputRef.current?.focus() }}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32,
              border: 'none', background: 'transparent', color: '#8a7f74', fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>
            ×
          </button>
        )}
      </div>

      {showList && (
        <div role="listbox" style={{ marginTop: 6, borderRadius: 10, overflow: 'hidden', background: listBg,
          border: `1px solid ${accentColor || '#c9a24a'}55` }}>
          {results.map((c, i) => (
            <button key={c.id} type="button" role="option" aria-selected={i === active}
              onPointerDown={e => e.preventDefault()}
              onClick={() => pick(c)}
              onMouseEnter={() => setActive(i)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', minHeight: 48,
                border: 'none', borderTop: i ? `1px solid ${textColor || '#2a2520'}14` : 'none', cursor: 'pointer',
                background: i === active ? `${accentColor || '#c9a24a'}26` : 'transparent', color: textColor || '#2a2520' }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{c.book_title}</span>
              <span style={{ display: 'block', fontSize: 13, opacity: 0.8, marginTop: 2 }}>
                {c.couple_names}{c.series ? ` · ${c.series}` : ''}
              </span>
            </button>
          ))}
          {results.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 13, color: textColor || '#2a2520', opacity: 0.8 }}>
              No match yet. Keep typing and submit. I'll still count your vote.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

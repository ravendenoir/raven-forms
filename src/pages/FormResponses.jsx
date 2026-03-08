import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getForm, getSubmissions, deleteSubmission, submitForm } from '../lib/supabase'
import { useToast } from '../App'
import {
  ArrowLeft, Download, Upload, Plus, Trash2, Inbox, Clock,
  ChevronLeft, ChevronRight, ExternalLink, X, BarChart3, List
} from 'lucide-react'

export default function FormResponses() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [viewTab, setViewTab] = useState('responses')
  const [importLog, setImportLog] = useState(null)
  const perPage = 25

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    try {
      const [formData, subs] = await Promise.all([
        getForm(id),
        getSubmissions(id)
      ])
      setForm(formData)
      setSubmissions(subs || [])
    } catch (err) {
      toast('Failed to load data', 'error')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  // Get all unique field labels across submissions
  function getColumns() {
    const cols = new Set()
    submissions.forEach(sub => {
      Object.keys(sub.data || {}).forEach(k => cols.add(k))
    })
    return Array.from(cols)
  }

  // Delete selected submissions
  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} response(s)? This can't be undone.`)) return
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => deleteSubmission(id))
      )
      setSubmissions(prev => prev.filter(s => !selectedIds.has(s.id)))
      setSelectedIds(new Set())
      toast('Deleted successfully')
    } catch (err) {
      toast('Delete failed', 'error')
    }
  }

  // Export as CSV
  function exportCSV() {
    if (submissions.length === 0) return
    const columns = getColumns()
    const header = ['Submitted At', ...columns]
    const rows = submissions.map(sub => [
      new Date(sub.created_at).toLocaleString(),
      ...columns.map(col => {
        const val = sub.data?.[col]
        if (Array.isArray(val)) return val.join('; ')
        if (typeof val === 'boolean') return val ? 'Yes' : 'No'
        return String(val || '')
      })
    ])

    const csvContent = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${form?.title || 'responses'}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast('CSV exported')
  }

  // Import CSV
  const [importing, setImporting] = useState(false)

  async function handleImportCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset input

    setImporting(true)
    setImportLog(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').map(line => {
        const result = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
            else inQuotes = !inQuotes
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim()); current = ''
          } else {
            current += ch
          }
        }
        result.push(current.trim())
        return result
      }).filter(row => row.some(cell => cell.length > 0))

      if (lines.length < 2) {
        toast('CSV must have a header row and at least one data row', 'error')
        setImporting(false)
        return
      }

      const headers = lines[0].map(h => h.replace(/^["']|["']$/g, '').trim())

      // Find email column
      const emailColIndex = headers.findIndex(h => h.toLowerCase() === 'email')

      // Get existing emails for duplicate check
      const existingEmails = new Set()
      if (emailColIndex >= 0) {
        const existingSubs = await getSubmissions(id)
        existingSubs.forEach(sub => {
          const d = sub.data || {}
          Object.entries(d).forEach(([key, val]) => {
            if (key.toLowerCase() === 'email' && val) {
              existingEmails.add(val.toLowerCase().trim())
            }
          })
        })
      }

      let imported = 0
      let skipped = 0
      const duplicates = []
      const errors = []

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
        if (row.length === 0 || (row.length === 1 && !row[0])) { skipped++; continue }

        const data = {}
        headers.forEach((header, idx) => {
          if (header && header.toLowerCase() !== 'submitted at' && header.toLowerCase() !== 'submitted') {
            data[header] = row[idx] || ''
          }
        })

        if (!Object.values(data).some(v => v)) { skipped++; continue }

        // Check for duplicate email
        if (emailColIndex >= 0) {
          const email = (row[emailColIndex] || '').toLowerCase().trim()
          if (email && existingEmails.has(email)) {
            duplicates.push({ row: i + 1, email: row[emailColIndex], name: data['Name'] || data['name'] || data['Full Name'] || '' })
            skipped++
            continue
          }
          if (email) existingEmails.add(email)
        }

        try {
          await submitForm(id, data, { source: 'csv_import' })
          imported++
        } catch (err) {
          console.error('Failed to import row', i, err)
          errors.push({ row: i + 1, error: err.message })
          skipped++
        }
      }

      // Refresh submissions
      const subs = await getSubmissions(id)
      setSubmissions(subs)

      // Build import log
      setImportLog({ imported, skipped, duplicates, errors, timestamp: new Date().toISOString() })

      toast(`Imported ${imported} records${skipped > 0 ? ` (${skipped} skipped${duplicates.length > 0 ? `, ${duplicates.length} duplicate${duplicates.length !== 1 ? 's' : ''}` : ''})` : ''}`)
    } catch (err) {
      console.error('Import error:', err)
      toast('Failed to import CSV: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setImporting(false)
    }
  }

  // Pagination
  const totalPages = Math.ceil(submissions.length / perPage)
  const pageSubmissions = submissions.slice(page * perPage, (page + 1) * perPage)
  const columns = getColumns()

  // Add Record
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [newRecord, setNewRecord] = useState({})
  const [addingRecord, setAddingRecord] = useState(false)

  const inputFields = (form?.fields || []).filter(f =>
    !['heading', 'banner_image', 'avatar_image', 'richtext', 'file'].includes(f.type)
  )

  async function handleAddRecord() {
    if (Object.values(newRecord).every(v => !v)) return
    setAddingRecord(true)
    try {
      const data = {}
      inputFields.forEach(f => {
        if (newRecord[f.id]) data[f.label] = newRecord[f.id]
      })
      await submitForm(form.id, data, { source: 'manual_add' })
      const subs = await getSubmissions(id)
      setSubmissions(subs)
      setNewRecord({})
      setShowAddRecord(false)
      toast('Record added')
    } catch (err) {
      toast('Failed to add record', 'error')
    } finally {
      setAddingRecord(false)
    }
  }

  // Toggle selection
  function toggleSelect(subId) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(subId)) next.delete(subId)
      else next.add(subId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === pageSubmissions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pageSubmissions.map(s => s.id)))
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    })
  }

  function formatValue(val) {
    if (val === null || val === undefined) return '—'
    if (Array.isArray(val)) return val.join(', ')
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    const str = String(val)
    if (str.startsWith('https://') && str.includes('form-uploads')) {
      return <a href={str} target="_blank" rel="noopener noreferrer" className="text-[#03ABFA] underline hover:text-raven-200">View File</a>
    }
    return str
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#03ABFA] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-1.5 text-raven-500/80 hover:text-[#03ABFA] transition-smooth">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-raven-50">{form?.title}</h1>
            <p className="text-raven-500/80 text-xs mt-0.5">
              {submissions.length} response{submissions.length !== 1 ? 's' : ''}
              {form?.view_count > 0 && (
                <span className="ml-2 text-raven-500/60">
                  · {form.view_count} view{form.view_count !== 1 ? 's' : ''}
                  · {((submissions.length / form.view_count) * 100).toFixed(1)}% conversion
                </span>
              )}
              {form?.slug && (
                <button
                  onClick={() => window.open(`/f/${form.slug}`, '_blank')}
                  className="ml-2 inline-flex items-center gap-1 text-raven-500/70 hover:text-[#03ABFA] transition-smooth"
                >
                  <ExternalLink className="w-3 h-3" /> View form
                </button>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-smooth"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => { setNewRecord({}); setShowAddRecord(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-smooth border border-raven-200 text-raven-500 hover:bg-raven-900"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Record
          </button>
          <label
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-smooth cursor-pointer
              border border-raven-200 text-raven-500 hover:bg-raven-900 ${importing ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Upload className="w-3.5 h-3.5" />
            {importing ? 'Importing...' : 'Import CSV'}
            <input type="file" accept=".csv" className="sr-only" onChange={handleImportCSV} disabled={importing} />
          </label>
          <button
            onClick={exportCSV}
            disabled={submissions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#03ABFA] text-white text-xs font-semibold rounded-lg hover:bg-[#03ABFA]/90 transition-smooth disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Import Log */}
      {importLog && (
        <div className="mb-4 bg-white border border-raven-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-raven-50">Import Results</h4>
            <button onClick={() => setImportLog(null)} className="p-1 text-raven-500 hover:text-raven-50"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-4 text-xs mb-2">
            <span className="text-emerald-600 font-medium">{importLog.imported} imported</span>
            {importLog.skipped > 0 && <span className="text-raven-500">{importLog.skipped} skipped</span>}
            {importLog.duplicates.length > 0 && <span className="text-amber-600">{importLog.duplicates.length} duplicate{importLog.duplicates.length !== 1 ? 's' : ''}</span>}
          </div>
          {importLog.duplicates.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-raven-500 font-medium mb-1 uppercase tracking-wider">Duplicate Emails (Already Existed)</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importLog.duplicates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-raven-700 bg-amber-50 px-3 py-1.5 rounded">
                    <span className="text-amber-500 font-medium">Row {d.row}</span>
                    <span className="text-raven-50 font-medium">{d.email}</span>
                    {d.name && <span className="text-raven-500">({d.name})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {importLog.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-raven-500 font-medium mb-1 uppercase tracking-wider">Errors</p>
              <div className="max-h-20 overflow-y-auto space-y-1">
                {importLog.errors.map((e, i) => (
                  <div key={i} className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded">
                    Row {e.row}: {e.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      {submissions.length > 0 && (
        <div className="flex gap-1 mb-4">
          <button onClick={() => setViewTab('responses')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-smooth ${viewTab === 'responses' ? 'bg-[#03ABFA] text-white' : 'text-raven-500 hover:bg-raven-900'}`}>
            <List className="w-3.5 h-3.5" /> Responses
          </button>
          <button onClick={() => setViewTab('summary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-smooth ${viewTab === 'summary' ? 'bg-[#03ABFA] text-white' : 'text-raven-500 hover:bg-raven-900'}`}>
            <BarChart3 className="w-3.5 h-3.5" /> Summary
          </button>
        </div>
      )}

      {/* Summary View */}
      {viewTab === 'summary' && submissions.length > 0 && (() => {
        const chartFields = (form?.fields || []).filter(f => ['radio', 'select', 'checkbox', 'rating', 'toggle', 'likert'].includes(f.type))
        if (chartFields.length === 0) return (
          <div className="text-center py-12 border border-dashed border-raven-200 rounded-xl">
            <BarChart3 className="w-8 h-8 text-raven-500/40 mx-auto mb-2" />
            <p className="text-sm text-raven-500">No chart-compatible fields in this form.</p>
            <p className="text-xs text-raven-500/50 mt-1">Add radio, dropdown, checkbox, rating, or toggle fields to see charts.</p>
          </div>
        )
        const accentColor = form?.settings?.accent_color || '#b8923e'
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chartFields.map(field => {
              const counts = {}
              if (field.type === 'rating') {
                [1,2,3,4,5].forEach(n => { counts[`${n} star${n !== 1 ? 's' : ''}`] = 0 })
                submissions.forEach(s => {
                  const v = s.data?.[field.label]
                  if (v) counts[`${v} star${v !== 1 ? 's' : ''}`] = (counts[`${v} star${v !== 1 ? 's' : ''}`] || 0) + 1
                })
              } else if (field.type === 'toggle') {
                counts['Yes'] = 0; counts['No'] = 0
                submissions.forEach(s => {
                  const v = s.data?.[field.label]
                  if (v === true || v === 'true') counts['Yes']++
                  else counts['No']++
                })
              } else {
                ;(field.options || []).forEach(o => { counts[o] = 0 })
                submissions.forEach(s => {
                  const v = s.data?.[field.label]
                  if (Array.isArray(v)) { v.forEach(x => { counts[x] = (counts[x] || 0) + 1 }) }
                  else if (v) { counts[v] = (counts[v] || 0) + 1 }
                })
              }
              const maxCount = Math.max(...Object.values(counts), 1)
              const totalResponded = Object.values(counts).reduce((a, b) => a + b, 0)
              return (
                <div key={field.id} className="bg-white border border-raven-200 rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-raven-50 mb-3">{field.label}</h4>
                  <div className="space-y-2">
                    {Object.entries(counts).map(([label, count]) => {
                      const pct = totalResponded > 0 ? Math.round((count / totalResponded) * 100) : 0
                      return (
                        <div key={label}>
                          <div className="flex justify-between text-xs text-raven-700 mb-1">
                            <span>{label}</span>
                            <span className="text-raven-500">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-5 rounded-full bg-raven-900 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: accentColor }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-raven-500/50 mt-2">{totalResponded} response{totalResponded !== 1 ? 's' : ''}</p>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Empty State */}
      {submissions.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-raven-200 rounded-xl">
          <Inbox className="w-10 h-10 text-raven-500/50 mx-auto mb-3" />
          <p className="text-raven-500/80 text-sm">No responses yet.</p>
          <p className="text-raven-500/50 text-xs mt-1">Share your form link to start collecting responses.</p>
        </div>
      ) : viewTab === 'responses' ? (
        <>
          {/* Table */}
          <div className="bg-raven-850 border border-raven-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-raven-200">
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === pageSubmissions.length && pageSubmissions.length > 0}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded border-raven-200 bg-white accent-[#03ABFA]"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-raven-500/80 uppercase tracking-wider whitespace-nowrap">
                      <Clock className="w-3 h-3 inline mr-1" /> Submitted
                    </th>
                    {columns.map(col => (
                      <th key={col} className="px-3 py-3 text-left text-xs font-medium text-raven-500/80 uppercase tracking-wider whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageSubmissions.map(sub => (
                    <tr key={sub.id} className="border-b border-raven-200/60 hover:bg-raven-900/50 transition-smooth">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(sub.id)}
                          onChange={() => toggleSelect(sub.id)}
                          className="w-3.5 h-3.5 rounded border-raven-200 bg-white accent-[#03ABFA]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-raven-500 whitespace-nowrap">
                        {formatDate(sub.created_at)}
                      </td>
                      {columns.map(col => (
                        <td key={col} className="px-3 py-2.5 text-raven-50 max-w-xs truncate">
                          {formatValue(sub.data?.[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-raven-500/70">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 text-raven-500/80 hover:text-[#03ABFA] disabled:opacity-30 transition-smooth"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="p-1.5 text-raven-500/80 hover:text-[#03ABFA] disabled:opacity-30 transition-smooth"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Add Record Modal */}
      {showAddRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowAddRecord(false)}>
          <div className="bg-white border border-raven-200 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-raven-50">Add Record</h3>
              <button onClick={() => setShowAddRecord(false)} className="p-1 text-raven-500 hover:text-raven-50"><X className="w-5 h-5" /></button>
            </div>
            {inputFields.length > 0 ? (
              <div className="space-y-3">
                {inputFields.map(field => (
                  <div key={field.id}>
                    <label className="block text-xs text-raven-500 mb-1 font-medium">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={newRecord[field.id] || ''}
                        onChange={e => setNewRecord(prev => ({ ...prev, [field.id]: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50 resize-none"
                        placeholder={field.label}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={newRecord[field.id] || ''}
                        onChange={e => setNewRecord(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50"
                      >
                        <option value="">Select...</option>
                        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : field.type === 'date' ? 'date' : 'text'}
                        value={newRecord[field.id] || ''}
                        onChange={e => setNewRecord(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-raven-200 rounded-lg text-sm text-raven-50"
                        placeholder={field.label}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-raven-500">No input fields found on this form.</p>
            )}
            <button
              onClick={handleAddRecord}
              disabled={addingRecord || Object.values(newRecord).every(v => !v)}
              className="w-full py-2.5 bg-[#03ABFA] text-white font-semibold rounded-lg hover:bg-raven-400 transition-smooth text-sm disabled:opacity-50"
            >
              {addingRecord ? 'Adding...' : 'Add Record'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getForm, getSubmissions, deleteSubmission } from '../lib/supabase'
import { useToast } from '../App'
import {
  ArrowLeft, Download, Trash2, Inbox, Clock,
  ChevronLeft, ChevronRight, ExternalLink
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

  // Pagination
  const totalPages = Math.ceil(submissions.length / perPage)
  const pageSubmissions = submissions.slice(page * perPage, (page + 1) * perPage)
  const columns = getColumns()

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
      return <a href={str} target="_blank" rel="noopener noreferrer" className="text-raven-300 underline hover:text-raven-200">View File</a>
    }
    return str
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-raven-300 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-1.5 text-raven-300/50 hover:text-raven-300 transition-smooth">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-raven-50">{form?.title}</h1>
            <p className="text-raven-300/50 text-xs mt-0.5">
              {submissions.length} response{submissions.length !== 1 ? 's' : ''}
              {form?.slug && (
                <button
                  onClick={() => window.open(`/f/${form.slug}`, '_blank')}
                  className="ml-2 inline-flex items-center gap-1 text-raven-300/40 hover:text-raven-300 transition-smooth"
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-300 border border-red-800/40 rounded-lg hover:bg-red-900/20 transition-smooth"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selectedIds.size})
            </button>
          )}
          <button
            onClick={exportCSV}
            disabled={submissions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-raven-300 text-raven-950 text-xs font-semibold rounded-lg hover:bg-raven-200 transition-smooth disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Empty State */}
      {submissions.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-raven-800/50 rounded-xl">
          <Inbox className="w-10 h-10 text-raven-300/30 mx-auto mb-3" />
          <p className="text-raven-300/50 text-sm">No responses yet.</p>
          <p className="text-raven-300/30 text-xs mt-1">Share your form link to start collecting responses.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-raven-850 border border-raven-800/40 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-raven-800/30">
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === pageSubmissions.length && pageSubmissions.length > 0}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded border-raven-800/50 bg-raven-900 accent-raven-300"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-raven-300/50 uppercase tracking-wider whitespace-nowrap">
                      <Clock className="w-3 h-3 inline mr-1" /> Submitted
                    </th>
                    {columns.map(col => (
                      <th key={col} className="px-3 py-3 text-left text-xs font-medium text-raven-300/50 uppercase tracking-wider whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageSubmissions.map(sub => (
                    <tr key={sub.id} className="border-b border-raven-800/20 hover:bg-raven-800/20 transition-smooth">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(sub.id)}
                          onChange={() => toggleSelect(sub.id)}
                          className="w-3.5 h-3.5 rounded border-raven-800/50 bg-raven-900 accent-raven-300"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-raven-300/60 whitespace-nowrap">
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
              <span className="text-xs text-raven-300/40">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 text-raven-300/50 hover:text-raven-300 disabled:opacity-30 transition-smooth"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="p-1.5 text-raven-300/50 hover:text-raven-300 disabled:opacity-30 transition-smooth"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

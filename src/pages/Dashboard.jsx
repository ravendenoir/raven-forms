import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getForms, deleteForm, createForm } from '../lib/supabase'
import { useToast } from '../App'
import {
  FileText, BarChart3, ExternalLink, Pencil, Trash2,
  Clock, Eye, EyeOff, Plus, Inbox
} from 'lucide-react'

export default function Dashboard() {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    loadForms()
  }, [])

  async function loadForms() {
    try {
      const data = await getForms()
      setForms(data || [])
    } catch (err) {
      toast('Failed to load forms', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id, title) {
    if (!confirm(`Delete "${title}"? This also deletes all submissions. Can't undo this.`)) return
    try {
      await deleteForm(id)
      setForms(prev => prev.filter(f => f.form_id !== id))
      toast('Form deleted')
    } catch (err) {
      toast('Delete failed', 'error')
    }
  }

  async function handleCreateForm() {
    try {
      const form = await createForm({ title: 'Untitled Form', fields: [], published: false })
      navigate(`/forms/${form.id}/edit`)
    } catch (err) {
      toast('Failed to create form', 'error')
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  function getFormUrl(slug) {
    return `${window.location.origin}/f/${slug}`
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
        <div>
          <h1 className="font-display text-2xl font-bold text-raven-50">Your Forms</h1>
          <p className="text-raven-300/50 text-sm mt-0.5">{forms.length} form{forms.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Empty State */}
      {forms.length === 0 && (
        <div className="text-center py-20 border border-dashed border-raven-800/50 rounded-xl">
          <Inbox className="w-10 h-10 text-raven-300/30 mx-auto mb-3" />
          <p className="text-raven-300/50 text-sm mb-4">No forms yet.</p>
          <button
            onClick={handleCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-raven-300 text-raven-950 text-sm font-semibold rounded-lg hover:bg-raven-200 transition-smooth"
          >
            <Plus className="w-4 h-4" />
            Create Your First Form
          </button>
        </div>
      )}

      {/* Form Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map(form => (
          <div
            key={form.form_id}
            className="group bg-raven-850 border border-raven-800/40 rounded-xl overflow-hidden hover:border-raven-300/20 transition-smooth"
          >
            {/* Card Header */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-3">
                  <h3 className="font-display text-base font-semibold text-raven-50 truncate">
                    {form.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    {form.published ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400/80">
                        <Eye className="w-3 h-3" /> Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-raven-300/40">
                        <EyeOff className="w-3 h-3" /> Draft
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
                  <button
                    onClick={() => navigate(`/forms/${form.form_id}/edit`)}
                    className="p-1.5 text-raven-300/50 hover:text-raven-300 hover:bg-raven-800/60 rounded-md transition-smooth"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(form.form_id, form.title)}
                    className="p-1.5 text-raven-300/50 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-smooth"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4 text-xs text-raven-300/50">
                <span className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  {form.submission_count || 0} response{form.submission_count !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(form.created_at)}
                </span>
              </div>
            </div>

            {/* Card Footer */}
            <div className="border-t border-raven-800/30 px-5 py-3 flex items-center justify-between">
              <button
                onClick={() => navigate(`/forms/${form.form_id}/responses`)}
                className="text-xs text-raven-300/60 hover:text-raven-300 font-medium transition-smooth"
              >
                View Responses →
              </button>
              {form.published && (
                <button
                  onClick={() => window.open(getFormUrl(form.slug), '_blank')}
                  className="flex items-center gap-1 text-xs text-raven-300/40 hover:text-raven-300 transition-smooth"
                  title="Open public link"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

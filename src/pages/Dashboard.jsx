import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getForms, deleteForm, createForm, duplicateForm } from '../lib/supabase'
import { useToast } from '../App'
import {
  FileText, BarChart3, ExternalLink, Pencil, Trash2,
  Clock, Eye, EyeOff, Plus, Inbox, X, Mail, MessageSquare,
  ClipboardList, Vote, HelpCircle, ShoppingCart, UserPlus, Star, Copy
} from 'lucide-react'

// ─── Form Templates ──────────────────────────────
const TEMPLATES = [
  { id: 'blank', name: 'Blank Form', icon: Plus, description: 'Start from scratch', fields: [], settings: {} },
  { id: 'newsletter', name: 'Newsletter Signup', icon: Mail, description: 'Collect email subscribers',
    fields: [
      { type: 'banner_image', label: 'Banner Image', width: 'full', imageUrl: '', imageWidthPx: 0, imagePositionY: 50, content: '' },
      { type: 'richtext', label: 'Text Block', width: 'full', content: '<p>Join our newsletter for updates, exclusives, and more.</p>' },
      { type: 'text', label: 'Name', width: 'half', placeholder: 'Your name', required: true },
      { type: 'email', label: 'Email', width: 'half', placeholder: 'you@email.com', required: true },
    ],
    settings: { submit_button_text: 'Subscribe', thank_you_message: '<h2>Welcome aboard!</h2><p>Check your inbox for a confirmation.</p>' }
  },
  { id: 'contact', name: 'Contact Form', icon: MessageSquare, description: 'Let people reach you',
    fields: [
      { type: 'heading', label: 'Get In Touch', width: 'full' },
      { type: 'text', label: 'Name', width: 'half', placeholder: 'Your name', required: true },
      { type: 'email', label: 'Email', width: 'half', placeholder: 'you@email.com', required: true },
      { type: 'phone', label: 'Phone', width: 'half', placeholder: '(555) 123-4567' },
      { type: 'select', label: 'Subject', width: 'half', options: ['General Inquiry', 'Support', 'Collaboration', 'Other'], required: true },
      { type: 'textarea', label: 'Message', width: 'full', placeholder: 'Tell us more...', required: true },
    ],
    settings: { submit_button_text: 'Send Message', notification_enabled: true }
  },
  { id: 'rsvp', name: 'Event RSVP', icon: UserPlus, description: 'Event registration & attendance',
    fields: [
      { type: 'heading', label: 'RSVP', width: 'full' },
      { type: 'text', label: 'Full Name', width: 'half', required: true },
      { type: 'email', label: 'Email', width: 'half', required: true },
      { type: 'radio', label: 'Will you attend?', width: 'full', options: ['Yes, I\'ll be there', 'Maybe', 'Can\'t make it'], required: true },
      { type: 'number', label: 'Number of Guests', width: 'half', placeholder: '1' },
      { type: 'select', label: 'Dietary Preference', width: 'half', options: ['No preference', 'Vegetarian', 'Vegan', 'Gluten-free', 'Other'] },
      { type: 'textarea', label: 'Notes', width: 'full', placeholder: 'Anything we should know?' },
    ],
    settings: { submit_button_text: 'Confirm RSVP' }
  },
  { id: 'quiz', name: 'Quiz / Trivia', icon: HelpCircle, description: 'Test knowledge with scoring',
    fields: [
      { type: 'heading', label: 'Quiz Time!', width: 'full' },
      { type: 'text', label: 'Your Name', width: 'full', required: true },
      { type: 'radio', label: 'Question 1', width: 'full', options: ['Option A', 'Option B', 'Option C', 'Option D'], required: true, correctAnswer: 'Option A', points: 1 },
      { type: 'radio', label: 'Question 2', width: 'full', options: ['Option A', 'Option B', 'Option C', 'Option D'], required: true, correctAnswer: 'Option A', points: 1 },
      { type: 'radio', label: 'Question 3', width: 'full', options: ['Option A', 'Option B', 'Option C', 'Option D'], required: true, correctAnswer: 'Option A', points: 1 },
    ],
    settings: { form_mode: 'quiz', show_score: true, show_correct_answers: true, submit_button_text: 'Submit Answers' }
  },
  { id: 'poll', name: 'Poll / Vote', icon: Vote, description: 'Quick opinion poll',
    fields: [
      { type: 'heading', label: 'Cast Your Vote', width: 'full' },
      { type: 'richtext', label: 'Text Block', width: 'full', content: '<p>We want to hear from you! Pick your favorite.</p>' },
      { type: 'radio', label: 'Your Pick', width: 'full', options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], required: true },
    ],
    settings: { form_mode: 'poll', show_poll_results: true, submit_button_text: 'Vote' }
  },
  { id: 'survey', name: 'Survey / Feedback', icon: ClipboardList, description: 'Gather detailed feedback',
    fields: [
      { type: 'heading', label: 'We Value Your Feedback', width: 'full' },
      { type: 'text', label: 'Name', width: 'half' },
      { type: 'email', label: 'Email', width: 'half' },
      { type: 'rating', label: 'Overall Experience', width: 'full', required: true },
      { type: 'likert', label: 'Satisfaction', width: 'full', likertStatement: 'How satisfied are you with our service?', options: ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'], required: true },
      { type: 'radio', label: 'Would you recommend us?', width: 'full', options: ['Definitely', 'Probably', 'Not sure', 'Probably not', 'Definitely not'], required: true },
      { type: 'textarea', label: 'Comments', width: 'full', placeholder: 'Tell us more...' },
    ],
    settings: { submit_button_text: 'Submit Feedback' }
  },
  { id: 'order', name: 'Order Form', icon: ShoppingCart, description: 'Collect orders & purchases',
    fields: [
      { type: 'heading', label: 'Place Your Order', width: 'full' },
      { type: 'text', label: 'Full Name', width: 'half', required: true },
      { type: 'email', label: 'Email', width: 'half', required: true },
      { type: 'phone', label: 'Phone', width: 'half', required: true },
      { type: 'text', label: 'Shipping Address', width: 'full', required: true },
      { type: 'divider', label: 'Divider', width: 'full' },
      { type: 'select', label: 'Product', width: 'half', options: ['Product A', 'Product B', 'Product C'], required: true },
      { type: 'number', label: 'Quantity', width: 'half', placeholder: '1', required: true },
      { type: 'textarea', label: 'Special Instructions', width: 'full', placeholder: 'Any special requests?' },
    ],
    settings: { submit_button_text: 'Place Order', notification_enabled: true }
  },
]

function generateFieldId() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export default function Dashboard() {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()

  useEffect(() => {
    if (searchParams.get('templates') === '1') {
      setShowTemplates(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

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

  async function handleDuplicate(id) {
    try {
      const newForm = await duplicateForm(id)
      navigate(`/forms/${newForm.id}/edit`)
      toast('Form duplicated')
    } catch (err) {
      toast('Duplicate failed', 'error')
    }
  }

  async function handleCreateForm(template) {
    try {
      const tmpl = template || TEMPLATES[0]
      const fields = (tmpl.fields || []).map(f => ({
        ...f,
        id: generateFieldId(),
        options: f.options || [],
        description: f.description || '',
        placeholder: f.placeholder || '',
        required: f.required || false,
        page: f.page || 0,
        conditions: f.conditions || [],
        correctAnswer: f.correctAnswer || '',
        points: f.points ?? 1,
      }))
      const form = await createForm({
        title: tmpl.id === 'blank' ? 'Untitled Form' : tmpl.name,
        fields,
        published: false,
        settings: tmpl.settings || {},
      })
      setShowTemplates(false)
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
          <p className="text-raven-500/80 text-sm mt-0.5">{forms.length} form{forms.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Empty State */}
      {forms.length === 0 && (
        <div className="text-center py-20 border border-dashed border-raven-200 rounded-xl">
          <Inbox className="w-10 h-10 text-raven-500/50 mx-auto mb-3" />
          <p className="text-raven-500/80 text-sm mb-4">No forms yet.</p>
          <button
            onClick={() => setShowTemplates(true)}
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
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <Eye className="w-3 h-3" /> Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-raven-500/70">
                        <EyeOff className="w-3 h-3" /> Draft
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
                  <button
                    onClick={() => navigate(`/forms/${form.form_id}/edit`)}
                    className="p-1.5 text-raven-500/80 hover:text-raven-300 hover:bg-raven-800/60 rounded-md transition-smooth"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(form.form_id)}
                    className="p-1.5 text-raven-500/80 hover:text-raven-300 hover:bg-raven-800/60 rounded-md transition-smooth"
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(form.form_id, form.title)}
                    className="p-1.5 text-raven-500/80 hover:text-red-500 hover:bg-red-50 rounded-md transition-smooth"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4 text-xs text-raven-500/80">
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
                className="text-xs text-raven-500 hover:text-raven-300 font-medium transition-smooth"
              >
                View Responses →
              </button>
              {form.published && (
                <button
                  onClick={() => window.open(getFormUrl(form.slug), '_blank')}
                  className="flex items-center gap-1 text-xs text-raven-500/70 hover:text-raven-300 transition-smooth"
                  title="Open public link"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Template Gallery Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowTemplates(false)}>
          <div className="bg-white border border-raven-200 rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-raven-50">Choose a Template</h3>
                <p className="text-xs text-raven-500 mt-0.5">Pick a starting point or start blank</p>
              </div>
              <button onClick={() => setShowTemplates(false)} className="p-1 text-raven-500 hover:text-raven-50"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TEMPLATES.map(tmpl => {
                const Icon = tmpl.icon
                return (
                  <button key={tmpl.id} onClick={() => handleCreateForm(tmpl)}
                    className="flex flex-col items-center gap-2 p-5 rounded-xl border border-raven-200 hover:border-raven-300 hover:shadow-md transition-smooth text-center group">
                    <div className="w-10 h-10 rounded-lg bg-raven-900 flex items-center justify-center group-hover:bg-raven-300/10 transition-smooth">
                      <Icon className="w-5 h-5 text-raven-300" />
                    </div>
                    <span className="text-sm font-medium text-raven-50">{tmpl.name}</span>
                    <span className="text-[10px] text-raven-500 leading-snug">{tmpl.description}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getFormBySlug, submitForm, triggerMailchimp, triggerNotification } from '../lib/supabase'
import { Feather, Star, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function PublicForm() {
  const { slug } = useParams()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})

  useEffect(() => {
    loadForm()
  }, [slug])

  async function loadForm() {
    try {
      const data = await getFormBySlug(slug)
      setForm(data)
      // Initialize values
      const initial = {}
      ;(data.fields || []).forEach(field => {
        if (field.type === 'checkbox') initial[field.id] = []
        else if (field.type === 'toggle') initial[field.id] = false
        else if (field.type === 'rating') initial[field.id] = 0
        else initial[field.id] = ''
      })
      setValues(initial)
    } catch (err) {
      setError('Form not found or no longer available.')
    } finally {
      setLoading(false)
    }
  }

  function setValue(fieldId, value) {
    setValues(prev => ({ ...prev, [fieldId]: value }))
    setErrors(prev => ({ ...prev, [fieldId]: '' }))
  }

  function validate() {
    const newErrors = {}
    ;(form.fields || []).forEach(field => {
      if (field.required && field.type !== 'heading') {
        const val = values[field.id]
        if (field.type === 'checkbox' && (!val || val.length === 0)) {
          newErrors[field.id] = 'Please select at least one option'
        } else if (field.type === 'rating' && (!val || val === 0)) {
          newErrors[field.id] = 'Please provide a rating'
        } else if (field.type !== 'checkbox' && field.type !== 'rating' && field.type !== 'toggle' && !val) {
          newErrors[field.id] = 'This field is required'
        }
      }
      if (field.type === 'email' && values[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(values[field.id])) {
          newErrors[field.id] = 'Please enter a valid email'
        }
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      // Build submission data with field labels
      const submissionData = {}
      ;(form.fields || []).forEach(field => {
        if (field.type !== 'heading') {
          submissionData[field.label] = values[field.id]
        }
      })

      // Submit to Supabase
      await submitForm(form.id, submissionData, {
        submitted_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
      })

      // Trigger Mailchimp if enabled
      const settings = form.settings || {}
      if (settings.mailchimp_enabled && settings.mailchimp_email_field) {
        const emailValue = values[settings.mailchimp_email_field]
        if (emailValue) {
          await triggerMailchimp(emailValue, form.id)
        }
      }

      // Trigger email notification
      if (settings.notification_enabled) {
        await triggerNotification(form.title, submissionData)
      }

      // Handle thank you
      if (settings.thank_you_url) {
        window.location.href = settings.thank_you_url
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Loading State ───────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, #08080d 70%)' }}>
        <Loader2 className="w-6 h-6 text-raven-300 animate-spin" />
      </div>
    )
  }

  // ─── Error State ─────────────────────────────
  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, #08080d 70%)' }}>
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400/60 mx-auto mb-3" />
          <p className="text-raven-300/60 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const accentColor = form?.settings?.accent_color || '#c9a55c'

  // ─── Thank You State ─────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, #08080d 70%)' }}>
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: accentColor }} />
          <h2 className="font-display text-2xl font-bold text-raven-50 mb-2">
            {form.settings?.thank_you_message || 'Thanks for submitting!'}
          </h2>
          <p className="text-raven-300/50 text-sm">Your response has been recorded.</p>
        </div>
      </div>
    )
  }

  // ─── Form Render ─────────────────────────────
  return (
    <div className="min-h-screen py-8 px-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, #08080d 70%)' }}>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-raven-50">{form.title}</h1>
          {form.description && (
            <p className="text-raven-300/60 text-sm mt-1">{form.description}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="public-form space-y-5">
          {(form.fields || []).map(field => (
            <div key={field.id}>
              {field.type === 'heading' ? (
                <h3 className="font-display text-lg font-semibold text-raven-50 pt-2">{field.label}</h3>
              ) : (
                <div>
                  <label className="block text-sm text-raven-50 mb-1.5 font-medium">
                    {field.label}
                    {field.required && <span style={{ color: accentColor }} className="ml-1">*</span>}
                  </label>
                  {field.description && (
                    <p className="text-xs text-raven-300/40 mb-2">{field.description}</p>
                  )}

                  {/* Text inputs */}
                  {['text', 'email', 'phone', 'url', 'number', 'date'].includes(field.type) && (
                    <input
                      type={field.type === 'phone' ? 'tel' : field.type}
                      value={values[field.id] || ''}
                      onChange={e => setValue(field.id, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}

                  {/* Textarea */}
                  {field.type === 'textarea' && (
                    <textarea
                      rows={4}
                      value={values[field.id] || ''}
                      onChange={e => setValue(field.id, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}

                  {/* Select */}
                  {field.type === 'select' && (
                    <select
                      value={values[field.id] || ''}
                      onChange={e => setValue(field.id, e.target.value)}
                    >
                      <option value="">Select...</option>
                      {(field.options || []).map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  )}

                  {/* Radio */}
                  {field.type === 'radio' && (
                    <div className="space-y-2">
                      {(field.options || []).map(o => (
                        <label key={o} className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-smooth ${
                            values[field.id] === o ? 'border-transparent' : 'border-raven-800/60 group-hover:border-raven-300/30'
                          }`} style={values[field.id] === o ? { borderColor: accentColor } : {}}>
                            {values[field.id] === o && (
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
                            )}
                          </div>
                          <span className="text-sm text-raven-300/80">{o}</span>
                          <input type="radio" className="sr-only" name={field.id} value={o}
                            checked={values[field.id] === o}
                            onChange={() => setValue(field.id, o)} />
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Checkbox */}
                  {field.type === 'checkbox' && (
                    <div className="space-y-2">
                      {(field.options || []).map(o => {
                        const checked = (values[field.id] || []).includes(o)
                        return (
                          <label key={o} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-smooth ${
                              checked ? 'border-transparent' : 'border-raven-800/60 group-hover:border-raven-300/30'
                            }`} style={checked ? { borderColor: accentColor, backgroundColor: accentColor } : {}}>
                              {checked && (
                                <svg className="w-3 h-3 text-raven-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm text-raven-300/80">{o}</span>
                            <input type="checkbox" className="sr-only" checked={checked}
                              onChange={() => {
                                const curr = values[field.id] || []
                                setValue(field.id, checked ? curr.filter(v => v !== o) : [...curr, o])
                              }} />
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {/* Rating */}
                  {field.type === 'rating' && (
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setValue(field.id, n)}
                          className="transition-smooth hover:scale-110"
                        >
                          <Star
                            className="w-7 h-7"
                            fill={n <= (values[field.id] || 0) ? accentColor : 'transparent'}
                            stroke={n <= (values[field.id] || 0) ? accentColor : 'rgba(255,255,255,0.15)'}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Toggle */}
                  {field.type === 'toggle' && (
                    <button
                      type="button"
                      onClick={() => setValue(field.id, !values[field.id])}
                      className={`w-12 h-6 rounded-full transition-smooth relative`}
                      style={{ backgroundColor: values[field.id] ? accentColor : 'rgba(255,255,255,0.1)' }}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-smooth ${
                        values[field.id] ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  )}

                  {/* Error */}
                  {errors[field.id] && (
                    <p className="text-xs text-red-400 mt-1.5">{errors[field.id]}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Submit Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/30 text-red-300 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg text-sm font-semibold text-raven-950 transition-smooth hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? 'Submitting...' : (form.settings?.submit_button_text || 'Submit')}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-8">
          <span className="text-xs text-raven-300/20 flex items-center justify-center gap-1">
            <Feather className="w-3 h-3" /> RavenForms
          </span>
        </div>
      </div>
    </div>
  )
}

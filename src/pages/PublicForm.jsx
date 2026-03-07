import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getFormBySlug, submitForm, uploadFile, triggerMailchimp, triggerNotification, triggerWelcomeEmail, checkDuplicateEmailByField, trackFormView, getSubmissions, getSubmissionCount } from '../lib/supabase'
import { Feather, Star, CheckCircle2, AlertCircle, Loader2, Upload, X, Lock } from 'lucide-react'

export default function PublicForm() {
  const { slug } = useParams()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [values, setValues] = useState({})
  const [fileData, setFileData] = useState({}) // { fieldId: { file, preview } }
  const [errors, setErrors] = useState({})
  const [honeypot, setHoneypot] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [quizResults, setQuizResults] = useState(null)
  const [pollResults, setPollResults] = useState(null)
  const [formClosed, setFormClosed] = useState(null)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordVerified, setPasswordVerified] = useState(false)

  useEffect(() => {
    loadForm()
  }, [slug])

  async function loadForm() {
    try {
      const data = await getFormBySlug(slug)
      setForm(data)
      // Track view
      trackFormView(data.id)

      const s = data.settings || {}

      // Check expiration
      if (s.expires_at && new Date(s.expires_at) < new Date()) {
        setFormClosed('This form has expired and is no longer accepting responses.')
        setLoading(false)
        return
      }

      // Check max responses
      if (s.max_responses && s.max_responses > 0) {
        const count = await getSubmissionCount(data.id)
        if (count >= s.max_responses) {
          setFormClosed('This form has reached its maximum number of responses.')
          setLoading(false)
          return
        }
      }

      // Check password
      if (s.form_password) {
        setPasswordRequired(true)
      }

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

  function handleFileChange(fieldId, file, field) {
    if (!file) return
    const maxSize = (field.maxSizeMB || 10) * 1024 * 1024
    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, [fieldId]: `File exceeds ${field.maxSizeMB || 10}MB limit` }))
      return
    }
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setFileData(prev => ({ ...prev, [fieldId]: { file, preview } }))
    setValues(prev => ({ ...prev, [fieldId]: file.name }))
    setErrors(prev => ({ ...prev, [fieldId]: '' }))
  }

  function removeFile(fieldId) {
    if (fileData[fieldId]?.preview) URL.revokeObjectURL(fileData[fieldId].preview)
    setFileData(prev => { const n = { ...prev }; delete n[fieldId]; return n })
    setValues(prev => ({ ...prev, [fieldId]: '' }))
  }

  // Multi-page
  const totalPages = form ? Math.max(1, (form.fields || []).reduce((max, f) => Math.max(max, (f.page || 0) + 1), 1)) : 1
  const isMultiPage = totalPages > 1

  // Conditional logic
  function isFieldVisible(field) {
    if (!field.conditions || field.conditions.length === 0) return true
    return field.conditions.every(cond => {
      if (!cond.fieldId) return true
      const val = values[cond.fieldId]
      const strVal = Array.isArray(val) ? val.join(', ') : String(val || '')
      switch (cond.operator) {
        case 'equals': return strVal.toLowerCase() === (cond.value || '').toLowerCase()
        case 'not_equals': return strVal.toLowerCase() !== (cond.value || '').toLowerCase()
        case 'contains': return strVal.toLowerCase().includes((cond.value || '').toLowerCase())
        case 'not_empty': return strVal.length > 0
        case 'is_empty': return strVal.length === 0 || strVal === '0' || strVal === 'false'
        default: return true
      }
    })
  }

  // Validate current page only (for multi-page next)
  function validatePage(pageNum) {
    const newErrors = {}
    ;(form.fields || []).forEach(field => {
      if ((field.page || 0) !== pageNum) return
      if (!isFieldVisible(field)) return
      if (field.required && !['heading', 'banner_image', 'avatar_image', 'richtext', 'file', 'divider'].includes(field.type)) {
        const val = values[field.id]
        if (field.type === 'checkbox' && (!val || val.length === 0)) {
          newErrors[field.id] = 'Please select at least one option'
        } else if (field.type === 'rating' && (!val || val === 0)) {
          newErrors[field.id] = 'Please provide a rating'
        } else if (field.type === 'file' && !fileData[field.id]) {
          newErrors[field.id] = 'Please upload a file'
        } else if (!['checkbox', 'rating', 'toggle', 'file'].includes(field.type) && !val) {
          newErrors[field.id] = 'This field is required'
        }
      }
      if (field.type === 'email' && values[field.id]) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[field.id])) {
          newErrors[field.id] = 'Please enter a valid email'
        }
      }
    })
    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

  function validate() {
    const newErrors = {}
    ;(form.fields || []).forEach(field => {
      if (!isFieldVisible(field)) return
      if (field.required && !['heading', 'banner_image', 'avatar_image', 'richtext', 'file', 'divider'].includes(field.type)) {
        const val = values[field.id]
        if (field.type === 'checkbox' && (!val || val.length === 0)) {
          newErrors[field.id] = 'Please select at least one option'
        } else if (field.type === 'rating' && (!val || val === 0)) {
          newErrors[field.id] = 'Please provide a rating'
        } else if (field.type === 'file' && !fileData[field.id]) {
          newErrors[field.id] = 'Please upload a file'
        } else if (field.type !== 'checkbox' && field.type !== 'rating' && field.type !== 'toggle' && field.type !== 'file' && !val) {
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

    // Honeypot - bots fill this in, humans don't see it
    if (honeypot) {
      setSubmitted(true) // silently fake success
      return
    }

    setSubmitting(true)
    try {
      const settings = form.settings || {}

      // Duplicate email check
      const emailField = (form.fields || []).find(f => f.type === 'email' || f.label?.toLowerCase() === 'email')
      if (emailField) {
        const emailVal = values[emailField.id]
        if (emailVal) {
          const isDupe = await checkDuplicateEmailByField(form.id, emailField.label, emailVal)
          if (isDupe) {
            setError('This email has already been submitted.')
            setSubmitting(false)
            return
          }
        }
      }

      // Upload any files first
      const fileUrls = {}
      for (const [fieldId, { file }] of Object.entries(fileData)) {
        try {
          const url = await uploadFile(file, form.id)
          fileUrls[fieldId] = url
        } catch (err) {
          setError(`Failed to upload ${file.name}`)
          setSubmitting(false)
          return
        }
      }

      // Build submission data with field labels
      const submissionData = {}
      ;(form.fields || []).forEach(field => {
        if (!isFieldVisible(field)) return
        if (!['heading', 'banner_image', 'avatar_image', 'richtext', 'file', 'divider'].includes(field.type)) {
          if (field.type === 'file' && fileUrls[field.id]) {
            submissionData[field.label] = fileUrls[field.id]
          } else {
            submissionData[field.label] = values[field.id]
          }
        }
      })

      // Submit to Supabase
      await submitForm(form.id, submissionData, {
        submitted_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
      })

      // Trigger Mailchimp if enabled
      if (settings.mailchimp_enabled && settings.mailchimp_email_field) {
        const emailValue = values[settings.mailchimp_email_field]
        if (emailValue) {
          await triggerMailchimp(emailValue, form.id)
        }
      }

      // Trigger email notification
      if (settings.notification_enabled !== false) {
        await triggerNotification(form.title, submissionData)
      }

      // Trigger welcome email
      if (settings.welcome_email_enabled && settings.welcome_email_subject && settings.welcome_email_body) {
        const emailFieldLabel = settings.welcome_email_field || 'Email'
        const recipientEmail = submissionData[emailFieldLabel]
        if (recipientEmail) {
          triggerWelcomeEmail(
            recipientEmail,
            settings.welcome_email_subject,
            settings.welcome_email_body,
            settings.welcome_email_from || form.title
          )
        }
      }

      // Trigger webhook
      if (settings.webhook_enabled && settings.webhook_url) {
        try {
          fetch(settings.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'no-cors',
            body: JSON.stringify({
              form_id: form.id,
              form_title: form.title,
              submitted_at: new Date().toISOString(),
              data: submissionData,
            }),
          })
        } catch (err) { console.error('Webhook error:', err) }
      }

      // Handle thank you
      if (settings.thank_you_url) {
        window.location.href = settings.thank_you_url
      } else {
        // Quiz scoring
        if (settings.form_mode === 'quiz' && settings.show_score) {
          const quizFields = (form.fields || []).filter(f => f.correctAnswer && isFieldVisible(f))
          let score = 0, total = 0, fieldResults = []
          quizFields.forEach(f => {
            const pts = f.points ?? 1
            total += pts
            const userVal = String(values[f.id] || '')
            const correct = String(f.correctAnswer || '')
            const isCorrect = f.type === 'toggle'
              ? userVal === correct
              : userVal.toLowerCase().trim() === correct.toLowerCase().trim()
            if (isCorrect) score += pts
            fieldResults.push({ label: f.label, userAnswer: userVal, correctAnswer: correct, isCorrect, points: pts })
          })
          setQuizResults({ score, total, percentage: total > 0 ? Math.round((score / total) * 100) : 0, fields: fieldResults })
        }

        // Poll results
        if (settings.form_mode === 'poll' && settings.show_poll_results) {
          try {
            const subs = await getSubmissions(form.id)
            const pollFields = (form.fields || []).filter(f => ['radio', 'select', 'checkbox'].includes(f.type))
            const results = {}
            pollFields.forEach(f => {
              const counts = {}
              ;(f.options || []).forEach(o => { counts[o] = 0 })
              subs.forEach(s => {
                const val = s.data?.[f.label]
                if (Array.isArray(val)) { val.forEach(v => { counts[v] = (counts[v] || 0) + 1 }) }
                else if (val) { counts[val] = (counts[val] || 0) + 1 }
              })
              results[f.id] = { label: f.label, counts, total: subs.length, options: f.options || [] }
            })
            setPollResults(results)
          } catch (err) { console.error('Poll results error:', err) }
        }

        setSubmitted(true)
      }
    } catch (err) {
      console.error('Submission error:', err)
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Colors ───────────────────────────────────
  const accentColor = form?.settings?.accent_color || '#b8923e'
  const bgColor = form?.settings?.background_color || '#faf7f2'
  const textColor = form?.settings?.text_color || '#2a2520'
  const cardColor = form?.settings?.card_color || '#ffffff'
  const buttonTextColor = form?.settings?.button_text_color || '#faf7f2'

  // ─── Loading State ───────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: bgColor }}>
        <Loader2 className="w-6 h-6 text-raven-300 animate-spin" />
      </div>
    )
  }

  // ─── Error State ─────────────────────────────
  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: bgColor }}>
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400/60 mx-auto mb-3" />
          <p className="text-raven-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }


  // ─── Form Closed State ───────────────────────
  if (formClosed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: bgColor }}>
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-raven-300/60 mx-auto mb-3" />
          <p className="text-sm" style={{ color: textColor }}>{formClosed}</p>
        </div>
      </div>
    )
  }

  // ─── Password Gate ───────────────────────────
  if (passwordRequired && !passwordVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: bgColor }}>
        <div className="w-full max-w-sm text-center">
          <Lock className="w-10 h-10 mx-auto mb-4" style={{ color: accentColor }} />
          <h2 className="font-display text-xl font-bold mb-1" style={{ color: textColor }}>This form is protected</h2>
          <p className="text-sm mb-6" style={{ color: textColor, opacity: 0.5 }}>Enter the password to continue</p>
          <input type="password" value={passwordInput} onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg border text-sm mb-3"
            style={{ borderColor: passwordError ? '#ef4444' : accentColor + '40', color: textColor }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (passwordInput === form.settings?.form_password) setPasswordVerified(true)
                else setPasswordError('Incorrect password')
              }
            }} />
          {passwordError && <p className="text-xs text-red-400 mb-3">{passwordError}</p>}
          <button onClick={() => {
            if (passwordInput === form.settings?.form_password) setPasswordVerified(true)
            else setPasswordError('Incorrect password')
          }} className="w-full py-3 rounded-lg text-sm font-semibold transition-smooth hover:opacity-90"
            style={{ backgroundColor: accentColor, color: buttonTextColor }}>
            Unlock
          </button>
        </div>
      </div>
    )
  }

  // ─── Thank You State ─────────────────────────
  if (submitted) {
    const tyContent = form.settings?.thank_you_message || '<h2>Thanks for submitting!</h2><p>Your response has been recorded.</p>'
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: bgColor }}>
        <div className="w-full max-w-lg">
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: accentColor }} />
            <div className="prose prose-sm max-w-none
              [&_blockquote]:border-l-4 [&_blockquote]:border-raven-300 [&_blockquote]:pl-4 [&_blockquote]:italic
              [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5
              [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-2
              [&_p]:text-sm [&_p]:leading-relaxed
              [&_a]:underline [&_a]:cursor-pointer"
              style={{ color: textColor, '--link-color': accentColor }}
              onClick={e => { if (e.target.tagName === 'A' && e.target.href) { window.open(e.target.href, '_blank', 'noopener') } }}
              dangerouslySetInnerHTML={{ __html: tyContent }} />
          </div>

          {/* Quiz Results */}
          {quizResults && (
            <div className="mt-8 rounded-xl p-6" style={{ backgroundColor: cardColor }}>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold font-display" style={{ color: accentColor }}>
                  {quizResults.percentage}%
                </div>
                <p className="text-sm mt-1" style={{ color: textColor, opacity: 0.6 }}>
                  {quizResults.score} / {quizResults.total} points
                </p>
              </div>
              {/* Progress ring */}
              <div className="w-full h-3 rounded-full mb-6" style={{ backgroundColor: textColor, opacity: 0.1 }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${quizResults.percentage}%`, backgroundColor: accentColor }} />
              </div>
              {form.settings?.show_correct_answers && quizResults.fields.map((r, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0" style={{ borderColor: textColor + '15' }}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${r.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                    {r.isCorrect ? '✓' : '✗'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: textColor }}>{r.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: textColor, opacity: 0.5 }}>
                      Your answer: {r.userAnswer || '(empty)'} {!r.isCorrect && `· Correct: ${r.correctAnswer}`}
                    </p>
                  </div>
                  <span className="text-xs font-medium" style={{ color: r.isCorrect ? '#059669' : textColor, opacity: r.isCorrect ? 1 : 0.3 }}>
                    {r.isCorrect ? `+${r.points}` : '0'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Poll Results */}
          {pollResults && (
            <div className="mt-8 space-y-6">
              {Object.values(pollResults).map((pr, i) => (
                <div key={i} className="rounded-xl p-5" style={{ backgroundColor: cardColor }}>
                  <h4 className="text-sm font-semibold mb-3" style={{ color: textColor }}>{pr.label}</h4>
                  <div className="space-y-2">
                    {pr.options.map(opt => {
                      const count = pr.counts[opt] || 0
                      const pct = pr.total > 0 ? Math.round((count / pr.total) * 100) : 0
                      return (
                        <div key={opt}>
                          <div className="flex justify-between text-xs mb-1" style={{ color: textColor }}>
                            <span>{opt}</span>
                            <span style={{ opacity: 0.5 }}>{count} vote{count !== 1 ? 's' : ''} · {pct}%</span>
                          </div>
                          <div className="w-full h-6 rounded-full overflow-hidden" style={{ backgroundColor: textColor + '10' }}>
                            <div className="h-full rounded-full transition-all duration-500 flex items-center pl-2"
                              style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: accentColor }}>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <p className="text-[10px] text-right mt-1" style={{ color: textColor, opacity: 0.4 }}>{pr.total} total response{pr.total !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Form Render ─────────────────────────────
  return (
    <div className="min-h-screen py-8 px-4"
      style={{ backgroundColor: bgColor }}>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold" style={{ color: textColor }}>{form.title}</h1>
          {form.description && (
            <p className="text-raven-500 text-sm mt-1">{form.description}</p>
          )}
        </div>

        {/* Progress bar for multi-page */}
        {isMultiPage && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs mb-2" style={{ color: textColor, opacity: 0.5 }}>
              <span>Step {currentPage + 1} of {totalPages}</span>
              <span>{Math.round(((currentPage + 1) / totalPages) * 100)}%</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: textColor, opacity: 0.1 }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((currentPage + 1) / totalPages) * 100}%`, backgroundColor: accentColor }} />
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="public-form flex flex-wrap gap-x-4 gap-y-5" style={{ color: textColor }}>
          {/* Honeypot - invisible to humans, catches bots */}
          <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true" tabIndex={-1}>
            <label>Leave this empty</label>
            <input type="text" name="website_url" value={honeypot} onChange={e => setHoneypot(e.target.value)} autoComplete="off" />
          </div>
          {(form.fields || []).filter(f => (!isMultiPage || (f.page || 0) === currentPage) && isFieldVisible(f)).map(field => {
            const fw = field.width || 'full'
            const widthStyle = fw === 'half' ? 'calc(50% - 8px)' : fw === 'third' ? 'calc(33.33% - 8px)' : fw === 'quarter' ? 'calc(25% - 8px)' : fw === 'two-thirds' ? 'calc(66.66% - 8px)' : '100%'
            return (
            <div key={field.id} style={{ width: widthStyle }} className="inline-block align-top">
              {/* Banner Image */}
              {field.type === 'banner_image' ? (
                field.imageUrl ? (
                  <img src={field.imageUrl} alt="Banner" className="w-full h-auto rounded-lg object-cover"
                    style={{ maxHeight: '300px', objectPosition: `center ${field.imagePositionY ?? 50}%` }} />
                ) : null
              ) : field.type === 'avatar_image' ? (
                field.imageUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={field.imageUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow" />
                  </div>
                ) : null
              ) : field.type === 'richtext' ? (
                <div className="text-sm leading-relaxed prose prose-sm max-w-none
                  [&_blockquote]:border-l-4 [&_blockquote]:border-raven-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-raven-500
                  [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5
                  [&_a]:underline [&_a]:cursor-pointer"
                  onClick={e => { if (e.target.tagName === 'A' && e.target.href) { e.preventDefault(); window.open(e.target.href, '_blank', 'noopener') } }}
                  dangerouslySetInnerHTML={{ __html: field.content || '' }} />
              ) : field.type === 'heading' ? (
                <h3 className="font-display text-lg font-semibold pt-2" style={{ color: textColor }}>{field.label}</h3>
              ) : field.type === 'file' ? (
                field.imageUrl ? (
                  <img src={field.imageUrl} alt={field.label || 'Image'}
                    className="rounded-lg object-contain"
                    style={field.imageWidthPx > 0 ? { width: `${field.imageWidthPx}px`, height: 'auto' } : { maxWidth: '100%', height: 'auto' }} />
                ) : null
              ) : (
                <div>
                  <label className="block text-sm mb-1.5 font-medium" style={{ color: textColor }}>
                    {field.label}
                    {field.required && <span style={{ color: accentColor }} className="ml-1">*</span>}
                  </label>
                  {field.description && (
                    <p className="text-xs text-raven-500/70 mb-2">{field.description}</p>
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
                            values[field.id] === o ? 'border-transparent' : 'border-raven-200 group-hover:border-raven-300'
                          }`} style={values[field.id] === o ? { borderColor: accentColor } : {}}>
                            {values[field.id] === o && (
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
                            )}
                          </div>
                          <span className="text-sm text-raven-700">{o}</span>
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
                              checked ? 'border-transparent' : 'border-raven-200 group-hover:border-raven-300'
                            }`} style={checked ? { borderColor: accentColor, backgroundColor: accentColor } : {}}>
                              {checked && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={buttonTextColor} strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm text-raven-700">{o}</span>
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
                            stroke={n <= (values[field.id] || 0) ? accentColor : 'rgba(0,0,0,0.15)'}
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
                      style={{ backgroundColor: values[field.id] ? accentColor : '#e5ddd0' }}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-smooth ${
                        values[field.id] ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  )}

                  {/* Slider */}
                  {field.type === 'slider' && (
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={field.min ?? 0}
                        max={field.max ?? 100}
                        step={field.step ?? 1}
                        value={values[field.id] || Math.round(((field.min ?? 0) + (field.max ?? 100)) / 2)}
                        onChange={e => setValue(field.id, Number(e.target.value))}
                        className="w-full accent-current"
                        style={{ accentColor }}
                      />
                      <div className="flex justify-between text-xs" style={{ color: textColor, opacity: 0.5 }}>
                        <span>{field.min ?? 0}</span>
                        <span className="font-semibold" style={{ color: accentColor }}>{values[field.id] || Math.round(((field.min ?? 0) + (field.max ?? 100)) / 2)}</span>
                        <span>{field.max ?? 100}</span>
                      </div>
                    </div>
                  )}

                  {/* Time */}
                  {field.type === 'time' && (
                    <input
                      type="time"
                      value={values[field.id] || ''}
                      onChange={e => setValue(field.id, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}

                  {/* Likert Scale */}
                  {field.type === 'likert' && (
                    <div className="space-y-2">
                      {field.likertStatement && <p className="text-sm italic" style={{ color: textColor, opacity: 0.7 }}>{field.likertStatement}</p>}
                      <div className="flex gap-1">
                        {(field.options || []).map(o => (
                          <label key={o} className="flex-1 text-center cursor-pointer group">
                            <div className={`w-6 h-6 rounded-full border-2 mx-auto mb-1 flex items-center justify-center transition-smooth ${
                              values[field.id] === o ? 'border-transparent' : 'border-raven-200 group-hover:border-raven-300'
                            }`} style={values[field.id] === o ? { borderColor: accentColor, backgroundColor: accentColor } : {}}>
                              {values[field.id] === o && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-[10px] leading-tight block" style={{ color: textColor, opacity: 0.6 }}>{o}</span>
                            <input type="radio" className="sr-only" name={field.id} value={o}
                              checked={values[field.id] === o}
                              onChange={() => setValue(field.id, o)} />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {errors[field.id] && (
                    <p className="text-xs text-red-400 mt-1.5">{errors[field.id]}</p>
                  )}
                </div>
              )}
              {/* Divider */}
              {field.type === 'divider' && (
                <hr className="border-t my-2" style={{ borderColor: textColor, opacity: 0.2 }} />
              )}
            </div>
            )
          })}

          {/* Submit Error */}
          {error && (
            <div className="w-full bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Navigation / Submit */}
          <div className="w-full flex gap-3">
            {isMultiPage && currentPage > 0 && (
              <button type="button" onClick={() => { setCurrentPage(p => p - 1); setError('') }}
                className="flex-1 py-3 rounded-lg text-sm font-semibold transition-smooth hover:opacity-90 border-2"
                style={{ borderColor: accentColor, color: accentColor }}>
                Back
              </button>
            )}
            {isMultiPage && currentPage < totalPages - 1 ? (
              <button type="button" onClick={() => {
                if (validatePage(currentPage)) { setCurrentPage(p => p + 1); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
              }}
                className="flex-1 py-3 rounded-lg text-sm font-semibold transition-smooth hover:opacity-90"
                style={{ backgroundColor: accentColor, color: buttonTextColor }}>
                Next
              </button>
            ) : (
              <button type="submit" disabled={submitting}
                className="flex-1 py-3 rounded-lg text-sm font-semibold transition-smooth hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accentColor, color: buttonTextColor }}>
                {submitting ? 'Submitting...' : (form.settings?.submit_button_text || 'Submit')}
              </button>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="text-center mt-8">
          <span className="text-xs text-raven-500/30 flex items-center justify-center gap-1">
            <Feather className="w-3 h-3" /> RavenForms
          </span>
        </div>
      </div>
    </div>
  )
}

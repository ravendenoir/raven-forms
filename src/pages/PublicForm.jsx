import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getFormBySlug, submitForm, uploadFile, triggerMailchimp, triggerNotification } from '../lib/supabase'
import { Feather, Star, CheckCircle2, AlertCircle, Loader2, Upload, X } from 'lucide-react'

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

  function validate() {
    const newErrors = {}
    ;(form.fields || []).forEach(field => {
      if (field.required && !['heading', 'banner_image', 'avatar_image', 'richtext'].includes(field.type)) {
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

    setSubmitting(true)
    try {
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
        if (!['heading', 'banner_image', 'avatar_image', 'richtext'].includes(field.type)) {
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

  // ─── Colors ───────────────────────────────────
  const accentColor = form?.settings?.accent_color || '#b8923e'
  const bgColor = form?.settings?.background_color || '#faf7f2'
  const textColor = form?.settings?.text_color || '#2a2520'
  const cardColor = form?.settings?.card_color || '#ffffff'

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


  // ─── Thank You State ─────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: bgColor }}>
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: accentColor }} />
          <h2 className="font-display text-2xl font-bold text-raven-50 mb-2">
            {form.settings?.thank_you_message || 'Thanks for submitting!'}
          </h2>
          <p className="text-raven-500/80 text-sm">Your response has been recorded.</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="public-form space-y-5" style={{ color: textColor }}>
          {(form.fields || []).map(field => (
            <div key={field.id}>
              {/* Banner Image */}
              {field.type === 'banner_image' ? (
                field.imageUrl ? (
                  <img src={field.imageUrl} alt="Banner" className="w-full h-auto rounded-lg object-cover" style={{ maxHeight: '300px' }} />
                ) : null
              ) : field.type === 'avatar_image' ? (
                field.imageUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={field.imageUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow" />
                  </div>
                ) : null
              ) : field.type === 'richtext' ? (
                <div className="text-sm leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: (field.content || '').split('\n').map(line => {
                      let p = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      if (/^[-•*]\s/.test(line)) return `<ul class="list-disc ml-5"><li>${p.replace(/^[-•*]\s/, '')}</li></ul>`
                      return `<p>${p}</p>`
                    }).join('')
                  }} />
              ) : field.type === 'heading' ? (
                <h3 className="font-display text-lg font-semibold pt-2" style={{ color: textColor }}>{field.label}</h3>
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
                                <svg className="w-3 h-3 text-raven-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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

                  {/* File Upload */}
                  {field.type === 'file' && (
                    <div>
                      {fileData[field.id] ? (
                        <div className="border border-raven-200 rounded-lg p-3 flex items-center gap-3">
                          {fileData[field.id].preview && (
                            <img src={fileData[field.id].preview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-raven-50 truncate">{fileData[field.id].file.name}</p>
                            <p className="text-xs text-raven-500/70">{(fileData[field.id].file.size / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
                          <button type="button" onClick={() => removeFile(field.id)} className="p-1 text-raven-500/70 hover:text-red-400 transition-smooth">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="block border-2 border-dashed border-raven-200 rounded-lg p-6 text-center cursor-pointer hover:border-raven-300/30 transition-smooth">
                          <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: accentColor }} />
                          <p className="text-sm text-raven-500">Upload an image</p>
                          <p className="text-xs text-raven-500/50 mt-1">PNG or JPEG — Max {field.maxSizeMB || 10}MB</p>
                          <input
                            type="file"
                            className="sr-only"
                            accept={field.accept || 'image/png,image/jpeg,image/jpg'}
                            onChange={e => handleFileChange(field.id, e.target.files?.[0], field)}
                          />
                        </label>
                      )}
                    </div>
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
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
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
          <span className="text-xs text-raven-500/30 flex items-center justify-center gap-1">
            <Feather className="w-3 h-3" /> RavenForms
          </span>
        </div>
      </div>
    </div>
  )
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Form Operations ─────────────────────────────

export async function getForms() {
  const { data, error } = await supabase
    .from('form_stats')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getForm(id) {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getFormBySlug(slug) {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()
  if (error) throw error
  return data
}

export async function createForm(form) {
  const slug = generateSlug(form.title || 'untitled')
  const { data, error } = await supabase
    .from('forms')
    .insert({ ...form, slug })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateForm(id, updates) {
  const { data, error } = await supabase
    .from('forms')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteForm(id) {
  const { error } = await supabase
    .from('forms')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Submission Operations ───────────────────────

export async function submitForm(formId, data, metadata = {}) {
  const { error } = await supabase
    .from('submissions')
    .insert({ form_id: formId, data, metadata })
  if (error) throw error
  return true
}

export async function getSubmissions(formId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function deleteSubmission(id) {
  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Auth ────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ─── File Upload ─────────────────────────────────

export async function uploadFile(file, formId) {
  const ext = file.name.split('.').pop()
  const fileName = `${formId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data, error } = await supabase.storage
    .from('form-uploads')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('form-uploads')
    .getPublicUrl(fileName)

  return urlData.publicUrl
}

// ─── Helpers ─────────────────────────────────────

function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40)
  const suffix = Math.random().toString(36).substring(2, 8)
  return `${base}-${suffix}`
}

// Trigger Netlify functions after submission
export async function triggerMailchimp(email, formId) {
  try {
    await fetch('/.netlify/functions/mailchimp-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, formId })
    })
  } catch (e) {
    console.warn('Mailchimp sync failed:', e)
  }
}

export async function triggerNotification(formTitle, submissionData) {
  try {
    await fetch('/.netlify/functions/notify-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formTitle, data: submissionData })
    })
  } catch (e) {
    console.warn('Notification failed:', e)
  }
}

export async function triggerWelcomeEmail(to, subject, body, fromName) {
  try {
    await fetch('/.netlify/functions/welcome-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body, fromName })
    })
  } catch (e) {
    console.warn('Welcome email failed:', e)
  }
}

// ─── Duplicate Check ─────────────────────────────

export async function checkDuplicateEmail(formId, email) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id')
    .eq('form_id', formId)
    .limit(500)
  if (error) return false // fail open
  // Check if any submission has this email in its data values
  const emailLower = email.toLowerCase().trim()
  return data.some(sub => {
    const d = sub.data || sub
    // submissions store data as JSONB with field labels as keys
    return false
  })
}

export async function checkDuplicateEmailByField(formId, fieldLabel, email) {
  try {
    const { data, error } = await supabase.rpc('check_duplicate_email', {
      form_id_input: formId,
      field_label_input: fieldLabel,
      email_input: email,
    })
    if (error) return false
    return data === true
  } catch (e) {
    return false
  }
}

// ─── View Tracking ───────────────────────────────

export async function trackFormView(formId) {
  try {
    await supabase.rpc('increment_view_count', { form_id_input: formId })
  } catch (e) {
    console.warn('View tracking failed:', e)
  }
}

// ─── Form Duplication ────────────────────────────

export async function duplicateForm(formId) {
  const original = await getForm(formId)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')
  const slug = original.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '') + '-' + Date.now().toString(36)
  const { data, error } = await supabase
    .from('forms')
    .insert({
      title: `${original.title} (Copy)`,
      description: original.description || '',
      fields: original.fields || [],
      settings: original.settings || {},
      published: false,
      slug,
      user_id: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Submission Count ────────────────────────────

export async function getSubmissionCount(formId) {
  const { count, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', formId)
  if (error) return 0
  return count || 0
}

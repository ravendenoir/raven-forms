// Netlify Function: Mailchimp Subscriber
// Adds email to your Mailchimp audience when a form is submitted,
// and applies the per-form tags set in form settings (mailchimp_tags).

import crypto from 'node:crypto'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { email, tags = [] } = JSON.parse(event.body)

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) }
    }

    const apiKey = process.env.MAILCHIMP_API_KEY
    const server = process.env.MAILCHIMP_SERVER_PREFIX
    const listId = process.env.MAILCHIMP_LIST_ID

    if (!apiKey || !server || !listId) {
      console.warn('Mailchimp not configured — skipping')
      return { statusCode: 200, body: JSON.stringify({ skipped: true }) }
    }

    const clean = String(email).trim()
    const base = `https://${server}.api.mailchimp.com/3.0/lists/${listId}`
    const hash = crypto.createHash('md5').update(clean.toLowerCase()).digest('hex')
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`
    }

    // Upsert the contact. status_if_new only applies to brand-new contacts,
    // so anyone who previously unsubscribed is never silently resubscribed.
    const upsert = await fetch(`${base}/members/${hash}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        email_address: clean,
        status_if_new: 'subscribed',
        merge_fields: { SOURCE: 'Askli' }
      })
    })

    const data = await upsert.json()

    if (!upsert.ok) {
      console.error('Mailchimp error:', data)
      return {
        statusCode: upsert.status,
        body: JSON.stringify({ error: data.detail || 'Mailchimp error' })
      }
    }

    // Tags are a separate endpoint — Mailchimp will not apply them on an
    // update, so existing contacts only get tagged by this second call.
    const clean_tags = (Array.isArray(tags) ? tags : [])
      .map(t => String(t).trim())
      .filter(Boolean)

    if (clean_tags.length) {
      const tagged = await fetch(`${base}/members/${hash}/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tags: clean_tags.map(name => ({ name, status: 'active' }))
        })
      })

      if (!tagged.ok) {
        console.error('Mailchimp tagging failed:', await tagged.text())
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        status: data.status || 'exists',
        tags: clean_tags
      })
    }

  } catch (err) {
    console.error('Mailchimp function error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' })
    }
  }
}

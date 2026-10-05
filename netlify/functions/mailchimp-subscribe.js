// Netlify Function: Mailchimp Subscriber
//
// Each form chooses which Mailchimp ACCOUNT it talks to and which TAGS it
// applies, via the form's settings (mailchimp_account, mailchimp_tags).
//
// Accounts are defined by environment variables in Netlify, never in this
// repo and never in the database. For an account named "regina", set:
//
//   MAILCHIMP_REGINA_API_KEY
//   MAILCHIMP_REGINA_SERVER_PREFIX   (e.g. us19)
//   MAILCHIMP_REGINA_LIST_ID
//
// A form with no account set falls back to the unprefixed defaults:
//   MAILCHIMP_API_KEY / MAILCHIMP_SERVER_PREFIX / MAILCHIMP_LIST_ID
//
// If an account is named but its variables are missing, the function stops
// rather than quietly writing to the default account. That matters: a
// Regina subscriber must never land in Raven's audience.

import crypto from 'node:crypto'

// Account names come from form settings, so constrain them before they ever
// touch process.env lookups.
function envPrefix(account) {
  const slug = String(account || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  return slug ? `MAILCHIMP_${slug}_` : 'MAILCHIMP_'
}

function resolveAccount(account) {
  const p = envPrefix(account)
  return {
    apiKey: process.env[`${p}API_KEY`],
    server: process.env[`${p}SERVER_PREFIX`],
    listId: process.env[`${p}LIST_ID`]
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { email, account = '', tags = [] } = JSON.parse(event.body)

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) }
    }

    const { apiKey, server, listId } = resolveAccount(account)

    if (!apiKey || !server || !listId) {
      // Named but unconfigured is a misconfiguration, not a no-op. Never
      // silently fall through to another account's audience.
      const label = account ? `account "${account}"` : 'default account'
      console.warn(`Mailchimp ${label} not configured — skipping`)
      return {
        statusCode: 200,
        body: JSON.stringify({ skipped: true, account: account || 'default' })
      }
    }

    const clean = String(email).trim()
    const base = `https://${server}.api.mailchimp.com/3.0/lists/${listId}`
    const hash = crypto.createHash('md5').update(clean.toLowerCase()).digest('hex')
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`
    }

    // Upsert. status_if_new applies only to brand-new contacts, so anyone
    // who previously unsubscribed is never silently resubscribed.
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

    // Tags are a separate endpoint. Mailchimp ignores tags on an update, so
    // without this call existing contacts would never get tagged.
    const cleanTags = (Array.isArray(tags) ? tags : [])
      .map(t => String(t).trim())
      .filter(Boolean)

    if (cleanTags.length) {
      const tagged = await fetch(`${base}/members/${hash}/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tags: cleanTags.map(name => ({ name, status: 'active' }))
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
        account: account || 'default',
        tags: cleanTags
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

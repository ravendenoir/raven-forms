// Netlify Function: Mailchimp Subscriber
//
// Each form chooses which Mailchimp AUDIENCE it writes to and which TAGS it
// applies, via the form's settings (mailchimp_account, mailchimp_tags).
//
// Audiences are defined by environment variables in Netlify, never in this
// repo and never in the database. For an account named "regina", set:
//
//   MAILCHIMP_REGINA_LIST_ID        (required)
//   MAILCHIMP_REGINA_API_KEY        (optional; falls back to the shared key)
//   MAILCHIMP_REGINA_SERVER_PREFIX  (optional; falls back to the shared one)
//
// LIST_ID has no fallback on purpose: a form pointed at an account with no
// audience configured skips rather than writing into the default audience.

import crypto from 'node:crypto'

// Account names come from form settings, so constrain them before they ever
// reach a process.env lookup.
function envPrefix(account) {
  const slug = String(account || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  return slug ? `MAILCHIMP_${slug}_` : 'MAILCHIMP_'
}

function resolveAccount(account) {
  const p = envPrefix(account)
  return {
    apiKey: process.env[`${p}API_KEY`] || process.env.MAILCHIMP_API_KEY,
    server: process.env[`${p}SERVER_PREFIX`] || process.env.MAILCHIMP_SERVER_PREFIX,
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
    const label = account || 'default'

    if (!apiKey || !server || !listId) {
      console.warn(`[mailchimp] account "${label}" not configured — skipping`)
      return { statusCode: 200, body: JSON.stringify({ skipped: true, account: label }) }
    }

    const clean = String(email).trim()
    const base = `https://${server}.api.mailchimp.com/3.0/lists/${listId}`
    const hash = crypto.createHash('md5').update(clean.toLowerCase()).digest('hex')
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`
    }

    // Look before writing. The existing state decides whether we may set a
    // status at all.
    //
    //   missing (404)  new contact, or archived — Mailchimp hides archived
    //                  contacts from this endpoint. Either way an explicit
    //                  status both creates and un-archives.
    //   archived       un-archive by writing an explicit status.
    //   subscribed     nothing to change; only refresh merge fields.
    //   unsubscribed   someone opted out. Never override. Mailchimp refuses
    //   or cleaned     these anyway, which is the real guardrail.
    const lookup = await fetch(`${base}/members/${hash}`, { headers })
    const existing = lookup.ok ? await lookup.json() : null
    const state = existing ? existing.status : 'missing'

    const optedOut = state === 'unsubscribed' || state === 'cleaned'
    const needsStatus = state === 'missing' || state === 'archived'

    const body = { email_address: clean, merge_fields: { SOURCE: 'Askli' } }
    if (needsStatus) {
      // Creates a new contact, or un-archives an existing one.
      body.status = 'subscribed'
    } else if (!optedOut) {
      body.status_if_new = 'subscribed'
    }

    let wrote = false

    if (optedOut) {
      console.warn(
        `[mailchimp] ${label}/${listId}: contact is ${state} — leaving status untouched`
      )
    } else {
      const upsert = await fetch(`${base}/members/${hash}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      })

      if (!upsert.ok) {
        const detail = await upsert.text()
        console.error(`[mailchimp] ${label}/${listId}: write failed (was ${state}) — ${detail}`)
        return {
          statusCode: upsert.status,
          body: JSON.stringify({ error: 'Mailchimp error', account: label })
        }
      }

      wrote = true
      console.log(`[mailchimp] ${label}/${listId}: ${state} -> subscribed`)
    }

    // Tags are a separate endpoint. Mailchimp ignores tags on an update, so
    // without this call an existing contact would never get tagged. It also
    // has to run after any un-archive, since archived contacts can't be
    // tagged.
    const cleanTags = (Array.isArray(tags) ? tags : [])
      .map(t => String(t).trim())
      .filter(Boolean)

    if (cleanTags.length && !optedOut) {
      const tagged = await fetch(`${base}/members/${hash}/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tags: cleanTags.map(name => ({ name, status: 'active' }))
        })
      })

      if (!tagged.ok) {
        console.error(
          `[mailchimp] ${label}/${listId}: tagging failed — ${await tagged.text()}`
        )
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        account: label,
        list: listId,
        previous: state,
        updated: wrote,
        tags: cleanTags
      })
    }

  } catch (err) {
    console.error('[mailchimp] function error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) }
  }
}

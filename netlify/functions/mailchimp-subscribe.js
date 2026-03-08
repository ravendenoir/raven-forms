// Netlify Function: Mailchimp Subscriber
// Adds email to your Mailchimp audience when a form is submitted

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { email, formId } = JSON.parse(event.body)

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

    const url = `https://${server}.api.mailchimp.com/3.0/lists/${listId}/members`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`
      },
      body: JSON.stringify({
        email_address: email,
        status: 'subscribed',
        tags: ['askli', `form-${formId}`],
        merge_fields: {
          SOURCE: 'Askli'
        }
      })
    })

    const data = await response.json()

    // Mailchimp returns 400 if already subscribed — that's fine
    if (!response.ok && data.title !== 'Member Exists') {
      console.error('Mailchimp error:', data)
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.detail || 'Mailchimp error' })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, status: data.status || 'exists' })
    }

  } catch (err) {
    console.error('Mailchimp function error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' })
    }
  }
}

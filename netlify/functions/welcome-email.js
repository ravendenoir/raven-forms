// Netlify Function: Welcome/Confirmation Email
// Sends a styled welcome email to the person who submitted the form
// Uses Resend (free tier: 100 emails/day)

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { to, subject, body, fromName } = JSON.parse(event.body)

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn('Resend not configured — skipping welcome email')
      return { statusCode: 200, body: JSON.stringify({ skipped: true }) }
    }

    if (!to || !subject) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing to or subject' }) }
    }

    const senderName = fromName || 'RavenForms'

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;border:1px solid #1f1f2e;border-radius:12px;overflow:hidden;">
        <div style="padding:32px 28px;">
          ${body}
        </div>
        <div style="padding:16px 28px;border-top:1px solid #1f1f2e;">
          <p style="margin:0;color:#4a4a5a;font-size:11px;">Sent via RavenForms</p>
        </div>
      </div>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: `${senderName} <noreply@resend.dev>`,
        to: [to],
        subject,
        html
      })
    })

    if (!response.ok) {
      const errData = await response.json()
      console.error('Resend welcome email error:', errData)
      return { statusCode: response.status, body: JSON.stringify(errData) }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    }

  } catch (err) {
    console.error('Welcome email function error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' })
    }
  }
}

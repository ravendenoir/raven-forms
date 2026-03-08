// Netlify Function: Email Notification
// Sends you an email when someone submits a form
// Uses Resend (free tier: 100 emails/day — more than enough)

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { formTitle, data } = JSON.parse(event.body)

    const apiKey = process.env.RESEND_API_KEY
    const notifyEmail = process.env.NOTIFICATION_EMAIL

    if (!apiKey || !notifyEmail) {
      console.warn('Resend not configured — skipping notification')
      return { statusCode: 200, body: JSON.stringify({ skipped: true }) }
    }

    // Build a clean email body from the submission data
    const fields = Object.entries(data || {})
      .map(([label, value]) => {
        const displayValue = Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'boolean'
          ? (value ? 'Yes' : 'No')
          : String(value || '—')
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #1f1f2e;color:#7a7a8a;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1f1f2e;color:#e8e4dc;font-size:13px;">${displayValue}</td>
        </tr>`
      })
      .join('')

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0d0d14;border:1px solid #1f1f2e;border-radius:12px;overflow:hidden;">
        <div style="padding:24px 24px 16px;border-bottom:1px solid #1f1f2e;">
          <h2 style="margin:0 0 4px;color:#e8e4dc;font-size:18px;">New Submission</h2>
          <p style="margin:0;color:#7a7a8a;font-size:13px;">${formTitle} · ${new Date().toLocaleString()}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          ${fields}
        </table>
        <div style="padding:16px 24px;border-top:1px solid #1f1f2e;">
          <p style="margin:0;color:#4a4a5a;font-size:11px;">Sent from Askli</p>
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
        from: 'Askli <noreply@resend.dev>',
        to: [notifyEmail],
        subject: `📝 New submission: ${formTitle}`,
        html
      })
    })

    if (!response.ok) {
      const errData = await response.json()
      console.error('Resend error:', errData)
      return { statusCode: response.status, body: JSON.stringify(errData) }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    }

  } catch (err) {
    console.error('Notification function error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' })
    }
  }
}

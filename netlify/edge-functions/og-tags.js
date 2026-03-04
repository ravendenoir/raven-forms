// Netlify Edge Function: Open Graph Meta Tags
// Intercepts /f/* requests from social media crawlers
// Fetches form data from Supabase and injects OG tags
// Regular visitors pass through to the normal SPA

const CRAWLERS = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Pinterest|Googlebot|bingbot/i

export default async (request, context) => {
  const ua = request.headers.get('user-agent') || ''
  const url = new URL(request.url)

  // Debug mode: add ?og=debug to any /f/ URL to see what the crawler gets
  const debugMode = url.searchParams.get('og') === 'debug'

  // Regular visitors get the normal SPA — no modification
  if (!CRAWLERS.test(ua) && !debugMode) {
    return context.next()
  }

  // Extract slug from /f/my-form-slug
  const slug = url.pathname.replace(/^\/f\//, '').replace(/\/$/, '')

  if (!slug) {
    if (debugMode) return new Response('No slug found in URL', { headers: { 'content-type': 'text/plain' } })
    return context.next()
  }

  try {
    // Fetch form data directly from Supabase REST API
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
    const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseKey) {
      if (debugMode) return new Response(`Missing env vars.\nVITE_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}\nVITE_SUPABASE_ANON_KEY: ${supabaseKey ? 'SET' : 'MISSING'}`, { headers: { 'content-type': 'text/plain' } })
      return context.next()
    }

    const apiUrl = `${supabaseUrl}/rest/v1/forms?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=title,description,fields,settings`

    const res = await fetch(apiUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Accept': 'application/json',
      }
    })

    if (!res.ok) {
      if (debugMode) return new Response(`Supabase API error: ${res.status} ${res.statusText}\nURL: ${apiUrl}`, { headers: { 'content-type': 'text/plain' } })
      return context.next()
    }

    const forms = await res.json()
    if (!forms.length) {
      if (debugMode) return new Response(`No published form found with slug: "${slug}"\nAPI URL: ${apiUrl}\nResponse: ${JSON.stringify(forms)}`, { headers: { 'content-type': 'text/plain' } })
      return context.next()
    }

    const form = forms[0]
    const title = form.title || 'Form'
    const description = form.description || 'Fill out this form'
    const accentColor = form.settings?.accent_color || '#c9a55c'
    const siteUrl = url.origin

    // Find the first banner image in fields for og:image
    let ogImage = ''
    const fields = form.fields || []
    for (const field of fields) {
      if (field.type === 'banner_image' && field.imageUrl) {
        ogImage = field.imageUrl
        break
      }
      if (field.type === 'avatar_image' && field.imageUrl) {
        ogImage = field.imageUrl
        // Don't break — keep looking for a banner (better image)
      }
    }

    // Escape HTML entities in dynamic content
    const esc = (str) => String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // In debug mode, show raw data instead of the OG HTML
    if (debugMode) {
      return new Response(
        `=== OG EDGE FUNCTION DEBUG ===\n\n` +
        `Slug: ${slug}\n` +
        `Title: ${title}\n` +
        `Description: ${description}\n` +
        `OG Image: ${ogImage || '(none found)'}\n` +
        `Accent Color: ${accentColor}\n` +
        `Total Fields: ${fields.length}\n` +
        `Banner Fields: ${fields.filter(f => f.type === 'banner_image').map(f => JSON.stringify({ type: f.type, imageUrl: f.imageUrl })).join(', ') || '(none)'}\n` +
        `Avatar Fields: ${fields.filter(f => f.type === 'avatar_image').map(f => JSON.stringify({ type: f.type, imageUrl: f.imageUrl })).join(', ') || '(none)'}\n\n` +
        `=== RAW FORM DATA ===\n${JSON.stringify(form, null, 2)}`,
        { headers: { 'content-type': 'text/plain' } }
      )
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>

  <!-- Open Graph (Facebook, LinkedIn, iMessage, etc.) -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(url.href)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:site_name" content="${esc(title)}" />
  ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  ${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}" />` : ''}

  <!-- General -->
  <meta name="description" content="${esc(description)}" />
  <meta name="theme-color" content="${esc(accentColor)}" />

  <!-- Redirect real browsers that somehow land here -->
  <meta http-equiv="refresh" content="0;url=${esc(url.href)}" />
</head>
<body>
  <h1>${esc(title)}</h1>
  <p>${esc(description)}</p>
  ${ogImage ? `<img src="${esc(ogImage)}" alt="${esc(title)}" />` : ''}
  <p><a href="${esc(url.href)}">Open this form</a></p>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300', // Cache 5 min
      }
    })

  } catch (err) {
    // If anything fails, fall through to normal SPA
    console.error('OG edge function error:', err)
    if (debugMode) {
      return new Response(`Edge function error: ${err.message}\n\nStack: ${err.stack}`, {
        status: 500,
        headers: { 'content-type': 'text/plain' }
      })
    }
    return context.next()
  }
}

// Path configured in netlify.toml → [[edge_functions]]

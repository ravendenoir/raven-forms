// Netlify Edge Function: Open Graph Meta Tags
// Intercepts /f/* requests from social media crawlers
// Fetches form data from Supabase and injects OG tags
// Regular visitors pass through to the normal SPA

const CRAWLERS = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Pinterest|Googlebot|bingbot/i

export default async (request, context) => {
  const ua = request.headers.get('user-agent') || ''

  // Regular visitors get the normal SPA — no modification
  if (!CRAWLERS.test(ua)) {
    return context.next()
  }

  // Extract slug from /f/my-form-slug
  const url = new URL(request.url)
  const slug = url.pathname.replace(/^\/f\//, '').replace(/\/$/, '')

  if (!slug) return context.next()

  try {
    // Fetch form data directly from Supabase REST API
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
    const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseKey) return context.next()

    const apiUrl = `${supabaseUrl}/rest/v1/forms?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=title,description,fields,settings`

    const res = await fetch(apiUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Accept': 'application/json',
      }
    })

    if (!res.ok) return context.next()

    const forms = await res.json()
    if (!forms.length) return context.next()

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
    return context.next()
  }
}

export const config = { path: "/f/*" }

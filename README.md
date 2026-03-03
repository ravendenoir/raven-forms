# RavenForms

A self-hosted form builder — your own Tally Forms alternative. Build forms, collect responses, sync to Mailchimp, get email notifications. Zero monthly cost.

**Stack:** React + Vite + Tailwind | Supabase (free) | Netlify (free) | Mailchimp API | Resend (free)

---

## Quick Start (30 minutes)

### Step 1: Set Up Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** — pick any name and a strong database password
3. Wait for provisioning (~2 min)
4. Go to **SQL Editor** (left sidebar) → **New Query**
5. Paste the entire contents of `supabase-setup.sql` and click **Run**
6. Go to **Authentication** → **Users** → **Add User** → create your login (email + password)
7. Go to **Project Settings** → **API** — copy these two values:
   - `Project URL` → this is your `VITE_SUPABASE_URL`
   - `anon / public` key → this is your `VITE_SUPABASE_ANON_KEY`

### Step 2: Set Up Mailchimp (Newsletter Integration)

1. Log into [mailchimp.com](https://mailchimp.com)
2. Go to **Account & Billing** → **Extras** → **API Keys** → **Create A Key**
3. Copy the API key — the part after the dash is your server prefix (e.g., `us21`)
4. Go to **Audience** → **All Contacts** → **Settings** → **Audience name and defaults**
5. Find your **Audience ID** (also called List ID)

You now have:
- `MAILCHIMP_API_KEY`
- `MAILCHIMP_SERVER_PREFIX` (e.g., `us21`)
- `MAILCHIMP_LIST_ID`

### Step 3: Set Up Resend (Email Notifications)

1. Go to [resend.com](https://resend.com) and create a free account
2. Go to **API Keys** → **Create API Key**
3. Copy the key — this is your `RESEND_API_KEY`

Free tier gives you 100 emails/day — more than enough for form notifications.

### Step 4: Deploy to Netlify

**Option A: Deploy via GitHub (recommended)**

1. Push this project to a GitHub repo
2. Go to [netlify.com](https://netlify.com) → **Add New Site** → **Import from Git**
3. Connect your GitHub repo
4. Build settings should auto-detect:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Go to **Site Settings** → **Environment Variables** and add all 6 variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   MAILCHIMP_API_KEY=your-key
   MAILCHIMP_SERVER_PREFIX=us21
   MAILCHIMP_LIST_ID=your-list-id
   RESEND_API_KEY=your-resend-key
   NOTIFICATION_EMAIL=your@email.com
   ```
6. Trigger a redeploy

**Option B: Deploy via Netlify CLI**

```bash
npm install -g netlify-cli
netlify login
netlify init        # Link to new or existing site
netlify env:set VITE_SUPABASE_URL "https://your-project.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "your-anon-key"
# ... set remaining env vars ...
netlify deploy --build --prod
```

### Step 5: Use It

1. Visit your Netlify URL → you'll see the login page
2. Sign in with the email/password you created in Supabase (Step 1.6)
3. Create your first form
4. Toggle **Publish** on
5. Share the public link (`yoursite.netlify.app/f/your-form-slug`)

---

## Local Development

```bash
# Install dependencies
npm install

# Create .env from template
cp .env.example .env
# Fill in your values

# Start dev server
npm run dev
```

App runs at `http://localhost:5173`

---

## How It Works

| Feature | How |
|---------|-----|
| **Form Builder** | Drag-and-drop fields, live preview, 13 field types |
| **Public Forms** | Standalone pages at `/f/your-slug` — share anywhere |
| **Submissions** | Stored in Supabase Postgres with row-level security |
| **Mailchimp** | Netlify Function calls Mailchimp API on submission |
| **Notifications** | Netlify Function sends email via Resend API |
| **CSV Export** | Client-side export from the responses dashboard |
| **Auth** | Supabase Auth — only you can access the admin |

## Field Types

Short Text, Long Text, Email, Number, Phone, URL, Date, Dropdown, Multiple Choice, Checkboxes, Rating (stars), Yes/No Toggle, Section Heading

## Form Settings

- Custom submit button text
- Thank you message or redirect URL
- Custom accent color
- Mailchimp auto-subscribe toggle
- Email notification toggle

---

## Custom Domain (Optional)

1. In Netlify: **Domain Management** → **Add Custom Domain**
2. Follow DNS instructions (usually add a CNAME record)
3. Netlify auto-provisions HTTPS via Let's Encrypt

Your forms would then live at `yourdomain.com/f/form-slug`

---

## Costs

| Service | Free Tier Limit | Your Likely Usage |
|---------|----------------|-------------------|
| Supabase | 500MB DB, 50K rows | Well within |
| Netlify | 100GB bandwidth, 125K functions | Well within |
| Resend | 100 emails/day | Well within |
| Mailchimp | 500 contacts free | Depends on growth |

**Total: $0/month** unless you exceed Mailchimp's free tier (500 contacts).

---

## Troubleshooting

**"Form not found" on public link:** Make sure the form is toggled to Published in the builder.

**Login not working:** Confirm you created a user in Supabase Authentication → Users.

**Mailchimp not syncing:** Check that the `mailchimp_email_field` in form settings matches the actual field ID of your email field. You can find field IDs by clicking a field in the builder.

**No email notifications:** Verify your `RESEND_API_KEY` and `NOTIFICATION_EMAIL` are set in Netlify environment variables, then redeploy.

---

Built for [Raven DeNoir](https://ravendenoir.com) — because paying monthly for a form builder is offensive.

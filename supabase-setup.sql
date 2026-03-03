-- ===========================================
-- RAVENFORMS - Supabase Database Setup
-- ===========================================
-- Run this in your Supabase SQL Editor (supabase.com > SQL Editor)

-- 1. FORMS TABLE
create table if not exists forms (
  id uuid default gen_random_uuid() primary key,
  title text not null default 'Untitled Form',
  description text default '',
  slug text unique not null,
  fields jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{
    "thank_you_message": "Thanks for submitting!",
    "thank_you_url": "",
    "mailchimp_enabled": false,
    "mailchimp_email_field": "",
    "notification_enabled": true,
    "submit_button_text": "Submit",
    "accent_color": "#c9a55c"
  }'::jsonb,
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. SUBMISSIONS TABLE
create table if not exists submissions (
  id uuid default gen_random_uuid() primary key,
  form_id uuid references forms(id) on delete cascade not null,
  data jsonb not null default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 3. INDEXES
create index if not exists idx_forms_slug on forms(slug);
create index if not exists idx_forms_published on forms(published);
create index if not exists idx_submissions_form_id on submissions(form_id);
create index if not exists idx_submissions_created_at on submissions(created_at desc);

-- 4. ROW LEVEL SECURITY
alter table forms enable row level security;
alter table submissions enable row level security;

-- Authenticated users (you) can do everything with forms
create policy "auth_manage_forms" on forms
  for all
  to authenticated
  using (true)
  with check (true);

-- Anyone can read published forms (for the public form page)
create policy "public_read_published_forms" on forms
  for select
  to anon
  using (published = true);

-- Anyone can submit to published forms
create policy "public_insert_submissions" on submissions
  for insert
  to anon
  with check (
    exists (
      select 1 from forms
      where forms.id = form_id
      and forms.published = true
    )
  );

-- Authenticated users can view all submissions
create policy "auth_read_submissions" on submissions
  for select
  to authenticated
  using (true);

-- Authenticated users can delete submissions
create policy "auth_delete_submissions" on submissions
  for delete
  to authenticated
  using (true);

-- 5. AUTO-UPDATE TIMESTAMP FUNCTION
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger forms_updated_at
  before update on forms
  for each row
  execute function update_updated_at();

-- 6. SUBMISSION COUNT VIEW (for dashboard)
create or replace view form_stats as
select
  f.id as form_id,
  f.title,
  f.slug,
  f.published,
  f.created_at,
  f.updated_at,
  count(s.id) as submission_count,
  max(s.created_at) as last_submission_at
from forms f
left join submissions s on s.form_id = f.id
group by f.id, f.title, f.slug, f.published, f.created_at, f.updated_at;

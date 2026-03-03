-- ===========================================
-- RAVENFORMS - Storage Policies
-- ===========================================
-- Run this in your Supabase SQL Editor AFTER creating the 'form-uploads' bucket

-- Allow anyone to upload files to form-uploads bucket
create policy "public_upload" on storage.objects
  for insert
  to anon
  with check (bucket_id = 'form-uploads');

-- Allow anyone to read files from form-uploads bucket  
create policy "public_read" on storage.objects
  for select
  to anon
  using (bucket_id = 'form-uploads');

-- Allow authenticated users (you) to delete files
create policy "auth_delete_uploads" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'form-uploads');

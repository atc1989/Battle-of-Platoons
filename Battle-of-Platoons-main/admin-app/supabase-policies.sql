-- Enable RLS (if not already enabled)
alter table storage.objects enable row level security;

-- Public read access for avatars bucket
create policy "Public read avatars" on storage.objects
  for select using (bucket_id = 'avatars');

-- Authenticated users can insert avatars
create policy "Authenticated insert avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

-- Authenticated users can update avatars
create policy "Authenticated update avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

-- Authenticated users can delete avatars
create policy "Authenticated delete avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars');

-- Add share_token to projects for public sharing
alter table public.projects add column if not exists share_token text unique;

-- Create index for share token lookups
create index if not exists idx_projects_share_token on public.projects (share_token) where share_token is not null;

-- Allow anonymous read access to shared projects via share_token
create policy "Anyone can view shared projects" on public.projects
  for select using (share_token is not null);

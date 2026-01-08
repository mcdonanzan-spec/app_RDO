-- Create visual_management table to store the JSON state
-- This links the visual management data to a specific project
create table public.project_visual_management (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id),
  unique(project_id)
);

-- Enable RLS
alter table public.project_visual_management enable row level security;

-- Policies
create policy "Authenticated users can view visual management" on project_visual_management
  for select using (auth.role() = 'authenticated');

create policy "Editors can insert/update visual management" on project_visual_management
  for insert with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and role in ('ADMIN', 'EDITOR'))
  );

create policy "Editors can update visual management" on project_visual_management
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and role in ('ADMIN', 'EDITOR'))
  );

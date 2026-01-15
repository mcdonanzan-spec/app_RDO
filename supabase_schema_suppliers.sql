-- Create suppliers table
create table public.suppliers (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  razao_social text not null,
  cnpj text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id),
  unique(project_id, cnpj)
);

-- Enable RLS
alter table public.suppliers enable row level security;

-- Policies
create policy "Authenticated users can view suppliers" on suppliers
  for select using (auth.role() = 'authenticated');

create policy "Editors can insert suppliers" on suppliers
  for insert with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and role in ('ADM', 'GERENTE', 'ENGENHEIRO')
    )
  );

create policy "Editors can update suppliers" on suppliers
  for update using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and role in ('ADM', 'GERENTE', 'ENGENHEIRO')
    )
  );

create policy "Editors can delete suppliers" on suppliers
  for delete using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and role in ('ADM', 'GERENTE', 'ENGENHEIRO')
    )
  );

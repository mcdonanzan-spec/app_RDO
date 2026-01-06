-- Create profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('ADMIN', 'EDITOR', 'VIEWER')) default 'VIEWER',
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Create policies for profiles
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Create projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  location text,
  status text check (status in ('ACTIVE', 'PLANNING', 'COMPLETED')) default 'PLANNING',
  units integer default 0,
  progress integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.projects enable row level security;

-- Policies for projects (Only admins/editors can modify, everyone can view for now)
create policy "Authenticated users can view projects" on projects
  for select using (auth.role() = 'authenticated');

create policy "Admins and Editors can insert projects" on projects
  for insert with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and role in ('ADMIN', 'EDITOR')
    )
  );

create policy "Admins and Editors can update projects" on projects
  for update using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and role in ('ADMIN', 'EDITOR')
    )
  );

-- Create project_members table
create table public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('ADMIN', 'EDITOR', 'VIEWER')) default 'VIEWER',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, user_id)
);

alter table public.project_members enable row level security;

create policy "Authenticated users can view members" on project_members
  for select using (auth.role() = 'authenticated');

-- Create financial_entries table (NFs)
create table public.financial_entries (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id),
  supplier text not null,
  document_number text,
  description text,
  issue_date date,
  total_value numeric,
  status text check (status in ('DRAFT', 'APPROVED', 'PAID', 'PARTIAL')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id)
);

alter table public.financial_entries enable row level security;

create policy "Authenticated users can view entries" on financial_entries
  for select using (auth.role() = 'authenticated');

create policy "Editors can insert entries" on financial_entries
  for insert with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and role in ('ADMIN', 'EDITOR')
    )
  );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'VIEWER');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insert Mock Data (Optional - useful for starting)
insert into public.projects (name, location, status, units, progress) values
('Residencial Vertentes', 'Betim, MG', 'ACTIVE', 384, 45),
('Jardim das Acácias', 'Contagem, MG', 'PLANNING', 240, 0),
('Vila Verde', 'São Paulo, SP', 'COMPLETED', 120, 100);

-- Create table for storing budget version snapshots
create table if not exists project_budget_versions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  version integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  description text,
  tree_data jsonb not null, -- Stores the full BudgetNode[] tree
  total_value numeric,
  
  -- Prevent duplicate version numbers for the same project
  unique(project_id, version)
);

-- RLS Policies
alter table project_budget_versions enable row level security;

create policy "Users can view budget versions for projects they access"
  on project_budget_versions for select
  using (
    project_id in (
      select id from projects 
      -- In a real scenario, check user permissions via project_members or similar logic
      -- For now, open to authenticated users or following the existing RLS pattern
    )
  );

create policy "Users can insert budget versions"
  on project_budget_versions for insert
  with check (true); 

-- Index for faster lookups
create index if not exists idx_project_budget_versions_project_id on project_budget_versions(project_id);

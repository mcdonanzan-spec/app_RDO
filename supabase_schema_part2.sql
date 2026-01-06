-- Financial Allocations
create table public.financial_allocations (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid references public.financial_entries(id) on delete cascade not null,
  budget_group_code text not null, -- Linking by code as per app logic
  cost_type text not null,
  value numeric not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.financial_allocations enable row level security;
create policy "Authenticated users can view allocations" on financial_allocations for select using (auth.role() = 'authenticated');
create policy "Editors can insert allocations" on financial_allocations for insert with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and role in ('ADMIN', 'EDITOR'))
);


-- Financial Installments
create table public.financial_installments (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid references public.financial_entries(id) on delete cascade not null,
  number integer not null,
  due_date date not null,
  value numeric not null,
  status text check (status in ('PENDING', 'PAID')) default 'PENDING',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.financial_installments enable row level security;
create policy "Authenticated users can view installments" on financial_installments for select using (auth.role() = 'authenticated');
create policy "Editors can insert installments" on financial_installments for insert with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and role in ('ADMIN', 'EDITOR'))
);


-- Budget Items (Hierarchical)
create table public.budget_items (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  code text not null,
  description text not null,
  level integer not null,
  type text check (type in ('GROUP', 'ITEM')) not null,
  item_type text, -- MT, LB, EQ, etc.
  parent_id uuid references public.budget_items(id),
  budget_initial numeric default 0,
  budget_current numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.budget_items enable row level security;
create policy "Authenticated users can view budget" on budget_items for select using (auth.role() = 'authenticated');
create policy "Editors can modify budget" on budget_items for insert with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and role in ('ADMIN', 'EDITOR'))
);


-- RDO Data
create table public.rdo_items (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  date date not null,
  code text not null,
  description text,
  accumulated_value numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.rdo_items enable row level security;
create policy "Authenticated users can view rdo" on rdo_items for select using (auth.role() = 'authenticated');

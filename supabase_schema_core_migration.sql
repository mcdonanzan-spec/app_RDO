-- ============================================
-- SUPABASE MIGRATION: Core Data (JSONB Storage)
-- ============================================

-- 1. RH PREMISES (Base 01)
CREATE TABLE public.project_rh_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb, -- Array of RHPremise
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.project_rh_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view rh" ON project_rh_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save rh" ON project_rh_data FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editors can update rh" ON project_rh_data FOR UPDATE USING (auth.role() = 'authenticated');

-- 2. CONTRACTS (Base 02)
CREATE TABLE public.project_contracts_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb, -- Array of ContractBox
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.project_contracts_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view contracts" ON project_contracts_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save contracts" ON project_contracts_data FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editors can update contracts" ON project_contracts_data FOR UPDATE USING (auth.role() = 'authenticated');

-- 3. SUPPLY ORDERS (Base 03)
CREATE TABLE public.project_supply_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb, -- Array of SupplyChainBox
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.project_supply_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view supply" ON project_supply_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save supply" ON project_supply_data FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editors can update supply" ON project_supply_data FOR UPDATE USING (auth.role() = 'authenticated');

-- 4. BUDGET DATA (Orçamento)
CREATE TABLE public.project_budget_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb, -- Array of Budget Items (Flat or Tree)
  sheets_data jsonb default '[]'::jsonb, -- Raw sheets info if needed
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.project_budget_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view budget_data" ON project_budget_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save budget_data" ON project_budget_data FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editors can update budget_data" ON project_budget_data FOR UPDATE USING (auth.role() = 'authenticated');

-- 5. RDO DATA (Realizado)
CREATE TABLE public.project_rdo_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb, -- Array of RDO Items
  sheets_data jsonb default '[]'::jsonb,
  cost_summary jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.project_rdo_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view rdo_data" ON project_rdo_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save rdo_data" ON project_rdo_data FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editors can update rdo_data" ON project_rdo_data FOR UPDATE USING (auth.role() = 'authenticated');

-- 6. MASTER PLAN (Cronograma)
CREATE TABLE public.project_master_plan_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb, -- Array of Sheets
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.project_master_plan_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view master_plan" ON project_master_plan_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save master_plan" ON project_master_plan_data FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editors can update master_plan" ON project_master_plan_data FOR UPDATE USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_rh_project ON project_rh_data(project_id);
CREATE INDEX idx_contracts_project ON project_contracts_data(project_id);
CREATE INDEX idx_supply_project ON project_supply_data(project_id);
CREATE INDEX idx_budget_project ON project_budget_data(project_id);
CREATE INDEX idx_rdo_project ON project_rdo_data(project_id);
CREATE INDEX idx_master_plan_project ON project_master_plan_data(project_id);

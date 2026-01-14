-- ==============================================================================
-- MIGRACAO_TOTAL.sql
-- Script consolidado para configurar o banco de dados Supabase do zero.
-- Executar este script no SQL Editor do Supabase.
-- ==============================================================================

-- =========================================
-- 1. BASE SCHEMA (Profiles, Projects)
-- =========================================

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('ADMIN', 'EDITOR', 'VIEWER')) default 'VIEWER',
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  location text,
  status text check (status in ('ACTIVE', 'PLANNING', 'COMPLETED')) default 'PLANNING',
  units integer default 0,
  progress integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create project_members table
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('ADMIN', 'EDITOR', 'VIEWER')) default 'VIEWER',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Create financial_entries table (NFs)
CREATE TABLE IF NOT EXISTS public.financial_entries (
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

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'VIEWER');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================
-- 2. RBAC POLICIES (Overrides Base)
-- =========================================

-- PROJECT MEMBERS POLICIES
DROP POLICY IF EXISTS "Users can view their own memberships" ON project_members;
CREATE POLICY "Users can view their own memberships" ON project_members FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Global Admins and Project Admins can manage members" ON project_members;
CREATE POLICY "Global Admins and Project Admins can manage members" ON project_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
        OR
        EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role = 'ADMIN')
    );

-- PROJECTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can view projects" ON projects; -- Drop old one
DROP POLICY IF EXISTS "Users can view assigned projects" ON projects;
CREATE POLICY "Users can view assigned projects" ON projects
   FOR SELECT USING (
       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
       OR
       EXISTS (SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = auth.uid())
   );

DROP POLICY IF EXISTS "Admins and Editors can insert projects" ON projects; -- Drop old
DROP POLICY IF EXISTS "Global Admins can insert projects" ON projects;
CREATE POLICY "Global Admins can insert projects" ON projects
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Admins and Editors can update projects" ON projects; -- Drop old
DROP POLICY IF EXISTS "Admins and Managers can update projects" ON projects;
CREATE POLICY "Admins and Managers can update projects" ON projects
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
        OR
        EXISTS (SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
    );

DROP POLICY IF EXISTS "Global Admins can delete projects" ON projects;
CREATE POLICY "Global Admins can delete projects" ON projects
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- FINANCIAL ENTRIES POLICIES
DROP POLICY IF EXISTS "Authenticated users can view entries" ON financial_entries;
CREATE POLICY "Authenticated users can view entries" ON financial_entries FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Editors can insert entries" ON financial_entries;
CREATE POLICY "Editors can insert entries" ON financial_entries FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
);

-- =========================================
-- 3. FINANCIAL DETAILS (Part 2)
-- =========================================

-- Financial Allocations
CREATE TABLE IF NOT EXISTS public.financial_allocations (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid references public.financial_entries(id) on delete cascade not null,
  budget_group_code text not null,
  cost_type text not null,
  value numeric not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.financial_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view allocations" ON financial_allocations;
CREATE POLICY "Authenticated users can view allocations" ON financial_allocations FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Editors can insert allocations" ON financial_allocations;
CREATE POLICY "Editors can insert allocations" ON financial_allocations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
);

-- Financial Installments
CREATE TABLE IF NOT EXISTS public.financial_installments (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid references public.financial_entries(id) on delete cascade not null,
  number integer not null,
  due_date date not null,
  value numeric not null,
  status text check (status in ('PENDING', 'PAID')) default 'PENDING',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.financial_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view installments" ON financial_installments;
CREATE POLICY "Authenticated users can view installments" ON financial_installments FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Editors can insert installments" ON financial_installments;
CREATE POLICY "Editors can insert installments" ON financial_installments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
);

-- Budget Items (Relational fallback)
CREATE TABLE IF NOT EXISTS public.budget_items (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  code text not null,
  description text not null,
  level integer not null,
  type text check (type in ('GROUP', 'ITEM')) not null,
  item_type text,
  parent_id uuid references public.budget_items(id),
  budget_initial numeric default 0,
  budget_current numeric default 0,
  cost_center text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view budget" ON budget_items;
CREATE POLICY "Authenticated users can view budget" ON budget_items FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Editors can modify budget" ON budget_items;
CREATE POLICY "Editors can modify budget" ON budget_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
);

-- RDO Items (Relational fallback)
CREATE TABLE IF NOT EXISTS public.rdo_items (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  date date not null,
  code text not null,
  description text,
  accumulated_value numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.rdo_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view rdo" ON rdo_items;
CREATE POLICY "Authenticated users can view rdo" ON rdo_items FOR SELECT USING (auth.role() = 'authenticated');

-- =========================================
-- 4. CORE DATA CONTAINERS (JSONB)
-- =========================================

-- RH PREMISES
CREATE TABLE IF NOT EXISTS public.project_rh_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.project_rh_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view rh" ON project_rh_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save rh" ON project_rh_data FOR ALL USING (auth.role() = 'authenticated');

-- CONTRACTS
CREATE TABLE IF NOT EXISTS public.project_contracts_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.project_contracts_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view contracts" ON project_contracts_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save contracts" ON project_contracts_data FOR ALL USING (auth.role() = 'authenticated');

-- SUPPLY DATA
CREATE TABLE IF NOT EXISTS public.project_supply_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.project_supply_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view supply" ON project_supply_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save supply" ON project_supply_data FOR ALL USING (auth.role() = 'authenticated');

-- BUDGET DATA
CREATE TABLE IF NOT EXISTS public.project_budget_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb,
  sheets_data jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.project_budget_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view budget_data" ON project_budget_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save budget_data" ON project_budget_data FOR ALL USING (auth.role() = 'authenticated');

-- RDO DATA
CREATE TABLE IF NOT EXISTS public.project_rdo_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb,
  sheets_data jsonb default '[]'::jsonb,
  cost_summary jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.project_rdo_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view rdo_data" ON project_rdo_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save rdo_data" ON project_rdo_data FOR ALL USING (auth.role() = 'authenticated');

-- MASTER PLAN
CREATE TABLE IF NOT EXISTS public.project_master_plan_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  data jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.project_master_plan_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view master_plan" ON project_master_plan_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save master_plan" ON project_master_plan_data FOR ALL USING (auth.role() = 'authenticated');

-- =========================================
-- 5. EXTENSIONS & MODULES
-- =========================================

-- DISBURSEMENT FORECAST
CREATE TABLE IF NOT EXISTS public.project_disbursement_forecast (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  forecast_data jsonb default '{}'::jsonb,
  starting_month text,
  budget_overrides jsonb default '{}'::jsonb,
  description_overrides jsonb default '{}'::jsonb,
  projection_length integer default 12,
  initial_realized jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id)
);
ALTER TABLE public.project_disbursement_forecast ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view forecast" ON project_disbursement_forecast FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save forecast" ON project_disbursement_forecast FOR ALL USING (auth.role() = 'authenticated');

-- CASH FLOW DATA
CREATE TABLE IF NOT EXISTS public.project_cash_flow_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  commitments jsonb default '{}'::jsonb,
  closed_month text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id)
);
ALTER TABLE public.project_cash_flow_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view cash flow" ON project_cash_flow_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can save cash flow" ON project_cash_flow_data FOR ALL USING (auth.role() = 'authenticated');

-- STRATEGY SNAPSHOTS
CREATE TABLE IF NOT EXISTS public.project_strategy_snapshots (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  description text not null,
  data jsonb not null,
  created_by uuid references auth.users(id)
);
ALTER TABLE public.project_strategy_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view snapshots" ON project_strategy_snapshots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can create snapshots" ON project_strategy_snapshots FOR ALL USING (auth.role() = 'authenticated');

-- STRATEGY COLORS
CREATE TABLE IF NOT EXISTS public.project_strategy_colors (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  colors jsonb not null default '{"standard": "#10b981", "realized": "#3b82f6", "projected": "#f59e0b"}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.project_strategy_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view colors" ON project_strategy_colors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can manage colors" ON project_strategy_colors FOR ALL USING (auth.role() = 'authenticated');

-- AI ANALYSES
CREATE TABLE IF NOT EXISTS public.project_ai_analyses (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  query text not null,
  response jsonb not null,
  created_by uuid references auth.users(id)
);
ALTER TABLE public.project_ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view AI analyses" ON project_ai_analyses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can create AI analyses" ON project_ai_analyses FOR ALL USING (auth.role() = 'authenticated');

-- VISUAL MANAGEMENT
CREATE TABLE IF NOT EXISTS public.project_visual_management (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id),
  unique(project_id)
);
ALTER TABLE public.project_visual_management ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view visual management" ON project_visual_management FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can insert/update visual management" ON project_visual_management FOR ALL USING (auth.role() = 'authenticated');

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  razao_social text not null,
  cnpj text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id),
  unique(project_id, cnpj)
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view suppliers" ON suppliers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can insert suppliers" ON suppliers FOR ALL USING (auth.role() = 'authenticated');

-- =========================================
-- 6. PURCHASE FLOW (New)
-- =========================================

-- Create table for TOTVS Items (Catalog)
CREATE TABLE IF NOT EXISTS project_item_catalog (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for Purchase Requests
CREATE TABLE IF NOT EXISTS project_purchase_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL, -- "REQ-1234"
    description TEXT NOT NULL,
    requester TEXT,
    priority TEXT,
    status TEXT,
    date TIMESTAMP WITH TIME ZONE,
    items JSONB, -- Store items as JSON for flexibility
    history JSONB, -- Store history logs
    budget_group_code TEXT,
    totvs_order_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_catalog_project ON project_item_catalog(project_id);
CREATE INDEX IF NOT EXISTS idx_requests_project ON project_purchase_requests(project_id);

-- Add RLS Policies
ALTER TABLE project_item_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to authenticad users 1" ON project_item_catalog FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticad users 2" ON project_purchase_requests FOR ALL USING (auth.role() = 'authenticated');


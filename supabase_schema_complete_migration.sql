-- ============================================
-- SUPABASE MIGRATION: All Remaining Tables
-- ============================================

-- 1. DISBURSEMENT FORECAST (Previsão de Desembolso)
-- Stores monthly forecast data, budget overrides, and projection settings
CREATE TABLE public.project_disbursement_forecast (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  forecast_data jsonb default '{}'::jsonb, -- Monthly forecast values by budget code
  starting_month text, -- Format: 'YYYY-MM'
  budget_overrides jsonb default '{}'::jsonb, -- Manual budget corrections
  description_overrides jsonb default '{}'::jsonb, -- Description customizations
  projection_length integer default 12, -- Number of months to project
  initial_realized jsonb default '{}'::jsonb, -- Initial realized values
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id)
);

ALTER TABLE public.project_disbursement_forecast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view forecast" ON project_disbursement_forecast
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Editors can insert/update forecast" ON project_disbursement_forecast
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
  );

CREATE POLICY "Editors can update forecast" ON project_disbursement_forecast
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
  );

-- 2. CASH FLOW DATA (Fluxo de Caixa Analítico)
-- Stores commitment values and closed month marker
CREATE TABLE public.project_cash_flow_data (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  commitments jsonb default '{}'::jsonb, -- Commitment values by budget code
  closed_month text, -- Format: 'YYYY-MM' - last closed accounting month
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id)
);

ALTER TABLE public.project_cash_flow_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cash flow" ON project_cash_flow_data
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Editors can insert/update cash flow" ON project_cash_flow_data
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
  );

CREATE POLICY "Editors can update cash flow" ON project_cash_flow_data
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
  );

-- 3. STRATEGY SNAPSHOTS (Estratégia & BI - Curva S)
-- Stores saved S-curve states for comparison
CREATE TABLE public.project_strategy_snapshots (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  description text not null,
  data jsonb not null, -- Snapshot data (months, curves, totals, POC)
  created_by uuid references auth.users(id)
);

ALTER TABLE public.project_strategy_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view snapshots" ON project_strategy_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Editors can create snapshots" ON project_strategy_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
  );

-- 4. STRATEGY COLORS (Custom colors for S-curve)
-- Store custom colors for different curves
CREATE TABLE public.project_strategy_colors (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  colors jsonb not null default '{"standard": "#10b981", "realized": "#3b82f6", "projected": "#f59e0b"}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.project_strategy_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view colors" ON project_strategy_colors
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Editors can manage colors" ON project_strategy_colors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('ADMIN', 'EDITOR'))
  );

-- 5. AI ANALYSES (IA Generativa - Histórico)
-- Stores AI conversation history (queries and responses)
CREATE TABLE public.project_ai_analyses (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  query text not null,
  response jsonb not null, -- AI response with analysis, KPIs, charts
  created_by uuid references auth.users(id)
);

ALTER TABLE public.project_ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI analyses" ON project_ai_analyses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create AI analyses" ON project_ai_analyses
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX idx_disbursement_forecast_project ON project_disbursement_forecast(project_id);
CREATE INDEX idx_cash_flow_project ON project_cash_flow_data(project_id);
CREATE INDEX idx_strategy_snapshots_project ON project_strategy_snapshots(project_id);
CREATE INDEX idx_strategy_snapshots_date ON project_strategy_snapshots(date DESC);
CREATE INDEX idx_strategy_colors_project ON project_strategy_colors(project_id);
CREATE INDEX idx_ai_analyses_project ON project_ai_analyses(project_id);
CREATE INDEX idx_ai_analyses_date ON project_ai_analyses(date DESC);

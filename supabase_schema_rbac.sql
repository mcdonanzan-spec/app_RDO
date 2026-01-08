-- ============================================
-- SUPABASE MIGRATION: Role Based Access Control (RBAC)
-- ============================================

-- 1. PROJECT MEMBERS TABLE
-- Links Users (Profiles) to Projects with a specific role
CREATE TABLE IF NOT EXISTS public.project_members (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    role text not null check (role in ('ADMIN', 'MANAGER', 'EDITOR', 'VIEWER')),
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Ensure unique user per project
    unique(project_id, user_id)
);

-- Enable RLS (Safe to run multiple times, idempotent operation)
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 2. POLICIES FOR PROJECT MEMBERS

-- Users can see which projects they are members of
DROP POLICY IF EXISTS "Users can view their own memberships" ON project_members;
CREATE POLICY "Users can view their own memberships" ON project_members
    FOR SELECT USING (auth.uid() = user_id);

-- Admins (Global) or Project Admins can manage members
DROP POLICY IF EXISTS "Global Admins and Project Admins can manage members" ON project_members;
CREATE POLICY "Global Admins and Project Admins can manage members" ON project_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN') -- Global Admin
        OR
        EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role = 'ADMIN') -- Project Admin
    );

-- 3. UPDATE PROJECTS RLS
-- We need to update the 'projects' table policy to respect memberships
DROP POLICY IF EXISTS "Users can view assigned projects" ON projects;
CREATE POLICY "Users can view assigned projects" ON projects
   FOR SELECT USING (
       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN') -- Global Admin sees all
       OR
       EXISTS (SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = auth.uid()) -- Member sees assigned
   );

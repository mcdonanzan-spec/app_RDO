-- ============================================
-- SUPABASE MIGRATION: Role Based Access Control (RBAC) - v2 fixes
-- ============================================

-- 1. PROJECT MEMBERS TABLE (Structure)
CREATE TABLE IF NOT EXISTS public.project_members (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    role text not null check (role in ('ADMIN', 'MANAGER', 'EDITOR', 'VIEWER')),
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 2. POLICIES FOR PROJECT MEMBERS (Review)
DROP POLICY IF EXISTS "Users can view their own memberships" ON project_members;
CREATE POLICY "Users can view their own memberships" ON project_members
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Global Admins and Project Admins can manage members" ON project_members;
CREATE POLICY "Global Admins and Project Admins can manage members" ON project_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
        OR
        EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role = 'ADMIN')
    );

-- 3. PROJECTS TABLE POLICIES (Fixing Insert/Update/Delete)

-- Ensure RLS is enabled on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3.1 VIEW: Global Admins see all, Members see assigned
DROP POLICY IF EXISTS "Users can view assigned projects" ON projects;
CREATE POLICY "Users can view assigned projects" ON projects
   FOR SELECT USING (
       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
       OR
       EXISTS (SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = auth.uid())
   );

-- 3.2 INSERT: Only Global Admins can create new projects
DROP POLICY IF EXISTS "Global Admins can insert projects" ON projects;
CREATE POLICY "Global Admins can insert projects" ON projects
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 3.3 UPDATE: Global Admins OR Project Admins/Managers can update
DROP POLICY IF EXISTS "Admins and Managers can update projects" ON projects;
CREATE POLICY "Admins and Managers can update projects" ON projects
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
        OR
        EXISTS (SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = auth.uid() AND role IN ('ADMIN', 'MANAGER'))
    );

-- 3.4 DELETE: Only Global Admins can delete projects
DROP POLICY IF EXISTS "Global Admins can delete projects" ON projects;
CREATE POLICY "Global Admins can delete projects" ON projects
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- ============================================
-- FIX: INFINITE RECURSION IN RLS POLICIES
-- ============================================

-- The previous policy for 'project_members' caused infinite recursion because
-- it tried to query 'project_members' to determine permission for 'project_members'.

-- 1. Reset policies on project_members
DROP POLICY IF EXISTS "Global Admins and Project Admins can manage members" ON project_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON project_members;

-- 2. Simple, non-recursive policy for users to see their own membership
-- This is critical for the 'projects' table policy to work without recursion.
CREATE POLICY "Users can view own project membership" ON project_members
    FOR SELECT USING (auth.uid() = user_id);

-- 3. Policy for Global Admins to manage ALL memberships
-- We verify against 'profiles' table, avoiding recursion on 'project_members'.
CREATE POLICY "Global Admins can manage all project members" ON project_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

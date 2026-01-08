-- ============================================
-- FIX: PROFILES RLS POLICY
-- ============================================

-- If the 'projects' policy checks the 'profiles' table, the user MUST have permission
-- to SELECT from the 'profiles' table. If RLS is enabled on 'profiles' but no policy
-- exists (or it's too restrictive), the check inside 'projects' will fail silently
-- (treating the user as non-admin).

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Allow everyone to read profiles (needed for authentication checks and team displays)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

-- 2. Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 3. (Optional) Ensure there is at least one admin if looking for 'ADMIN'
-- This query sets the currently executing user as ADMIN.
-- Run this if you are the developer.
UPDATE public.profiles
SET role = 'ADMIN'
WHERE id = auth.uid();

-- ========================================
-- MyScheduler v2.2 - Allow Anon Profiles View
-- Allow public (anon/authenticated) to search and view profiles.
-- This is necessary to support password recovery searches by name for unauthenticated visitors.
-- ========================================

-- Drop the previous policy restricting select to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create a new policy allowing both authenticated and anonymous users to view profiles
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
USING (true);

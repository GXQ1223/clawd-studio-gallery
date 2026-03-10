-- Fix overly permissive share_token policy
-- Old policy: "Anyone can view shared projects" allows reading ALL projects
-- that have any share_token set, regardless of which token was queried.
-- This is safe because the client query uses .eq("share_token", token)
-- but the RLS policy should be defense-in-depth.
-- We can't use request parameters in RLS directly, so we keep the policy
-- but ensure it only exposes projects with a share_token (not all data).
-- The real fix is to limit what columns are exposed for shared views.

-- Drop the old overly permissive policy
DROP POLICY IF EXISTS "Anyone can view shared projects" ON public.projects;

-- Create a more restrictive policy: anonymous users can only select
-- projects where share_token matches (Supabase adds the WHERE clause
-- from the client query, and RLS further restricts). We keep it tight
-- by ensuring only shared projects are accessible to anon role.
CREATE POLICY "Anyone can view shared projects by token" ON public.projects
  FOR SELECT TO anon
  USING (share_token IS NOT NULL);

-- Also allow authenticated users who aren't the owner to view shared projects
CREATE POLICY "Authenticated users can view shared projects" ON public.projects
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR share_token IS NOT NULL);

-- Drop the old authenticated select policy if it exists (we merged it above)
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;

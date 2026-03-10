-- Add index on projects.user_id for faster RLS policy checks
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

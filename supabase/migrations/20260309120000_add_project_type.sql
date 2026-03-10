-- Add project_type column to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text NOT NULL DEFAULT 'interior';

-- Add a comment for documentation
COMMENT ON COLUMN public.projects.project_type IS 'Design discipline: interior, architecture, landscape, industrial';

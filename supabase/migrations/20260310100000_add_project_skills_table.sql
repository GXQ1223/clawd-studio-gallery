-- Project skills: per-project feature toggles and configuration
CREATE TABLE public.project_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  skill_slug TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT project_skills_project_id_skill_slug_key UNIQUE (project_id, skill_slug)
);

-- Index for lookups by project
CREATE INDEX idx_project_skills_project_id ON public.project_skills (project_id);

-- Enable RLS
ALTER TABLE public.project_skills ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage skills on their own projects
CREATE POLICY "Users can read skills for own projects" ON public.project_skills
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_skills.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add skills to own projects" ON public.project_skills
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_skills.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update skills on own projects" ON public.project_skills
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_skills.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_skills.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete skills on own projects" ON public.project_skills
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_skills.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Add wall_layout JSONB column to persist wall asset positions
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS wall_layout jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.projects.wall_layout IS 'Stores wall view asset positions: { assetId: { x, y, rotation } }';

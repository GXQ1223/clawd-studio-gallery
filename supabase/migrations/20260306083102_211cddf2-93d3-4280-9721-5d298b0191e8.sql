ALTER TABLE public.agent_sessions 
  ADD COLUMN cron_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN cron_interval text DEFAULT null,
  ADD COLUMN last_cron_run timestamp with time zone DEFAULT null;
-- Enable pg_cron and pg_net extensions (Supabase supports these natively)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule agent-cron to run every hour.
-- The edge function checks each session's individual cron_interval
-- (hourly, 6h, daily) and only processes sessions whose interval has elapsed.
select cron.schedule(
  'agent-cron-hourly',
  '0 * * * *',  -- every hour at :00
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url') || '/functions/v1/agent-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}',
    timeout_milliseconds := 30000
  );
  $$
);

-- NOTE: Before running this migration, store secrets in Supabase Vault:
--   select vault.create_secret('https://YOUR_PROJECT.supabase.co', 'supabase_url');
--   select vault.create_secret('YOUR_CRON_SECRET', 'cron_secret');

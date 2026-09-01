-- ============================================================================
-- Workspace multi-tenancy: Phase 4b — schedule the daily lifecycle sweep
--
-- BEFORE running this file, run the following once in the SQL editor,
-- filling in your own service role key (Project Settings > API > service_role,
-- the "secret" one, not "anon"). Do NOT put the real key in this file or
-- anywhere in the repo — Vault stores it encrypted, and the cron job below
-- reads it back out by name rather than a literal value:
--
--   select vault.create_secret('PASTE_YOUR_SERVICE_ROLE_KEY_HERE', 'service_role_key');
--
-- ============================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'workspace-lifecycle-sweep-daily',
  '0 3 * * *', -- 3:00 AM UTC, once a day
  $$
  select net.http_post(
    url := 'https://plsgtuwbrvgbvzlrruqe.supabase.co/functions/v1/workspace-lifecycle-sweep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'x-cron-secret', '68500e540a484bdb45802aeed3e6b014e5e8915e3d13da82'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

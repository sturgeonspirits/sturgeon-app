-- v1.1 — updated 2026-04-25
-- changes: Hardcoded production URL (https://club.sturgeonspirits.com).
--          v1.0 — Initial Supabase pg_cron + pg_net setup for daily menu sync.
--                 Replaces the broken Netlify scheduled function.

-- ============================================================================
-- One-time setup: schedule the daily menu sync via Supabase pg_cron + pg_net.
--
-- WHAT THIS DOES:
--   Every day at 08:00 UTC (= 3 AM CDT / 2 AM CST), Supabase will POST to the
--   app's /api/sync-menu endpoint with the x-cron-secret header. Same code path
--   as the manual "Sync menu" button in the staff console — no app changes.
--
-- WHERE TO RUN:
--   Supabase Dashboard → SQL Editor → paste each section below, replace the
--   one placeholder <YOUR_CRON_SECRET> with the value of CRON_SECRET from
--   Netlify env vars, then run each section.
--
-- NOTE ON SECURITY:
--   The CRON_SECRET is embedded in the cron command below. Only Supabase
--   project owners/admins can read pg_cron job definitions, so this is roughly
--   equivalent to storing it in env vars — but if you want extra hardening,
--   migrate to Supabase Vault later (see "OPTIONAL: Vault hardening" at end).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SECTION 1: Enable extensions (idempotent — safe to re-run)
-- ----------------------------------------------------------------------------

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;


-- ----------------------------------------------------------------------------
-- SECTION 2: Remove any prior schedule with the same name (idempotent)
-- ----------------------------------------------------------------------------

select cron.unschedule('daily-menu-sync')
where exists (select 1 from cron.job where jobname = 'daily-menu-sync');


-- ----------------------------------------------------------------------------
-- SECTION 3: Schedule the daily sync
--
--   BEFORE RUNNING, replace the placeholder:
--     <YOUR_CRON_SECRET> → the value of CRON_SECRET in Netlify env vars
--   The production URL (https://club.sturgeonspirits.com) is already hardcoded.
--
--   Schedule: 0 8 * * *  → 08:00 UTC daily
--                       → 3 AM CDT (Mar–Nov) / 2 AM CST (Nov–Mar)
-- ----------------------------------------------------------------------------

select cron.schedule(
  'daily-menu-sync',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://club.sturgeonspirits.com/api/sync-menu',
    headers := '{"x-cron-secret": "cd492166968b357cd60464879e759e6253f57f6f66533e8a6824cc6bad5a4800", "Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);


-- ============================================================================
-- VERIFICATION (run after Section 3 completes)
-- ============================================================================

-- A. Confirm the job is registered
select jobid, jobname, schedule, active, command
from cron.job
where jobname = 'daily-menu-sync';

-- B. Force a one-shot run RIGHT NOW for verification (don't wait until 3 AM):
--    This calls the same net.http_post the cron will run. It returns a
--    request_id; use it in step C to fetch the response.
select net.http_post(
  url     := 'https://club.sturgeonspirits.com/api/sync-menu',
  headers := '{"x-cron-secret": "cd492166968b357cd60464879e759e6253f57f6f66533e8a6824cc6bad5a4800", "Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds := 30000
) as request_id;

-- C. Inspect the response (run a few seconds after step B)
select id, status_code, content_type, content
from net._http_response
order by created desc
limit 5;
--   Expected: status_code = 200 and content like '{"success":true,"synced":...}'

-- D. After the first scheduled run (next 08:00 UTC), check execution history:
select runid, jobid, start_time, end_time, status, return_message
from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'daily-menu-sync')
order by start_time desc
limit 10;


-- ============================================================================
-- TEARDOWN (only if you want to remove the schedule later)
-- ============================================================================

-- select cron.unschedule('daily-menu-sync');


-- ============================================================================
-- OPTIONAL: Vault hardening (do this anytime after the basic setup works)
-- ============================================================================
--
-- If you'd rather not embed the secret in the cron command, store it in the
-- Supabase Vault and reference it. Steps:
--
-- 1. Store the secret:
--      select vault.create_secret(
--        '<YOUR_CRON_SECRET>',
--        'cron_secret',
--        'Cron secret for /api/sync-menu'
--      );
--
-- 2. Re-schedule using the vault reference:
--      select cron.unschedule('daily-menu-sync');
--      select cron.schedule(
--        'daily-menu-sync',
--        '0 8 * * *',
--        $$
--        select net.http_post(
--          url     := 'https://club.sturgeonspirits.com/api/sync-menu',
--          headers := jsonb_build_object(
--            'Content-Type', 'application/json',
--            'x-cron-secret', (
--              select decrypted_secret
--              from vault.decrypted_secrets
--              where name = 'cron_secret'
--            )
--          ),
--          timeout_milliseconds := 30000
--        );
--        $$
--      );

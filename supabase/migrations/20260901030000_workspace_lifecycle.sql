-- ============================================================================
-- Workspace multi-tenancy: Phase 4a — recovery review + lifecycle tracking
--
-- Design note on "permanent" deletion: after the 7-day soft-delete window,
-- this marks a workspace `purged_at` rather than actually dropping its data.
-- A scheduled sweep (Edge Function, wired up separately) sets that flag, but
-- nothing ever runs a destructive DELETE automatically. That's deliberate —
-- an unattended cron job permanently destroying real project data with zero
-- human review is a real risk, and it directly contradicts item 7's promise
-- that a platform admin has "central authority to give it back." A purged
-- workspace is invisible and unusable to its former members (deleted_at
-- already excludes it from current_workspace_id() everywhere), but a
-- platform admin can still restore it in full via approve_recovery_request()
-- below, because the data was never actually destroyed.
-- ============================================================================

alter table public.workspaces add column if not exists purged_at timestamptz;

-- ---- Platform admin: approve a recovery request, restoring the workspace --
create or replace function public.approve_recovery_request(_request_id uuid, _reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_code text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can decide on recovery requests';
  end if;

  select workspace_code into ws_code from public.workspace_recovery_requests where id = _request_id;
  if ws_code is null then
    raise exception 'Recovery request not found';
  end if;

  update public.workspaces
  set deleted_at = null, hard_delete_at = null, purged_at = null, deletion_requested_by = null,
      last_active_at = now(), warnings_sent = 0, last_warning_sent_at = null
  where code = ws_code;

  if not found then
    raise exception 'No workspace with code % exists to restore', ws_code;
  end if;

  update public.workspace_recovery_requests
  set status = 'approved', admin_reply = _reply, reviewed_by = auth.uid(), reviewed_at = now()
  where id = _request_id;
end;
$$;

-- ---- Platform admin: reject a recovery request with a reply --------------
create or replace function public.reject_recovery_request(_request_id uuid, _reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can decide on recovery requests';
  end if;

  update public.workspace_recovery_requests
  set status = 'rejected', admin_reply = _reply, reviewed_by = auth.uid(), reviewed_at = now()
  where id = _request_id;

  if not found then
    raise exception 'Recovery request not found';
  end if;
end;
$$;

-- ---- Platform-wide stats for the super-admin dashboard ---------------------
-- A single RPC rather than raw client queries, so the counting logic (and
-- the is_platform_admin() gate) lives in one auditable place.
create or replace function public.platform_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can view platform stats';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'total_workspaces', (select count(*) from public.workspaces where deleted_at is null),
    'deleted_workspaces', (select count(*) from public.workspaces where deleted_at is not null and purged_at is null),
    'purged_workspaces', (select count(*) from public.workspaces where purged_at is not null),
    'pending_recovery_requests', (select count(*) from public.workspace_recovery_requests where status = 'pending'),
    'workspaces_created_last_30_days', (select count(*) from public.workspaces where created_at >= now() - interval '30 days')
  ) into result;

  return result;
end;
$$;

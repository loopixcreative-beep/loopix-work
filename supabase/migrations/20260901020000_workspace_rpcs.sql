-- ============================================================================
-- Workspace multi-tenancy: Phase 3a — create/join/delete RPCs
--
-- workspace_members has no INSERT policy by design (Phase 1) — membership
-- changes go through these SECURITY DEFINER functions instead of a raw
-- client insert, so the invariants (one workspace per user, code lookup,
-- role assignment) are enforced in one place.
-- ============================================================================

-- current_workspace_id() previously ignored soft-deletion — a member of a
-- deleted workspace would still pass every "workspace_id = current_workspace_id()"
-- check across the whole schema. Fixing it here cascades the lockout through
-- every policy that already depends on it, with no other policy needing to
-- change.
create or replace function public.current_workspace_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select wm.workspace_id
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.user_id = auth.uid() and w.deleted_at is null
  limit 1;
$$;

-- ---- Create a new workspace; caller becomes its superadmin ----------------
create or replace function public.create_workspace(_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.workspace_members where user_id = auth.uid()) then
    raise exception 'You already belong to a workspace';
  end if;
  if btrim(coalesce(_name, '')) = '' then
    raise exception 'Workspace name is required';
  end if;

  new_code := public.generate_workspace_code();

  insert into public.workspaces (name, code, created_by)
  values (btrim(_name), new_code, auth.uid())
  returning id into new_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_id, auth.uid(), 'superadmin');

  update public.profiles set workspace_id = new_id where user_id = auth.uid();

  return new_id;
end;
$$;

-- ---- Join an existing workspace by its 6-character code -------------------
create or replace function public.join_workspace(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.workspace_members where user_id = auth.uid()) then
    raise exception 'You already belong to a workspace';
  end if;

  select id into target_id
  from public.workspaces
  where code = upper(btrim(_code)) and deleted_at is null;

  if target_id is null then
    raise exception 'That workspace code is invalid, or the workspace has been deleted';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_id, auth.uid(), 'employee');

  update public.profiles set workspace_id = target_id where user_id = auth.uid();

  return target_id;
end;
$$;

-- ---- Soft-delete the caller's own workspace (superadmin only) -------------
-- The frontend re-verifies the caller's password via a fresh
-- supabase.auth.signInWithPassword() call and requires typing
-- "DELETE MY WORKSPACE" before ever calling this — this function itself only
-- re-checks that the caller is still the workspace's superadmin.
create or replace function public.delete_workspace()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  ws_id := public.current_workspace_id();
  if ws_id is null then
    raise exception 'You do not belong to an active workspace';
  end if;
  if not public.has_workspace_role(ws_id, 'superadmin') then
    raise exception 'Only the superadmin can delete the workspace';
  end if;

  update public.workspaces
  set deleted_at = now(),
      hard_delete_at = now() + interval '7 days',
      deletion_requested_by = auth.uid()
  where id = ws_id;
end;
$$;

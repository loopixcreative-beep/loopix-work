-- ============================================================================
-- Workspace multi-tenancy: Phase 2 — retrofit existing tables
--
-- Backfills every existing row into the KAAM77 workspace (the only tenant
-- that existed before Phase 1), then replaces every "auth.uid() IS NOT NULL"
-- / bare-true policy across the schema with a workspace-scoped equivalent.
-- Old permissive policies are DROPPED, not just supplemented — Postgres ORs
-- all permissive policies together for the same command, so leaving an old
-- one in place would silently defeat a stricter new one.
--
-- Requires Phase 1 (20260901000000_workspace_multitenancy_foundation.sql)
-- to already be applied.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'current_workspace_id') then
    raise exception 'Phase 1 migration not found — run 20260901000000_workspace_multitenancy_foundation.sql first';
  end if;
end $$;

-- ---- 1. Add workspace_id to tables with no reliable parent join ----------
-- (issues/sprints/comments/etc. all inherit scoping via a join to projects
-- instead — no new column needed there.)
alter table public.profiles add column workspace_id uuid references public.workspaces(id);
alter table public.projects add column workspace_id uuid references public.workspaces(id);
alter table public.work_sessions add column workspace_id uuid references public.workspaces(id);
alter table public.announcement_messages add column workspace_id uuid references public.workspaces(id);
alter table public.media_library add column workspace_id uuid references public.workspaces(id);

-- ---- 2. Backfill: everything that exists today belongs to KAAM77 ---------
do $$
declare
  kaam77_id uuid;
begin
  select id into kaam77_id from public.workspaces where code = 'KAAM77';
  if kaam77_id is null then
    raise exception 'KAAM77 workspace not found — run the Phase 1 seed first';
  end if;

  update public.profiles set workspace_id = kaam77_id where workspace_id is null;
  update public.projects set workspace_id = kaam77_id where workspace_id is null;
  update public.work_sessions set workspace_id = kaam77_id where workspace_id is null;
  update public.announcement_messages set workspace_id = kaam77_id where workspace_id is null;
  update public.media_library set workspace_id = kaam77_id where workspace_id is null;
end $$;

-- ---- 3. Lock it down: not null + auto-default for future inserts ---------
-- profiles.workspace_id is deliberately left NULLABLE: handle_new_user()
-- creates a profile the instant someone signs up, before they've chosen to
-- create or join a workspace (that's a separate later step) — at that
-- moment current_workspace_id() has nothing to return yet. A profile with a
-- null workspace_id means "signed up, hasn't joined/created a workspace".
alter table public.projects alter column workspace_id set not null;
alter table public.work_sessions alter column workspace_id set not null;
alter table public.announcement_messages alter column workspace_id set not null;
alter table public.media_library alter column workspace_id set not null;

alter table public.profiles alter column workspace_id set default public.current_workspace_id();
alter table public.projects alter column workspace_id set default public.current_workspace_id();
alter table public.work_sessions alter column workspace_id set default public.current_workspace_id();
alter table public.announcement_messages alter column workspace_id set default public.current_workspace_id();
alter table public.media_library alter column workspace_id set default public.current_workspace_id();

create index if not exists profiles_workspace_id_idx on public.profiles (workspace_id);
create index if not exists projects_workspace_id_idx on public.projects (workspace_id);
create index if not exists work_sessions_workspace_id_idx on public.work_sessions (workspace_id);
create index if not exists announcement_messages_workspace_id_idx on public.announcement_messages (workspace_id);
create index if not exists media_library_workspace_id_idx on public.media_library (workspace_id);

-- ---- 4. profiles ------------------------------------------------------------
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Workspace members can view profiles in their workspace"
  on public.profiles for select
  using (
    user_id = auth.uid()
    or workspace_id = public.current_workspace_id()
    or public.is_platform_admin()
  );
-- INSERT/UPDATE were already scoped to auth.uid() = user_id — unchanged.

-- ---- 5. projects --------------------------------------------------------------
drop policy if exists "Users can view all projects" on public.projects;
drop policy if exists "Users can create projects" on public.projects;
drop policy if exists "Project leads and admins can manage projects" on public.projects;

create policy "Workspace members can view projects"
  on public.projects for select
  using (workspace_id = public.current_workspace_id() or public.is_platform_admin());

create policy "Workspace members can create projects"
  on public.projects for insert
  with check (workspace_id = public.current_workspace_id());

create policy "Leads and workspace admins can manage projects"
  on public.projects for all
  using (
    workspace_id = public.current_workspace_id()
    and (lead_id = auth.uid() or created_by = auth.uid() or public.has_workspace_role(workspace_id, 'admin'))
  )
  with check (workspace_id = public.current_workspace_id());

-- ---- 6. issues (inherits workspace via project_id) ------------------------
drop policy if exists "Users can view issues in accessible projects" on public.issues;
drop policy if exists "Users can create issues" on public.issues;
drop policy if exists "Team members can update issues" on public.issues;
drop policy if exists "Team members can delete issues" on public.issues;

create policy "Workspace members can view issues"
  on public.issues for select
  using (exists (
    select 1 from public.projects p where p.id = issues.project_id and p.workspace_id = public.current_workspace_id()
  ) or public.is_platform_admin());

create policy "Workspace members can create issues"
  on public.issues for insert
  with check (exists (
    select 1 from public.projects p where p.id = issues.project_id and p.workspace_id = public.current_workspace_id()
  ));

create policy "Workspace members can update issues"
  on public.issues for update
  using (exists (
    select 1 from public.projects p where p.id = issues.project_id and p.workspace_id = public.current_workspace_id()
  ))
  with check (exists (
    select 1 from public.projects p where p.id = issues.project_id and p.workspace_id = public.current_workspace_id()
  ));

create policy "Workspace members can delete issues"
  on public.issues for delete
  using (exists (
    select 1 from public.projects p where p.id = issues.project_id and p.workspace_id = public.current_workspace_id()
  ));

-- ---- 7. sprints (collapses the previously-overlapping open policies) -----
drop policy if exists "Users can view sprints" on public.sprints;
drop policy if exists "Project managers can manage sprints" on public.sprints;
drop policy if exists "Authenticated users can update sprints" on public.sprints;
drop policy if exists "Authenticated users can delete sprints" on public.sprints;

create policy "Workspace members can view sprints"
  on public.sprints for select
  using (exists (
    select 1 from public.projects p where p.id = sprints.project_id and p.workspace_id = public.current_workspace_id()
  ));

create policy "Workspace members can manage sprints"
  on public.sprints for all
  using (exists (
    select 1 from public.projects p where p.id = sprints.project_id and p.workspace_id = public.current_workspace_id()
  ))
  with check (exists (
    select 1 from public.projects p where p.id = sprints.project_id and p.workspace_id = public.current_workspace_id()
  ));

-- ---- 8. sprint_issues -----------------------------------------------------
drop policy if exists "Users can view sprint issues" on public.sprint_issues;
drop policy if exists "Project managers can manage sprint issues" on public.sprint_issues;

create policy "Workspace members can manage sprint issues"
  on public.sprint_issues for all
  using (exists (
    select 1 from public.sprints s join public.projects p on p.id = s.project_id
    where s.id = sprint_issues.sprint_id and p.workspace_id = public.current_workspace_id()
  ))
  with check (exists (
    select 1 from public.sprints s join public.projects p on p.id = s.project_id
    where s.id = sprint_issues.sprint_id and p.workspace_id = public.current_workspace_id()
  ));

-- ---- 9. comments -----------------------------------------------------------
drop policy if exists "Users can view comments" on public.comments;
create policy "Workspace members can view comments"
  on public.comments for select
  using (exists (
    select 1 from public.issues i join public.projects p on p.id = i.project_id
    where i.id = comments.issue_id and p.workspace_id = public.current_workspace_id()
  ));

drop policy if exists "Users can create comments" on public.comments;
create policy "Workspace members can create comments"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.issues i join public.projects p on p.id = i.project_id
      where i.id = comments.issue_id and p.workspace_id = public.current_workspace_id()
    )
  );

-- ---- 10. time_logs ----------------------------------------------------------
drop policy if exists "Users can view time logs" on public.time_logs;
create policy "Workspace members can view time logs"
  on public.time_logs for select
  using (exists (
    select 1 from public.issues i join public.projects p on p.id = i.project_id
    where i.id = time_logs.issue_id and p.workspace_id = public.current_workspace_id()
  ));

-- ---- 11. issue_assignees (also drops the duplicate ALL policy) -----------
drop policy if exists "Users can view issue assignees" on public.issue_assignees;
drop policy if exists "Team members can manage issue assignees" on public.issue_assignees;
drop policy if exists "Team members can manage assignees" on public.issue_assignees;

create policy "Workspace members can view issue assignees"
  on public.issue_assignees for select
  using (exists (
    select 1 from public.issues i join public.projects p on p.id = i.project_id
    where i.id = issue_assignees.issue_id and p.workspace_id = public.current_workspace_id()
  ));

create policy "Workspace members can manage issue assignees"
  on public.issue_assignees for all
  using (exists (
    select 1 from public.issues i join public.projects p on p.id = i.project_id
    where i.id = issue_assignees.issue_id and p.workspace_id = public.current_workspace_id()
  ))
  with check (exists (
    select 1 from public.issues i join public.projects p on p.id = i.project_id
    where i.id = issue_assignees.issue_id and p.workspace_id = public.current_workspace_id()
  ));

-- ---- 12. calendar_entries ---------------------------------------------------
drop policy if exists "Users can view calendar entries for their projects" on public.calendar_entries;
create policy "Workspace members can view calendar entries"
  on public.calendar_entries for select
  using (exists (
    select 1 from public.projects p where p.id = calendar_entries.project_id and p.workspace_id = public.current_workspace_id()
  ));

-- ---- 13. project_invitations (consolidates has_role -> has_workspace_role) --
drop policy if exists "Project managers can create invitations" on public.project_invitations;
drop policy if exists "Project managers can view invitations" on public.project_invitations;

create policy "Workspace admins can create invitations"
  on public.project_invitations for insert
  with check (exists (
    select 1 from public.projects p
    where p.id = project_invitations.project_id
      and p.workspace_id = public.current_workspace_id()
      and (p.lead_id = auth.uid() or p.created_by = auth.uid() or public.has_workspace_role(p.workspace_id, 'admin'))
  ));

create policy "Workspace admins can view invitations"
  on public.project_invitations for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_invitations.project_id
      and p.workspace_id = public.current_workspace_id()
      and (p.lead_id = auth.uid() or p.created_by = auth.uid() or public.has_workspace_role(p.workspace_id, 'admin'))
  ));
-- "Users can view their own invitations" (by email) is untouched — not workspace-related.

-- ---- 14. sprint_task_history (drops the bare-true policy) -----------------
drop policy if exists "Authenticated users can view sprint task history" on public.sprint_task_history;
create policy "Workspace members can view sprint task history"
  on public.sprint_task_history for select
  using (exists (
    select 1 from public.sprints s join public.projects p on p.id = s.project_id
    where s.id = sprint_task_history.sprint_id and p.workspace_id = public.current_workspace_id()
  ));

-- ---- 15. work_sessions (drops the bare-true policy; has its own workspace_id) --
drop policy if exists "Authenticated users can view work sessions" on public.work_sessions;
create policy "Workspace members can view work sessions"
  on public.work_sessions for select
  using (workspace_id = public.current_workspace_id());

-- ---- 16. announcement_messages (has its own workspace_id now) -----------
drop policy if exists "Team members can view recent announcements" on public.announcement_messages;
create policy "Workspace members can view recent announcements"
  on public.announcement_messages for select
  using (workspace_id = public.current_workspace_id() and created_at >= now() - interval '30 days');

drop policy if exists "Team members can post announcements" on public.announcement_messages;
create policy "Workspace members can post announcements"
  on public.announcement_messages for insert
  with check (auth.uid() = author_id and workspace_id = public.current_workspace_id());

-- ---- 17. media_library (has its own workspace_id now) ---------------------
drop policy if exists "Users can view media in their projects" on public.media_library;
create policy "Workspace members can view media"
  on public.media_library for select
  using (workspace_id = public.current_workspace_id());

drop policy if exists "Users can upload media" on public.media_library;
create policy "Workspace members can upload media"
  on public.media_library for insert
  with check (auth.uid() = user_id and workspace_id = public.current_workspace_id());

-- ---- 18. notifications: close the bare-true INSERT hole -------------------
-- The trigger functions that create notifications are all SECURITY DEFINER,
-- so they bypass RLS already — this policy was never actually needed, and it
-- let any client insert a notification for any user directly via the API.
drop policy if exists "System can create notifications" on public.notifications;
-- No replacement: direct client inserts are now denied; only the SECURITY
-- DEFINER trigger functions below can create notifications going forward.

-- ---- 19. Make the announcement fan-out trigger workspace-aware ------------
-- (previously notified every profile in the whole database; now only the
-- author's own workspace. Also updates the notification link to the current
-- /app-prefixed route.)
create or replace function public.on_announcement_posted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_id uuid;
  actor_name text;
  preview text;
  author_workspace_id uuid;
begin
  delete from public.announcement_messages where created_at < now() - interval '30 days';

  begin
    delete from storage.objects where bucket_id = 'chat-media' and created_at < now() - interval '30 days';
  exception when others then
    null;
  end;

  select workspace_id into author_workspace_id from public.profiles where user_id = new.author_id;
  select coalesce(full_name, email) into actor_name from public.profiles where user_id = new.author_id;

  preview := nullif(btrim(left(new.content, 120)), '');
  if preview is null then
    preview := case when new.media_type = 'video' then 'sent a video' else 'sent an image' end;
  end if;

  for member_id in
    select user_id from public.profiles
    where user_id is not null and user_id <> new.author_id and workspace_id = author_workspace_id
  loop
    insert into public.notifications (user_id, type, title, message, link, metadata)
    values (
      member_id,
      'announcement',
      'New announcement',
      coalesce(actor_name, 'Someone') || ': ' || preview,
      '/app/announcements',
      jsonb_build_object('announcement_id', new.id)
    );
  end loop;

  return new;
end;
$$;

-- ---- 20. Adjacent bug found during the RLS audit: duplicate coin-point award --
-- Two triggers on `issues` both call award_coin_points_on_completion(), so
-- completing a task currently awards 20 points instead of 10. Not workspace-
-- related, but cheap to fix while in here — drops only the accidental
-- duplicate (added a migration later than the original).
drop trigger if exists award_coin_points_trigger on public.issues;

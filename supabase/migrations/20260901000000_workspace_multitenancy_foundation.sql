-- ============================================================================
-- Workspace multi-tenancy: foundational schema (Phase 1)
--
-- This introduces workspaces as a top-level tenant boundary, sitting above
-- everything that exists today. It does NOT yet touch any existing table
-- (projects, issues, time_logs, etc.) — that retrofit is Phase 2, done
-- carefully table-by-table so existing RLS isn't broken or weakened.
-- ============================================================================

-- ---- 1. Roles --------------------------------------------------------------
create type public.workspace_role as enum ('superadmin', 'admin', 'manager', 'employee');

-- ---- 2. Workspaces -----------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),

  -- activity / lifecycle (item 5 & 6)
  last_active_at timestamptz not null default now(),
  warnings_sent int not null default 0,          -- 0..3, how many of the 3 inactivity warnings have gone out
  last_warning_sent_at timestamptz,

  deleted_at timestamptz,                        -- soft-delete marker
  deletion_requested_by uuid references auth.users(id),
  hard_delete_at timestamptz                     -- deleted_at + 7 days; set at delete time
);

create index workspaces_code_idx on public.workspaces (code);
create index workspaces_deleted_at_idx on public.workspaces (deleted_at) where deleted_at is not null;

-- ---- 3. Membership (one workspace per user, matching "join at signup, stay there") --
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'employee',
  joined_at timestamptz not null default now()
);

create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);

-- ---- 4. Six-character unique join code (e.g. "87DK91") ---------------------
-- Excludes 0/O/1/I to avoid characters that are easy to misread/mistype.
create or replace function public.generate_workspace_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.workspaces where code = result);
  end loop;
  return result;
end;
$$;

-- ---- 5. Role-check helper, used by RLS on this table and (later) every other --
create or replace function public.has_workspace_role(_workspace_id uuid, _min_role public.workspace_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = auth.uid()
      and case role
            when 'superadmin' then 4
            when 'admin' then 3
            when 'manager' then 2
            when 'employee' then 1
          end
          >=
          case _min_role
            when 'superadmin' then 4
            when 'admin' then 3
            when 'manager' then 2
            when 'employee' then 1
          end
  );
$$;

-- Convenience: the calling user's single workspace (null if they have none).
create or replace function public.current_workspace_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id from public.workspace_members where user_id = auth.uid() limit 1;
$$;

-- Call this from the app on load/whenever a signed-in user is active. Resets
-- the inactivity clock and clears any pending warnings for their workspace.
create or replace function public.touch_workspace_activity()
returns void
language sql
security definer
set search_path = public
as $$
  update public.workspaces
  set last_active_at = now(), warnings_sent = 0, last_warning_sent_at = null
  where id = public.current_workspace_id() and deleted_at is null;
$$;

-- ---- 6. Platform admins (item 8 — separate from any workspace role) --------
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

-- SECURITY DEFINER so this bypasses RLS on platform_admins internally —
-- used inside policies below. Calling it from a policy ON platform_admins
-- itself (or anywhere else) via a raw correlated subquery instead would
-- make Postgres re-apply that same policy to the subquery, recursing into
-- itself and erroring with "infinite recursion detected in policy".
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- ---- 7. Recovery requests (item 7 — identity via session, never a password) --
create table public.workspace_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id),
  requester_email text not null,          -- snapshot from the authenticated session, not a free-text field
  workspace_code text not null,           -- the code they're trying to recover
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_reply text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---- 8. RLS ------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.workspace_recovery_requests enable row level security;

create policy "Members and platform admins can view a workspace"
  on public.workspaces for select
  using (
    exists (select 1 from public.workspace_members wm where wm.workspace_id = workspaces.id and wm.user_id = auth.uid())
    or public.is_platform_admin()
  );

create policy "Superadmins can update their own workspace"
  on public.workspaces for update
  using (public.has_workspace_role(id, 'superadmin'))
  with check (public.has_workspace_role(id, 'superadmin'));

create policy "Members and platform admins can view membership"
  on public.workspace_members for select
  using (
    workspace_id = public.current_workspace_id()
    or public.is_platform_admin()
  );

create policy "Admins and above can change member roles"
  on public.workspace_members for update
  using (public.has_workspace_role(workspace_id, 'admin'))
  with check (public.has_workspace_role(workspace_id, 'admin'));

create policy "Admins and above can remove members"
  on public.workspace_members for delete
  using (public.has_workspace_role(workspace_id, 'admin'));

create policy "Only platform admins can see the platform_admins list"
  on public.platform_admins for select
  using (public.is_platform_admin());

create policy "Any signed-in user can file their own recovery request"
  on public.workspace_recovery_requests for insert
  with check (requested_by = auth.uid());

create policy "Requesters and platform admins can view recovery requests"
  on public.workspace_recovery_requests for select
  using (requested_by = auth.uid() or public.is_platform_admin());

create policy "Platform admins can decide on recovery requests"
  on public.workspace_recovery_requests for update
  using (public.is_platform_admin());

-- ============================================================================
-- Seed data — safe to run more than once (every insert below is idempotent).
-- ============================================================================

-- ---- Item 4: KAAM77 workspace + the six existing team members --------------
-- If any of these six people haven't signed up in Supabase Auth yet, the
-- lookup below simply finds no matching row for them and skips them — re-run
-- this block after they sign up and they'll be linked in on that later run.
insert into public.workspaces (name, code, created_by)
select 'Kaam (Loopix Creations)', 'KAAM77', u.id
from auth.users u
where u.email = 'sanjaynewar007@gmail.com'
on conflict (code) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select
  w.id,
  u.id,
  case when u.email = 'sanjaynewar007@gmail.com' then 'superadmin'::public.workspace_role else 'employee'::public.workspace_role end
from public.workspaces w
join auth.users u on u.email in (
  'puskarsimkhada22@gmail.com',
  'oceanjunggurung@gmail.com',
  'gadalsandesh123@gmail.com',
  'sanjaygrg9845@gmail.com',
  'sanjaynewar007@gmail.com',
  'sanjayrajbhandari156@gmail.com'
)
where w.code = 'KAAM77'
on conflict (user_id) do nothing;

-- ---- Item 8: mark the platform-admin account -------------------------------
-- Run this AFTER creating info@loopixcreations.com.np yourself in the
-- Supabase dashboard (Authentication > Users > Add user) with a password of
-- your own choosing. Re-run this statement alone once that account exists.
insert into public.platform_admins (user_id)
select id from auth.users where email = 'info@loopixcreations.com.np'
on conflict (user_id) do nothing;

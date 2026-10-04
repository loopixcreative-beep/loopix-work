-- Project cash ledgers and a workspace business ledger. Amounts are positive
-- decimal currency units. Transfers affect cash but are excluded from revenue.
create table public.account_ledgers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  currency text not null default 'NPR' check (currency ~ '^[A-Z]{3}$'),
  opening_balance numeric(18,2) not null default 0,
  main_project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id),
  check (project_id is not null or name = 'Business account')
);
create unique index one_business_ledger_per_workspace on public.account_ledgers(workspace_id) where project_id is null;

create table public.account_transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.account_ledgers(id) on delete cascade,
  transaction_id text not null,
  transaction_date date not null,
  type text not null check (type in ('income','expense','transfer_in','transfer_out')),
  category text not null check (length(trim(category)) > 0),
  amount numeric(18,2) not null check (amount > 0),
  remarks text not null default '',
  counterparty text,
  reference text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ledger_id, transaction_id)
);
create index account_transactions_ledger_date_idx on public.account_transactions(ledger_id, transaction_date desc, created_at desc);

create table public.account_statements (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.account_ledgers(id) on delete cascade,
  statement_month date not null check (extract(day from statement_month) = 1),
  file_name text not null,
  storage_path text not null unique,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  uploaded_at timestamptz not null default now(),
  unique (ledger_id, statement_month),
  check (split_part(storage_path, '/', 1) = ledger_id::text)
);

create table public.account_transaction_audit (
  id bigint generated always as identity primary key,
  transaction_row_id uuid not null,
  ledger_id uuid not null references public.account_ledgers(id) on delete cascade,
  action text not null check (action in ('INSERT','UPDATE')),
  before_value jsonb,
  after_value jsonb not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);
create index account_transaction_audit_ledger_idx on public.account_transaction_audit(ledger_id, changed_at desc);

-- A related member is a project lead, creator, accepted invitee, issue
-- reporter/assignee, or a workspace manager/admin. This mirrors the Team tab.
create schema if not exists app_private;
create or replace function app_private.can_view_account(_workspace uuid, _project uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is not null and _workspace = public.current_workspace_id()
    and (
      public.has_workspace_role(_workspace, 'manager')
      or (_project is null and public.has_workspace_role(_workspace, 'manager'))
      or exists (select 1 from public.projects p where p.id = _project and p.workspace_id = _workspace
        and (p.lead_id = auth.uid() or p.created_by = auth.uid()))
      or exists (select 1 from public.project_invitations i join public.profiles pr
        on lower(pr.email) = lower(i.email) where i.project_id = _project
        and i.status = 'accepted' and pr.user_id = auth.uid())
      or exists (select 1 from public.issues i where i.project_id = _project
        and (i.reporter_id = auth.uid() or i.assignee_id = auth.uid()))
      or exists (select 1 from public.issue_assignees ia join public.issues i on i.id = ia.issue_id
        where i.project_id = _project and ia.user_id = auth.uid())
    );
$$;
create or replace function app_private.can_manage_account(_workspace uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is not null and _workspace = public.current_workspace_id()
    and public.has_workspace_role(_workspace, 'manager');
$$;
revoke all on function app_private.can_view_account(uuid,uuid) from public, anon;
revoke all on function app_private.can_manage_account(uuid) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.can_view_account(uuid,uuid), app_private.can_manage_account(uuid) to authenticated;

alter table public.account_ledgers enable row level security;
alter table public.account_transactions enable row level security;
alter table public.account_statements enable row level security;
alter table public.account_transaction_audit enable row level security;
revoke all on public.account_ledgers, public.account_transactions, public.account_statements from anon, authenticated;
revoke all on public.account_transaction_audit from anon, authenticated;
grant select, insert, update on public.account_ledgers, public.account_transactions, public.account_statements to authenticated;
grant select on public.account_transaction_audit to authenticated;
grant usage on schema public to authenticated;

create policy account_ledgers_read on public.account_ledgers for select to authenticated
  using (app_private.can_view_account(workspace_id, project_id));
create policy account_ledgers_insert on public.account_ledgers for insert to authenticated
  with check (app_private.can_manage_account(workspace_id) and
    (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.workspace_id = workspace_id)) and
    (main_project_id is null or exists (select 1 from public.projects p where p.id = main_project_id and p.workspace_id = workspace_id)));
create policy account_ledgers_update on public.account_ledgers for update to authenticated
  using (app_private.can_manage_account(workspace_id))
  with check (app_private.can_manage_account(workspace_id) and
    (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.workspace_id = workspace_id)) and
    (main_project_id is null or exists (select 1 from public.projects p where p.id = main_project_id and p.workspace_id = workspace_id)));

create policy account_transactions_read on public.account_transactions for select to authenticated
  using (exists (select 1 from public.account_ledgers l where l.id = ledger_id and app_private.can_view_account(l.workspace_id,l.project_id)));
create policy account_transactions_insert on public.account_transactions for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.account_ledgers l where l.id = ledger_id and app_private.can_manage_account(l.workspace_id)));
create policy account_transactions_update on public.account_transactions for update to authenticated
  using (exists (select 1 from public.account_ledgers l where l.id = ledger_id and app_private.can_manage_account(l.workspace_id)))
  with check (exists (select 1 from public.account_ledgers l where l.id = ledger_id and app_private.can_manage_account(l.workspace_id)));

create policy account_statements_read on public.account_statements for select to authenticated
  using (exists (select 1 from public.account_ledgers l where l.id = ledger_id and app_private.can_view_account(l.workspace_id,l.project_id)));
create policy account_statements_insert on public.account_statements for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (select 1 from public.account_ledgers l where l.id = ledger_id and app_private.can_manage_account(l.workspace_id)));
create policy account_statements_update on public.account_statements for update to authenticated
  using (exists (select 1 from public.account_ledgers l where l.id = ledger_id and app_private.can_manage_account(l.workspace_id)))
  with check (uploaded_by = auth.uid() and exists (select 1 from public.account_ledgers l where l.id = ledger_id and app_private.can_manage_account(l.workspace_id)));
create policy account_transaction_audit_read on public.account_transaction_audit for select to authenticated
  using (exists (select 1 from public.account_ledgers l where l.id = ledger_id and app_private.can_view_account(l.workspace_id,l.project_id)));

create or replace function app_private.audit_account_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.ledger_id is distinct from old.ledger_id then
      raise exception 'A transaction cannot be moved to another account';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  insert into public.account_transaction_audit(transaction_row_id,ledger_id,action,before_value,after_value,changed_by)
  values (new.id,new.ledger_id,tg_op,case when tg_op = 'UPDATE' then to_jsonb(old) else null end,to_jsonb(new),auth.uid());
  return new;
end; $$;
create trigger audit_account_transaction before insert or update on public.account_transactions
for each row execute function app_private.audit_account_transaction();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('account-statements','account-statements',false,10485760,array['application/pdf','image/png','image/jpeg'])
on conflict (id) do nothing;
create policy account_statements_object_read on storage.objects for select to authenticated
  using (bucket_id = 'account-statements' and exists (
    select 1 from public.account_ledgers l where l.id::text = (storage.foldername(name))[1]
      and app_private.can_view_account(l.workspace_id,l.project_id)));
create policy account_statements_object_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'account-statements' and exists (
    select 1 from public.account_ledgers l where l.id::text = (storage.foldername(name))[1]
      and app_private.can_manage_account(l.workspace_id)));
create policy account_statements_object_delete on storage.objects for delete to authenticated
  using (bucket_id = 'account-statements' and exists (
    select 1 from public.account_ledgers l where l.id::text = (storage.foldername(name))[1]
      and app_private.can_manage_account(l.workspace_id)));

-- Every existing project starts with its own ledger, even before a manager
-- visits the Account tab. New projects receive one in the same transaction.
insert into public.account_ledgers(workspace_id, project_id, name)
select workspace_id, id, 'Project account' from public.projects
on conflict (project_id) do nothing;
insert into public.account_ledgers(workspace_id, project_id, name)
select id, null, 'Business account' from public.workspaces
on conflict do nothing;

create or replace function app_private.create_project_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.account_ledgers(workspace_id,project_id,name)
  values (new.workspace_id,new.id,'Project account');
  return new;
end; $$;
create trigger create_project_ledger after insert on public.projects
for each row execute function app_private.create_project_ledger();

-- Only workspace admins choose the project highlighted in the business account.
create or replace function app_private.guard_main_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.workspace_id is distinct from old.workspace_id or new.project_id is distinct from old.project_id then
    raise exception 'An account cannot be moved to another workspace or project';
  end if;
  if new.main_project_id is distinct from old.main_project_id
     and not public.has_workspace_role(old.workspace_id, 'admin') then
    raise exception 'Only workspace admins can select the main project';
  end if;
  return new;
end; $$;
create trigger guard_main_project before update on public.account_ledgers
for each row execute function app_private.guard_main_project();

create or replace function app_private.guard_statement_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ledger_id is distinct from old.ledger_id then
    raise exception 'A statement cannot be moved to another account';
  end if;
  return new;
end; $$;
create trigger guard_statement_ledger before update on public.account_statements
for each row execute function app_private.guard_statement_ledger();

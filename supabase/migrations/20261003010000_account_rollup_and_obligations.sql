-- Follow-up to project_accounting: one selected main project per workspace,
-- automatic project-scoped IDs, and obligations that do not move cash until paid.

alter table public.account_ledgers
  add column if not exists next_transaction_number bigint not null default 1,
  add column if not exists next_receivable_number bigint not null default 1,
  add column if not exists next_payable_number bigint not null default 1;
revoke insert, update on public.account_ledgers from authenticated;
grant insert(workspace_id,project_id,name), update(main_project_id) on public.account_ledgers to authenticated;

-- The business ledger row is the single workspace-wide setting. An admin
-- changes main_project_id there; it is never used to copy transactions.
create or replace function app_private.guard_main_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.workspace_id is distinct from old.workspace_id or new.project_id is distinct from old.project_id then
    raise exception 'An account cannot be moved to another workspace or project';
  end if;
  if new.main_project_id is distinct from old.main_project_id then
    if new.project_id is not null then
      raise exception 'Only the workspace setting can select a main project';
    end if;
    if not public.has_workspace_role(old.workspace_id, 'admin') then
      raise exception 'Only workspace admins can select the main project';
    end if;
    if new.main_project_id is not null and not exists (
      select 1 from public.projects p
      where p.id = new.main_project_id and p.workspace_id = old.workspace_id
    ) then
      raise exception 'Main project must belong to this workspace';
    end if;
  end if;
  return new;
end; $$;

create table public.account_obligations (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.account_ledgers(id) on delete cascade,
  obligation_id text not null,
  kind text not null check (kind in ('receivable','payable')),
  issue_date date not null default current_date,
  due_date date not null,
  category text not null check (length(trim(category)) > 0),
  amount numeric(18,2) not null check (amount > 0),
  remarks text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ledger_id, obligation_id)
);
create index account_obligations_ledger_due_idx on public.account_obligations(ledger_id,due_date);
alter table public.account_obligations enable row level security;
revoke all on public.account_obligations from anon, authenticated;
grant select, insert, update on public.account_obligations to authenticated;

create policy account_obligations_read on public.account_obligations for select to authenticated
  using (exists (select 1 from public.account_ledgers l where l.id = ledger_id
    and app_private.can_view_account(l.workspace_id,l.project_id)));
create policy account_obligations_insert on public.account_obligations for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.account_ledgers l where l.id = ledger_id
    and l.project_id is not null and app_private.can_manage_account(l.workspace_id)));
create policy account_obligations_update on public.account_obligations for update to authenticated
  using (exists (select 1 from public.account_ledgers l where l.id = ledger_id
    and app_private.can_manage_account(l.workspace_id)))
  with check (exists (select 1 from public.account_ledgers l where l.id = ledger_id
    and l.project_id is not null and app_private.can_manage_account(l.workspace_id)));

create table public.account_obligation_audit (
  id bigint generated always as identity primary key,
  obligation_row_id uuid not null,
  ledger_id uuid not null references public.account_ledgers(id) on delete cascade,
  action text not null check (action in ('INSERT','UPDATE')),
  before_value jsonb,
  after_value jsonb not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);
create index account_obligation_audit_ledger_idx on public.account_obligation_audit(ledger_id,changed_at desc);
alter table public.account_obligation_audit enable row level security;
revoke all on public.account_obligation_audit from anon, authenticated;
grant select on public.account_obligation_audit to authenticated;
create policy account_obligation_audit_read on public.account_obligation_audit for select to authenticated
  using (exists (select 1 from public.account_ledgers l where l.id = ledger_id
    and app_private.can_view_account(l.workspace_id,l.project_id)));

alter table public.account_transactions
  add column if not exists obligation_id uuid references public.account_obligations(id);
create index account_transactions_obligation_idx on public.account_transactions(obligation_id)
  where obligation_id is not null;

create or replace function app_private.project_account_prefix(_ledger_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(upper(regexp_replace(p.key,'[^A-Za-z0-9]','','g')),''),'PRJ')
  from public.account_ledgers l join public.projects p on p.id = l.project_id
  where l.id = _ledger_id;
$$;

create or replace function app_private.prepare_account_obligation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  next_number bigint;
  prefix text;
  settled numeric(18,2);
begin
  if tg_op = 'INSERT' then
    prefix := app_private.project_account_prefix(new.ledger_id);
    if prefix is null then raise exception 'Obligations require a project account'; end if;
    if new.kind = 'receivable' then
      update public.account_ledgers set next_receivable_number = next_receivable_number + 1
      where id = new.ledger_id returning next_receivable_number - 1 into next_number;
      new.obligation_id := prefix || '-AR-' || lpad(next_number::text,greatest(6,length(next_number::text)),'0');
    else
      update public.account_ledgers set next_payable_number = next_payable_number + 1
      where id = new.ledger_id returning next_payable_number - 1 into next_number;
      new.obligation_id := prefix || '-AP-' || lpad(next_number::text,greatest(6,length(next_number::text)),'0');
    end if;
  else
    if new.ledger_id is distinct from old.ledger_id
       or new.kind is distinct from old.kind then
      raise exception 'An obligation cannot change project or type';
    end if;
    new.obligation_id := old.obligation_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    select coalesce(sum(t.amount),0) into settled
      from public.account_transactions t where t.obligation_id = old.id;
    if new.amount < settled then
      raise exception 'Obligation amount cannot be less than payments already recorded';
    end if;
    new.updated_at := now();
  end if;
  return new;
end; $$;
create trigger prepare_account_obligation before insert or update on public.account_obligations
for each row execute function app_private.prepare_account_obligation();

create or replace function app_private.audit_account_obligation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.account_obligation_audit(obligation_row_id,ledger_id,action,before_value,after_value,changed_by)
  values (new.id,new.ledger_id,tg_op,case when tg_op = 'UPDATE' then to_jsonb(old) else null end,to_jsonb(new),auth.uid());
  return new;
end; $$;
create trigger audit_account_obligation after insert or update on public.account_obligations
for each row execute function app_private.audit_account_obligation();

-- The transaction ID is allocated under a row lock on its project ledger.
-- The same trigger enforces that a linked settlement cannot overpay.
create or replace function app_private.audit_account_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  next_number bigint;
  prefix text;
  obligation_record public.account_obligations%rowtype;
  already_paid numeric(18,2);
begin
  if tg_op = 'INSERT' then
    prefix := app_private.project_account_prefix(new.ledger_id);
    if prefix is null then raise exception 'Transactions require a project account'; end if;
    loop
      update public.account_ledgers set next_transaction_number = next_transaction_number + 1
        where id = new.ledger_id returning next_transaction_number - 1 into next_number;
      new.transaction_id := prefix || '-' || lpad(next_number::text,greatest(6,length(next_number::text)),'0');
      exit when not exists (select 1 from public.account_transactions t
        where t.ledger_id = new.ledger_id and t.transaction_id = new.transaction_id);
    end loop;
  else
    if new.ledger_id is distinct from old.ledger_id then
      raise exception 'A transaction cannot be moved to another account';
    end if;
    new.transaction_id := old.transaction_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  if new.obligation_id is not null then
    select * into obligation_record from public.account_obligations
      where id = new.obligation_id for update;
    if not found or obligation_record.ledger_id <> new.ledger_id
       or (obligation_record.kind = 'receivable' and new.type <> 'income')
       or (obligation_record.kind = 'payable' and new.type <> 'expense') then
      raise exception 'Payment must match the project and obligation type';
    end if;
    select coalesce(sum(t.amount),0) into already_paid
      from public.account_transactions t
      where t.obligation_id = new.obligation_id and t.id <> new.id;
    if already_paid + new.amount > obligation_record.amount then
      raise exception 'Payment exceeds the outstanding amount';
    end if;
  end if;
  insert into public.account_transaction_audit(transaction_row_id,ledger_id,action,before_value,after_value,changed_by)
  values (new.id,new.ledger_id,tg_op,case when tg_op = 'UPDATE' then to_jsonb(old) else null end,to_jsonb(new),auth.uid());
  return new;
end; $$;

-- Transaction IDs are allocated by the trigger; callers cannot choose them.
-- Keep the existing NOT NULL constraint: BEFORE INSERT fills the value.
-- Existing manual IDs remain stable.
revoke all on function app_private.project_account_prefix(uuid) from public, anon, authenticated;
revoke all on function app_private.prepare_account_obligation() from public, anon, authenticated;
revoke all on function app_private.audit_account_obligation() from public, anon, authenticated;
revoke all on function app_private.audit_account_transaction() from public, anon, authenticated;

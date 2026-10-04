-- A project can use employee budgets without displaying the section to members.
-- Existing projects with allocations remain visible after this migration.
create table public.project_budget_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  visible boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.project_budget_settings(project_id, visible)
select distinct project_id, true from public.project_employee_budgets
on conflict (project_id) do nothing;

alter table public.project_budget_settings enable row level security;
revoke all on public.project_budget_settings from anon, authenticated;
grant select, insert, update on public.project_budget_settings to authenticated;

create policy project_budget_settings_read on public.project_budget_settings
for select to authenticated using (exists (
  select 1 from public.projects p where p.id = project_id
    and app_private.can_view_account(p.workspace_id, p.id)
));
create policy project_budget_settings_insert on public.project_budget_settings
for insert to authenticated with check (exists (
  select 1 from public.projects p where p.id = project_id
    and app_private.can_manage_account(p.workspace_id)
));
create policy project_budget_settings_update on public.project_budget_settings
for update to authenticated using (exists (
  select 1 from public.projects p where p.id = project_id
    and app_private.can_manage_account(p.workspace_id)
)) with check (exists (
  select 1 from public.projects p where p.id = project_id
    and app_private.can_manage_account(p.workspace_id)
));

create or replace function app_private.prepare_project_budget_settings()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'Project budget settings cannot be moved to another project';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end; $$;
create trigger prepare_project_budget_settings before insert or update on public.project_budget_settings
for each row execute function app_private.prepare_project_budget_settings();
revoke all on function app_private.prepare_project_budget_settings() from public, anon, authenticated;

-- Managers retain access while hidden; an employee may read their own
-- allocation only when the project budget section is visible.
drop policy project_employee_budgets_read on public.project_employee_budgets;
create policy project_employee_budgets_read on public.project_employee_budgets
for select to authenticated using (exists (
  select 1 from public.projects p where p.id = project_id
    and p.workspace_id = public.current_workspace_id()
    and (app_private.can_manage_account(p.workspace_id)
      or (employee_id = auth.uid() and exists (
        select 1 from public.project_budget_settings s
        where s.project_id = p.id and s.visible)))
));

-- An unlinked, already-recorded expense can be attached to one allocation.
-- This is metadata on the original cash transaction, never a second expense.
create or replace function app_private.validate_employee_budget_payment()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  allocation public.project_employee_budgets%rowtype;
  paid numeric(18,2);
begin
  if tg_op = 'UPDATE' and old.employee_budget_id is not null
     and new.employee_budget_id is distinct from old.employee_budget_id then
    raise exception 'A budget payment cannot be reassigned or unlinked';
  end if;
  if new.employee_budget_id is null then return new; end if;
  select * into allocation from public.project_employee_budgets
    where id = new.employee_budget_id for update;
  if not found or new.type <> 'expense'
     or (tg_op = 'INSERT' and new.category <> 'Project-based team payments')
     or not exists (select 1 from public.account_ledgers l where l.id = new.ledger_id
       and l.project_id = allocation.project_id) then
    raise exception 'Budget payment must be an expense in the same project';
  end if;
  select coalesce(sum(t.amount), 0) into paid from public.account_transactions t
    where t.employee_budget_id = new.employee_budget_id and t.id <> new.id;
  if paid + new.amount > allocation.budget_amount then
    raise exception 'Payment exceeds the employee project budget';
  end if;
  return new;
end; $$;
revoke all on function app_private.validate_employee_budget_payment() from public, anon, authenticated;

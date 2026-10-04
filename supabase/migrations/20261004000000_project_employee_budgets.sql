-- Optional project-based employee budgets. A budget is a plan; only a linked
-- expense transaction represents cash paid and enters the main account rollup.
create table public.project_employee_budgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references auth.users(id),
  budget_amount numeric(18,2) not null check (budget_amount > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, employee_id)
);
create index project_employee_budgets_employee_idx on public.project_employee_budgets(employee_id);

alter table public.project_employee_budgets enable row level security;
revoke all on public.project_employee_budgets from anon, authenticated;
grant select, insert, update on public.project_employee_budgets to authenticated;

create policy project_employee_budgets_read on public.project_employee_budgets
for select to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id
    and p.workspace_id = public.current_workspace_id()
    and (app_private.can_manage_account(p.workspace_id) or employee_id = auth.uid()))
);
create policy project_employee_budgets_insert on public.project_employee_budgets
for insert to authenticated with check (
  created_by = auth.uid() and exists (
    select 1 from public.projects p join public.workspace_members m
      on m.workspace_id = p.workspace_id and m.user_id = employee_id
    where p.id = project_id and app_private.can_manage_account(p.workspace_id))
);
create policy project_employee_budgets_update on public.project_employee_budgets
for update to authenticated
using (exists (select 1 from public.projects p where p.id = project_id
  and app_private.can_manage_account(p.workspace_id)))
with check (exists (select 1 from public.projects p join public.workspace_members m
  on m.workspace_id = p.workspace_id and m.user_id = employee_id
  where p.id = project_id and app_private.can_manage_account(p.workspace_id)));

alter table public.account_transactions add column employee_budget_id uuid
  references public.project_employee_budgets(id) on delete restrict;
create index account_transactions_employee_budget_idx on public.account_transactions(employee_budget_id)
  where employee_budget_id is not null;

create or replace function app_private.validate_employee_budget()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare paid numeric(18,2);
begin
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id or new.employee_id is distinct from old.employee_id then
      raise exception 'An employee budget cannot be reassigned';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  select coalesce(sum(t.amount), 0) into paid
    from public.account_transactions t where t.employee_budget_id = new.id;
  if new.budget_amount < paid then raise exception 'Budget cannot be less than payments already recorded'; end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger validate_employee_budget before insert or update on public.project_employee_budgets
for each row execute function app_private.validate_employee_budget();

create or replace function app_private.validate_employee_budget_payment()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare allocation public.project_employee_budgets%rowtype;
  paid numeric(18,2);
begin
  if tg_op = 'UPDATE' and new.employee_budget_id is distinct from old.employee_budget_id then
    raise exception 'A budget payment cannot be linked or unlinked after creation';
  end if;
  if new.employee_budget_id is null then return new; end if;
  select * into allocation from public.project_employee_budgets
    where id = new.employee_budget_id for update;
  if not found or new.type <> 'expense' or new.category <> 'Project-based team payments'
    or not exists (select 1 from public.account_ledgers l where l.id = new.ledger_id
      and l.project_id = allocation.project_id) then
    raise exception 'Budget payment must be a project-based expense in the same project';
  end if;
  select coalesce(sum(t.amount), 0) into paid from public.account_transactions t
    where t.employee_budget_id = new.employee_budget_id and t.id <> new.id;
  if paid + new.amount > allocation.budget_amount then
    raise exception 'Payment exceeds the employee project budget';
  end if;
  return new;
end; $$;
create trigger aa_validate_employee_budget_payment before insert or update on public.account_transactions
for each row execute function app_private.validate_employee_budget_payment();

-- An allocated employee is a related project member and can view the project
-- account and their own budget. Other employees cannot read the budget table.
create or replace function app_private.can_view_account(_workspace uuid, _project uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is not null and _workspace = public.current_workspace_id()
    and (
      public.has_workspace_role(_workspace, 'manager')
      or exists (select 1 from public.projects p where p.id = _project and p.workspace_id = _workspace
        and (p.lead_id = auth.uid() or p.created_by = auth.uid()))
      or exists (select 1 from public.project_invitations i join public.profiles pr
        on lower(pr.email) = lower(i.email) where i.project_id = _project
        and i.status = 'accepted' and pr.user_id = auth.uid())
      or exists (select 1 from public.issues i where i.project_id = _project
        and (i.reporter_id = auth.uid() or i.assignee_id = auth.uid()))
      or exists (select 1 from public.issue_assignees ia join public.issues i on i.id = ia.issue_id
        where i.project_id = _project and ia.user_id = auth.uid())
      or exists (select 1 from public.project_employee_budgets b
        where b.project_id = _project and b.employee_id = auth.uid())
    );
$$;
revoke all on function app_private.validate_employee_budget() from public, anon, authenticated;
revoke all on function app_private.validate_employee_budget_payment() from public, anon, authenticated;

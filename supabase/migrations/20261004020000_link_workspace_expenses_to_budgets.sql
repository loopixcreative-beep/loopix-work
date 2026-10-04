-- A project payment may have been made from a different project or the
-- historical business ledger. It is still one cash transaction, stored in
-- its original source ledger and attributed to one employee budget.
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
     or not exists (
       select 1 from public.account_ledgers l
       join public.projects p on p.id = allocation.project_id
       join public.account_ledgers target on target.project_id = p.id
       where l.id = new.ledger_id and l.workspace_id = p.workspace_id
         and l.currency = target.currency
         and (tg_op = 'UPDATE' or l.project_id = allocation.project_id)
     ) then
    raise exception 'Budget payment must be an expense from the same workspace';
  end if;
  select coalesce(sum(t.amount), 0) into paid from public.account_transactions t
    where t.employee_budget_id = new.employee_budget_id and t.id <> new.id;
  if paid + new.amount > allocation.budget_amount then
    raise exception 'Payment exceeds the employee project budget';
  end if;
  return new;
end; $$;
revoke all on function app_private.validate_employee_budget_payment() from public, anon, authenticated;

-- The allocated employee can read their own linked payment even if the cash
-- was paid from another project ledger. Hiding the budget section closes this
-- additional read path. Existing ledger policies still govern other rows.
create policy account_transactions_budget_member_read on public.account_transactions
for select to authenticated using (
  employee_budget_id is not null and exists (
    select 1 from public.project_employee_budgets b
    join public.projects p on p.id = b.project_id
    join public.project_budget_settings s on s.project_id = b.project_id
    where b.id = employee_budget_id and b.employee_id = auth.uid()
      and p.workspace_id = public.current_workspace_id() and s.visible
  )
);

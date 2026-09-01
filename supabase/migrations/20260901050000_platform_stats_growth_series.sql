-- Extends platform_stats() with a weekly workspace-growth series for the
-- console's new trend chart, computed server-side so the frontend doesn't
-- need any broader access to derive it itself.
create or replace function public.platform_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  growth jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can view platform stats';
  end if;

  select coalesce(jsonb_agg(row_to_json(weekly) order by weekly.week_start), '[]'::jsonb)
  into growth
  from (
    select
      date_trunc('week', gs)::date as week_start,
      (
        select count(*) from public.workspaces w
        where date_trunc('week', w.created_at) = date_trunc('week', gs)
      ) as created
    from generate_series(now() - interval '7 weeks', now(), interval '1 week') as gs
  ) weekly;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'total_workspaces', (select count(*) from public.workspaces where deleted_at is null),
    'deleted_workspaces', (select count(*) from public.workspaces where deleted_at is not null and purged_at is null),
    'purged_workspaces', (select count(*) from public.workspaces where purged_at is not null),
    'pending_recovery_requests', (select count(*) from public.workspace_recovery_requests where status = 'pending'),
    'workspaces_created_last_30_days', (select count(*) from public.workspaces where created_at >= now() - interval '30 days'),
    'weekly_growth', growth
  ) into result;

  return result;
end;
$$;

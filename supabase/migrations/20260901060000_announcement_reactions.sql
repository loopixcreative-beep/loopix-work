-- Emoji reactions on announcement messages. A user can react with several
-- different emoji on the same message, but only once each (the unique
-- constraint) — clicking an emoji you've already used removes it (handled
-- client-side as a toggle: insert if absent, delete if present).
create table public.announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.announcement_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index announcement_reactions_message_id_idx on public.announcement_reactions (message_id);

alter table public.announcement_reactions enable row level security;

create policy "Workspace members can view reactions"
  on public.announcement_reactions for select
  using (exists (
    select 1 from public.announcement_messages am
    where am.id = announcement_reactions.message_id and am.workspace_id = public.current_workspace_id()
  ));

create policy "Workspace members can react to messages"
  on public.announcement_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.announcement_messages am
      where am.id = announcement_reactions.message_id and am.workspace_id = public.current_workspace_id()
    )
  );

create policy "Users can remove their own reactions"
  on public.announcement_reactions for delete
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.announcement_reactions;
alter table public.announcement_reactions replica identity full;

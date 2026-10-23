create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('Phoenix', 'Mount Edgecombe', 'Verulam', 'Durban North')),
  message text not null check (char_length(message) between 1 and 300),
  display_name text not null default 'Neighbour' check (char_length(display_name) between 2 and 32),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists community_messages_area_created_at_idx
  on public.community_messages (area, created_at desc);

alter table public.community_messages enable row level security;
grant select, insert, delete on public.community_messages to authenticated;

create policy "Community can read chat messages"
  on public.community_messages for select to authenticated
  using (true);

create policy "Anonymous neighbours can send chat messages"
  on public.community_messages for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
  );

create policy "Authors can delete their own chat messages"
  on public.community_messages for delete to authenticated
  using (created_by = (select auth.uid()));

alter publication supabase_realtime add table public.community_messages;

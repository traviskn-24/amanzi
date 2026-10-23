create table if not exists public.water_updates (
  id uuid primary key default gen_random_uuid(),
  area text not null check (char_length(area) between 2 and 80),
  message text not null check (char_length(message) between 8 and 180),
  display_name text not null default 'Neighbour' check (char_length(display_name) between 2 and 32),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists water_updates_area_created_at_idx
  on public.water_updates (area, created_at desc);

alter table public.water_updates enable row level security;
grant select, insert, update, delete on public.water_updates to authenticated;

create policy "Community can read water updates"
  on public.water_updates for select to authenticated
  using (true);

create policy "Anonymous neighbours can post updates"
  on public.water_updates for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
  );

create policy "Authors can edit their own updates"
  on public.water_updates for update to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
  );

create policy "Authors can delete their own updates"
  on public.water_updates for delete to authenticated
  using (created_by = (select auth.uid()));

create table if not exists public.update_confirmations (
  update_id uuid not null references public.water_updates(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (update_id, user_id)
);

alter table public.update_confirmations enable row level security;
grant select, insert, delete on public.update_confirmations to authenticated;

create policy "Community can read confirmations"
  on public.update_confirmations for select to authenticated
  using (true);

create policy "Anonymous neighbours can confirm once"
  on public.update_confirmations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
  );

create policy "Neighbours can remove their own confirmation"
  on public.update_confirmations for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.water_updates;
alter publication supabase_realtime add table public.update_confirmations;

-- A slot-based schema enforces a strict three-area maximum for each account:
-- each user can occupy only slots 1, 2, and 3, with one row per slot.
create table public.user_areas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  area text not null check (char_length(btrim(area)) between 2 and 80),
  municipality text not null check (char_length(btrim(municipality)) between 2 and 100),
  province text not null check (province in (
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
    'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
  )),
  created_at timestamptz not null default now(),
  primary key (user_id, slot)
);

create unique index user_areas_unique_location
  on public.user_areas (
    user_id,
    lower(area),
    lower(municipality),
    lower(province)
  );

comment on table public.user_areas is
  'Account-owned community areas. Slots 1 through 3 enforce a maximum of three saved areas per user.';

alter table public.user_areas enable row level security;
revoke all on public.user_areas from anon;
grant select, insert, update, delete on public.user_areas to authenticated;

create policy "Users can read their own saved areas"
  on public.user_areas for select to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );

create policy "Users can insert their own saved areas"
  on public.user_areas for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );

create policy "Users can update their own saved areas"
  on public.user_areas for update to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  )
  with check (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );

create policy "Users can delete their own saved areas"
  on public.user_areas for delete to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );

create policy "Saved areas require verified MFA sessions"
  on public.user_areas as restrictive for all to authenticated
  using (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

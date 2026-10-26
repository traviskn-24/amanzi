create table if not exists public.demo_water_updates (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  area text not null,
  municipality text not null,
  province text not null,
  message text not null check (char_length(message) between 8 and 180),
  water_status text not null check (water_status in ('no_water', 'low_pressure', 'restored')),
  created_at timestamptz not null default now()
);

alter table public.demo_water_updates enable row level security;
drop policy if exists "Anyone can read sample water updates" on public.demo_water_updates;
create policy "Anyone can read sample water updates"
  on public.demo_water_updates for select to anon, authenticated using (true);
grant select on public.demo_water_updates to anon, authenticated;

insert into public.demo_water_updates (username, area, municipality, province, message, water_status, created_at)
values
  ('tapwatcher', 'Phoenix', 'eThekwini', 'KwaZulu-Natal', 'Example: no water reported near the community centre this morning.', 'no_water', now() - interval '18 minutes'),
  ('bluebucket', 'Phoenix', 'eThekwini', 'KwaZulu-Natal', 'Example: water pressure is lower than usual in our street.', 'low_pressure', now() - interval '47 minutes'),
  ('flowfinder', 'Phoenix', 'eThekwini', 'KwaZulu-Natal', 'Example: water has returned near the local shops.', 'restored', now() - interval '2 hours'),
  ('amanzi_lee', 'Phoenix', 'eThekwini', 'KwaZulu-Natal', 'Example: taps are dry around the upper part of the area.', 'no_water', now() - interval '4 hours'),
  ('waterwise_k', 'Phoenix', 'eThekwini', 'KwaZulu-Natal', 'Example: low pressure reported close to the main road.', 'low_pressure', now() - interval '7 hours'),
  ('neighbour_nia', 'Phoenix', 'eThekwini', 'KwaZulu-Natal', 'Example: service appears to be back after an interruption.', 'restored', now() - interval '1 day'),
  ('tapcheck_t', 'Phoenix', 'eThekwini', 'KwaZulu-Natal', 'Example: no water reported in this section of the area.', 'no_water', now() - interval '3 days'),
  ('clearflow_s', 'Phoenix', 'eThekwini', 'KwaZulu-Natal', 'Example: pressure is improving but still weaker than usual.', 'low_pressure', now() - interval '1 week')
on conflict (username) do update set
  area = excluded.area,
  municipality = excluded.municipality,
  province = excluded.province,
  message = excluded.message,
  water_status = excluded.water_status,
  created_at = excluded.created_at;

create policy amanzi_write_guard_water_ins
  on public.water_updates as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));
create policy amanzi_write_guard_water_upd
  on public.water_updates as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));
create policy amanzi_write_guard_water_del
  on public.water_updates as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));

create policy amanzi_write_guard_confirm_ins
  on public.update_confirmations as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));
create policy amanzi_write_guard_confirm_del
  on public.update_confirmations as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));

create policy amanzi_write_guard_chat_ins
  on public.community_messages as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));
create policy amanzi_write_guard_chat_del
  on public.community_messages as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));

create policy amanzi_write_guard_areas_ins
  on public.user_areas as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));
create policy amanzi_write_guard_areas_upd
  on public.user_areas as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));
create policy amanzi_write_guard_areas_del
  on public.user_areas as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));

create policy amanzi_write_guard_profiles_upd
  on public.profiles as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
  ));

create or replace function public.set_default_user_area(p_slot smallint)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in to choose a default area' using errcode = '28000';
  end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2'
    or v_user_id in (
      'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
      '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
      '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid
    ) then
    raise exception 'This account cannot modify saved areas' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_areas where user_id = v_user_id and slot = p_slot) then
    raise exception 'Saved area not found' using errcode = '22023';
  end if;
  update public.user_areas set is_default = false where user_id = v_user_id and is_default;
  update public.user_areas set is_default = true where user_id = v_user_id and slot = p_slot;
end;
$function$;

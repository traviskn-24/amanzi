drop policy if exists amanzi_write_guard_water_ins on public.water_updates;

create policy amanzi_write_guard_water_ins on public.water_updates as restrictive for insert to authenticated with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_water_upd on public.water_updates;

create policy amanzi_write_guard_water_upd on public.water_updates as restrictive for update to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  )) with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_water_del on public.water_updates;

create policy amanzi_write_guard_water_del on public.water_updates as restrictive for delete to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_confirm_ins on public.update_confirmations;

create policy amanzi_write_guard_confirm_ins on public.update_confirmations as restrictive for insert to authenticated with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_confirm_del on public.update_confirmations;

create policy amanzi_write_guard_confirm_del on public.update_confirmations as restrictive for delete to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_chat_ins on public.community_messages;

create policy amanzi_write_guard_chat_ins on public.community_messages as restrictive for insert to authenticated with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_chat_del on public.community_messages;

create policy amanzi_write_guard_chat_del on public.community_messages as restrictive for delete to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_areas_ins on public.user_areas;

create policy amanzi_write_guard_areas_ins on public.user_areas as restrictive for insert to authenticated with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_areas_upd on public.user_areas;

create policy amanzi_write_guard_areas_upd on public.user_areas as restrictive for update to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  )) with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_areas_del on public.user_areas;

create policy amanzi_write_guard_areas_del on public.user_areas as restrictive for delete to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  ));

drop policy if exists amanzi_write_guard_profiles_upd on public.profiles;

create policy amanzi_write_guard_profiles_upd on public.profiles as restrictive for update to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  )) with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
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
    or v_user_id in ('acf99f34-9764-40a8-a313-f04af91137d6'::uuid, '79f112af-d8bc-4788-a992-56c85298123c'::uuid, '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid, '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid) then
    raise exception 'This account cannot modify saved areas' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_areas where user_id = v_user_id and slot = p_slot) then
    raise exception 'Saved area not found' using errcode = '22023';
  end if;
  update public.user_areas set is_default = false where user_id = v_user_id and is_default;
  update public.user_areas set is_default = true where user_id = v_user_id and slot = p_slot;
end;
$function$;

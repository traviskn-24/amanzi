alter table public.user_areas
  add column is_default boolean not null default false;

with ranked_areas as (
  select user_id, slot, row_number() over (partition by user_id order by slot) as position
  from public.user_areas
)
update public.user_areas as user_area
set is_default = (ranked_areas.position = 1)
from ranked_areas
where user_area.user_id = ranked_areas.user_id
  and user_area.slot = ranked_areas.slot;

create unique index user_areas_one_default_per_user_idx
  on public.user_areas (user_id)
  where is_default;

create or replace function public.set_default_user_area(p_slot smallint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in to choose a default area' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.user_areas
    where user_id = v_user_id and slot = p_slot
  ) then
    raise exception 'Saved area not found' using errcode = '22023';
  end if;

  update public.user_areas
  set is_default = false
  where user_id = v_user_id and is_default;

  update public.user_areas
  set is_default = true
  where user_id = v_user_id and slot = p_slot;
end;
$$;

revoke all on function public.set_default_user_area(smallint) from public;
revoke all on function public.set_default_user_area(smallint) from anon;
grant execute on function public.set_default_user_area(smallint) to authenticated;

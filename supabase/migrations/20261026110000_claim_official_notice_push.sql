create or replace function public.claim_official_notice_push(p_notice_id uuid, p_revision integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id bigint;
  v_status text;
  v_created_at timestamptz;
begin
  insert into public.official_notice_push_events (notice_id, revision, status, created_at)
  values (p_notice_id, p_revision, 'processing', now())
  on conflict (notice_id, revision) do nothing
  returning id into v_id;

  if v_id is not null then return true; end if;

  select id, status, created_at into v_id, v_status, v_created_at
  from public.official_notice_push_events
  where notice_id = p_notice_id and revision = p_revision
  for update;

  if not found or v_status = 'sent' then return false; end if;
  if v_status = 'processing' and v_created_at > now() - interval '2 minutes' then return false; end if;

  update public.official_notice_push_events
  set status = 'processing', delivered_count = 0, failed_count = 0, created_at = now(), completed_at = null
  where id = v_id;
  return true;
end;
$function$;

revoke all on function public.claim_official_notice_push(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_official_notice_push(uuid, integer) to service_role;

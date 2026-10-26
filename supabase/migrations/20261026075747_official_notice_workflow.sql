create table if not exists public.notice_publishers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  publisher_label text not null check (char_length(publisher_label) between 2 and 80),
  organization_name text not null check (char_length(organization_name) between 2 and 120),
  role text not null check (role in ('authority', 'demo')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.official_notices (
  id uuid primary key default gen_random_uuid(),
  authority_name text not null check (char_length(authority_name) between 2 and 120),
  publisher_label text not null check (char_length(publisher_label) between 2 and 80),
  title text not null check (char_length(title) between 6 and 160),
  summary text not null check (char_length(summary) between 20 and 1500),
  source_url text not null check (source_url ~ '^https://'),
  source_published_at timestamptz,
  last_checked_at timestamptz not null default now(),
  status text not null check (status in ('draft', 'active', 'updated', 'cleared', 'needs_recheck')),
  is_demo boolean not null default false,
  published_by uuid not null references auth.users(id),
  published_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.official_notice_areas (
  id bigint generated always as identity primary key,
  notice_id uuid not null references public.official_notices(id) on delete cascade,
  area text not null check (char_length(area) between 2 and 80),
  municipality text not null check (char_length(municipality) between 2 and 100),
  province text not null check (province in ('Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape')),
  unique (notice_id, area, municipality, province)
);

create table if not exists public.official_notice_history (
  id bigint generated always as identity primary key,
  notice_id uuid not null references public.official_notices(id) on delete cascade,
  revision integer not null,
  status text not null check (status in ('active', 'updated', 'cleared', 'needs_recheck')),
  summary text not null,
  source_url text not null check (source_url ~ '^https://'),
  source_published_at timestamptz,
  changed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (notice_id, revision)
);

create table if not exists public.official_notice_email_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.official_notice_email_deliveries (
  id bigint generated always as identity primary key,
  notice_id uuid not null references public.official_notices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null,
  status text not null check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notice_id, user_id, revision)
);

create index if not exists official_notices_status_updated_idx on public.official_notices(status, updated_at desc);
create index if not exists official_notice_areas_location_idx on public.official_notice_areas(area, municipality, province);
create index if not exists official_notice_email_deliveries_notice_idx on public.official_notice_email_deliveries(notice_id, revision);

alter table public.notice_publishers enable row level security;
alter table public.official_notices enable row level security;
alter table public.official_notice_areas enable row level security;
alter table public.official_notice_history enable row level security;
alter table public.official_notice_email_subscriptions enable row level security;
alter table public.official_notice_email_deliveries enable row level security;

drop policy if exists notice_publishers_read_self on public.notice_publishers;
create policy notice_publishers_read_self on public.notice_publishers for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists official_notices_public_read on public.official_notices;
create policy official_notices_public_read on public.official_notices for select to anon, authenticated using (status <> 'draft');

drop policy if exists official_notice_areas_public_read on public.official_notice_areas;
create policy official_notice_areas_public_read on public.official_notice_areas for select to anon, authenticated using (
  exists (select 1 from public.official_notices n where n.id = notice_id and n.status <> 'draft')
);

drop policy if exists official_notice_history_public_read on public.official_notice_history;
create policy official_notice_history_public_read on public.official_notice_history for select to anon, authenticated using (
  exists (select 1 from public.official_notices n where n.id = notice_id and n.status <> 'draft')
);

grant select on public.official_notices, public.official_notice_areas, public.official_notice_history to anon, authenticated;
grant select on public.notice_publishers to authenticated;

insert into public.notice_publishers (user_id, publisher_label, organization_name, role, active)
select id, 'Judge demo publisher', 'Amanzi demo workspace', 'demo', true
from auth.users
where lower(email) in ('amanzi.judge4@example.com', 'amanzi.judge5@example.com', 'amanzi.judge6@example.com', 'amanzi.judge7@example.com')
on conflict (user_id) do nothing;

create or replace function public.publish_official_notice(
  p_title text,
  p_summary text,
  p_source_url text,
  p_source_published_at timestamptz,
  p_area text,
  p_municipality text,
  p_province text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_publisher public.notice_publishers%rowtype;
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to publish a notice' using errcode = '28000'; end if;
  select * into v_publisher from public.notice_publishers where user_id = v_user and active;
  if not found then raise exception 'This account is not approved to publish notices' using errcode = '42501'; end if;
  if v_publisher.role = 'authority' and (select auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'Verified two-step sign-in is required to publish official notices' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 6 and 160 then raise exception 'Enter a notice title between 6 and 160 characters' using errcode = '22023'; end if;
  if p_summary is null or char_length(btrim(p_summary)) not between 20 and 1500 then raise exception 'Enter a summary between 20 and 1500 characters' using errcode = '22023'; end if;
  if p_source_url is null or p_source_url !~ '^https://' then raise exception 'Provide the official source URL using https' using errcode = '22023'; end if;
  if p_area is null or char_length(btrim(p_area)) not between 2 and 80 or p_municipality is null or char_length(btrim(p_municipality)) not between 2 and 100 then raise exception 'Enter a valid affected area and municipality' using errcode = '22023'; end if;
  if p_province not in ('Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape') then raise exception 'Choose a valid province' using errcode = '22023'; end if;

  insert into public.official_notices (authority_name, publisher_label, title, summary, source_url, source_published_at, status, is_demo, published_by, published_at)
  values (v_publisher.organization_name, v_publisher.publisher_label, btrim(p_title), btrim(p_summary), btrim(p_source_url), p_source_published_at, 'active', v_publisher.role = 'demo', v_user, now())
  returning id into v_id;
  insert into public.official_notice_areas (notice_id, area, municipality, province)
  values (v_id, btrim(p_area), btrim(p_municipality), p_province);
  insert into public.official_notice_history (notice_id, revision, status, summary, source_url, source_published_at, changed_by)
  values (v_id, 1, 'active', btrim(p_summary), btrim(p_source_url), p_source_published_at, v_user);
  return jsonb_build_object('id', v_id, 'revision', 1, 'is_demo', v_publisher.role = 'demo');
end;
$function$;

create or replace function public.update_official_notice(
  p_notice_id uuid,
  p_status text,
  p_summary text,
  p_source_url text,
  p_source_published_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_publisher public.notice_publishers%rowtype;
  v_notice public.official_notices%rowtype;
begin
  if v_user is null then raise exception 'Sign in to update a notice' using errcode = '28000'; end if;
  select * into v_publisher from public.notice_publishers where user_id = v_user and active;
  if not found then raise exception 'This account is not approved to update notices' using errcode = '42501'; end if;
  if v_publisher.role = 'authority' and (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'Verified two-step sign-in is required to update official notices' using errcode = '42501'; end if;
  select * into v_notice from public.official_notices where id = p_notice_id for update;
  if not found or v_notice.published_by <> v_user or v_notice.is_demo <> (v_publisher.role = 'demo') then raise exception 'This publisher cannot change that notice' using errcode = '42501'; end if;
  if p_status not in ('active', 'updated', 'cleared', 'needs_recheck') then raise exception 'Choose a valid notice status' using errcode = '22023'; end if;
  if p_summary is null or char_length(btrim(p_summary)) not between 20 and 1500 then raise exception 'Enter an update between 20 and 1500 characters' using errcode = '22023'; end if;
  if p_source_url is null or p_source_url !~ '^https://' then raise exception 'Provide the official source URL using https' using errcode = '22023'; end if;
  update public.official_notices set status = p_status, summary = btrim(p_summary), source_url = btrim(p_source_url), source_published_at = p_source_published_at, last_checked_at = now(), revision = revision + 1, updated_at = now() where id = p_notice_id returning * into v_notice;
  insert into public.official_notice_history (notice_id, revision, status, summary, source_url, source_published_at, changed_by)
  values (v_notice.id, v_notice.revision, v_notice.status, v_notice.summary, v_notice.source_url, v_notice.source_published_at, v_user);
  return jsonb_build_object('id', v_notice.id, 'revision', v_notice.revision, 'is_demo', v_notice.is_demo);
end;
$function$;

revoke all on function public.publish_official_notice(text, text, text, timestamptz, text, text, text) from public;
revoke all on function public.update_official_notice(uuid, text, text, text, timestamptz) from public;
grant execute on function public.publish_official_notice(text, text, text, timestamptz, text, text, text) to authenticated;
grant execute on function public.update_official_notice(uuid, text, text, text, timestamptz) to authenticated;

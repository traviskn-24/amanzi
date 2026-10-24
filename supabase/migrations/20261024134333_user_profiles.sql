begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,20}$'
  )
);

create unique index profiles_username_unique
  on public.profiles (username)
  where username is not null;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

create policy "Public can read usernames"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can update their own username"
  on public.profiles for update
  to authenticated
  using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  )
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

create or replace function private.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
begin
  if requested_username !~ '^[a-z0-9_]{3,20}$' then
    requested_username := null;
  end if;

  if tg_op = 'UPDATE' then
    if requested_username is not null then
      update public.profiles
      set username = requested_username, updated_at = now()
      where user_id = new.id and username is null;
    end if;
    return new;
  end if;

  insert into public.profiles (user_id, username)
  values (new.id, requested_username)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user_profile() from public, anon, authenticated;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function private.handle_new_auth_user_profile();

create trigger on_auth_user_metadata_updated_sync_username
  after update of raw_user_meta_data on auth.users
  for each row execute function private.handle_new_auth_user_profile();

with candidates as (
  select
    id,
    lower(btrim(raw_user_meta_data ->> 'username')) as username,
    count(*) over (partition by lower(btrim(raw_user_meta_data ->> 'username'))) as username_count
  from auth.users
  where nullif(btrim(raw_user_meta_data ->> 'username'), '') is not null
),
backfill as (
  select
    users.id as user_id,
    case
      when candidates.username ~ '^[a-z0-9_]{3,20}$' and candidates.username_count = 1
        then candidates.username
      else null
    end as username
  from auth.users as users
  left join candidates on candidates.id = users.id
)
insert into public.profiles (user_id, username)
select user_id, username from backfill
on conflict (user_id) do nothing;

commit;

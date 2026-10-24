create or replace function private.contains_blocked_language(input_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  token text;
  normalized_token text;
  blocked_term text;
  blocked_terms constant text[] := array[
    'ashole', 'bastard', 'bitch', 'bolocks', 'cock', 'coksucker', 'cunt',
    'dick', 'dickhead', 'fag', 'fagot', 'fuck', 'fucker', 'fucking',
    'motherfucker', 'niger', 'nigga', 'pis', 'prick', 'pusy', 'shit',
    'shity', 'slut', 'twat', 'wanker', 'whore'
  ];
begin
  foreach token in array regexp_split_to_array(coalesce(input_text, ''), '[[:space:]]+') loop
    normalized_token := lower(translate(
      token,
      '013457@$!áàâäãåéèêëíìîïóòôöõúùûüýÿçñ',
      'oieastasi' || 'aaaaaaeeeeiiiiooooouuuuyycn'
    ));
    normalized_token := regexp_replace(normalized_token, '[^a-z0-9]', '', 'g');
    normalized_token := regexp_replace(normalized_token, '(.)\1+', '\1', 'g');

    foreach blocked_term in array blocked_terms loop
      if normalized_token = blocked_term then
        return true;
      end if;
    end loop;
  end loop;

  return false;
end;
$$;

revoke all on function private.contains_blocked_language(text) from public, anon, authenticated;

create or replace function private.reject_blocked_community_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    if private.contains_blocked_language(new.username) then
      raise exception using
        errcode = 'check_violation',
        message = 'That username contains language Amanzi does not allow. Choose a different username.';
    end if;
  elsif private.contains_blocked_language(new.message) then
    raise exception using
      errcode = 'check_violation',
      message = 'Your message contains language Amanzi does not allow. Please edit it and try again.';
  elsif private.contains_blocked_language(new.display_name) then
    raise exception using
      errcode = 'check_violation',
      message = 'That username contains language Amanzi does not allow. Choose a different username.';
  end if;

  return new;
end;
$$;

create trigger reject_blocked_profile_username
  before insert or update of username on public.profiles
  for each row execute function private.reject_blocked_community_content();

create trigger reject_blocked_community_message
  before insert or update of message, display_name on public.community_messages
  for each row execute function private.reject_blocked_community_content();

create or replace function private.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
begin
  if private.contains_blocked_language(requested_username) then
    raise exception using
      errcode = 'check_violation',
      message = 'That username contains language Amanzi does not allow. Choose a different username.';
  end if;

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
revoke all on function private.reject_blocked_community_content() from public, anon, authenticated;

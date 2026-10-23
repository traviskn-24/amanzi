alter table public.water_updates
  add column municipality text not null default 'eThekwini'
    check (char_length(municipality) between 2 and 100),
  add column province text not null default 'KwaZulu-Natal'
    check (province in (
      'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
      'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
    ));

alter table public.community_messages
  drop constraint if exists community_messages_area_check,
  add constraint community_messages_area_check
    check (char_length(area) between 2 and 80),
  add column municipality text not null default 'eThekwini'
    check (char_length(municipality) between 2 and 100),
  add column province text not null default 'KwaZulu-Natal'
    check (province in (
      'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
      'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
    ));

create index if not exists water_updates_community_area_created_at_idx
  on public.water_updates (province, municipality, area, created_at desc);

create index if not exists community_messages_community_area_created_at_idx
  on public.community_messages (province, municipality, area, created_at desc);

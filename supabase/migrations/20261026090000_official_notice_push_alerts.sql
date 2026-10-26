alter table public.push_subscriptions
  add column if not exists alert_official_notices boolean not null default false;

create table if not exists public.official_notice_push_events (
  id bigint generated always as identity primary key,
  notice_id uuid not null references public.official_notices(id) on delete cascade,
  revision integer not null check (revision > 0),
  status text not null check (status in ('processing', 'sent', 'failed')),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (notice_id, revision)
);

create index if not exists official_notice_push_events_notice_idx
  on public.official_notice_push_events(notice_id, revision desc);

alter table public.official_notice_push_events enable row level security;
revoke all on public.official_notice_push_events from public, anon, authenticated;
grant all on public.official_notice_push_events to service_role;

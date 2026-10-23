create table public.push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%' and char_length(endpoint) <= 2048),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 40 and 200),
  auth_key text not null check (char_length(auth_key) between 16 and 100),
  alert_outages boolean not null default true,
  alert_restorations boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'Private browser push endpoints, owned by one account and sent alerts only for the account’s saved areas.';
comment on column public.push_subscriptions.endpoint is
  'Browser-issued push endpoint. Treat as a private delivery capability and never expose to other users.';
comment on column public.push_subscriptions.auth_key is
  'Browser push subscription authentication material; readable only by its owner and trusted server functions.';

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create policy "Users can read their own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "Users can create their own push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create table public.push_alert_events (
  water_update_id uuid primary key references public.water_updates (id) on delete cascade,
  event_type text not null check (event_type in ('outage', 'restoration')),
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.push_alert_events is
  'Server-only idempotency records preventing repeat pushes for the same water update.';

alter table public.push_alert_events enable row level security;
revoke all on public.push_alert_events from public, anon, authenticated;
grant all on public.push_alert_events to service_role;

create table public.water_delivery_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 100),
  phone text not null check (char_length(btrim(phone)) between 7 and 32),
  delivery_area text not null check (char_length(btrim(delivery_area)) between 1 and 160),
  delivery_address text not null check (char_length(btrim(delivery_address)) between 1 and 300),
  litres integer not null check (litres between 1 and 20000),
  water_cost numeric(12,2) not null check (water_cost >= 0),
  delivery_rate numeric(5,2) not null check (delivery_rate >= 0),
  delivery_cost numeric(12,2) not null check (delivery_cost >= 0),
  estimated_vat numeric(12,2) not null check (estimated_vat >= 0),
  estimated_total numeric(12,2) not null check (estimated_total >= 0),
  status text not null default 'awaiting_supplier_confirmation'
    check (status in ('awaiting_supplier_confirmation', 'supplier_confirmed', 'out_for_delivery', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.water_delivery_requests enable row level security;
grant select, insert on public.water_delivery_requests to authenticated;

create policy water_delivery_requests_read_own
  on public.water_delivery_requests for select to authenticated
  using ((select auth.uid()) = customer_id);

create policy water_delivery_requests_insert_own
  on public.water_delivery_requests as restrictive for insert to authenticated
  with check (
    (select auth.uid()) = customer_id
    and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and (select auth.uid()) not in (
      'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
      '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
      '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
      '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
    )
  );

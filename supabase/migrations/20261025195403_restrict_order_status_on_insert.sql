alter policy water_delivery_requests_insert_own
on public.water_delivery_requests
with check (
  (select auth.uid()) = customer_id
  and status = 'awaiting_supplier_confirmation'
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and (select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.uid()) not in (
    'acf99f34-9764-40a8-a313-f04af91137d6'::uuid,
    '79f112af-d8bc-4788-a992-56c85298123c'::uuid,
    '47e1ffbb-f17d-423d-b4e7-56db3ad3667d'::uuid,
    '12e1f29b-e681-489d-8a93-a0becd6c5f22'::uuid
  )
);

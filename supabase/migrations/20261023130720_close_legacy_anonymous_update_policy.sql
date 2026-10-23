drop policy if exists "Account holders can edit their own updates" on public.water_updates;
create policy "Account holders can edit their own updates"
  on public.water_updates for update to authenticated
  using (
    created_by = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  )
  with check (
    created_by = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );

-- Let logged-out visitors read public community information using the anon role.
-- Anonymous Auth users also receive the authenticated role, so they must not be
-- treated as trusted account holders by policies on exposed tables.
grant select on public.water_updates, public.update_confirmations, public.community_messages to anon;

drop policy if exists "Community can read water updates" on public.water_updates;
create policy "Public can read water updates"
  on public.water_updates for select to anon
  using (true);
create policy "Registered users can read water updates"
  on public.water_updates for select to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "Community can read confirmations" on public.update_confirmations;
create policy "Public can read confirmations"
  on public.update_confirmations for select to anon
  using (true);
create policy "Registered users can read confirmations"
  on public.update_confirmations for select to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "Neighbours can read community messages" on public.community_messages;
create policy "Public can read community messages"
  on public.community_messages for select to anon
  using (true);
create policy "Registered users can read community messages"
  on public.community_messages for select to authenticated
  using (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

drop policy if exists "Authors can delete their own updates" on public.water_updates;
create policy "Registered authors can delete their own updates"
  on public.water_updates for delete to authenticated
  using (
    created_by = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );

drop policy if exists "Neighbours can remove their own confirmation" on public.update_confirmations;
create policy "Registered users can remove their own confirmation"
  on public.update_confirmations for delete to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );

drop policy if exists "Authors can delete their own community messages" on public.community_messages;
create policy "Registered authors can delete their own community messages"
  on public.community_messages for delete to authenticated
  using (
    created_by = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );

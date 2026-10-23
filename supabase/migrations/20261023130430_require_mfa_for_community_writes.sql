-- Community reads remain available to authenticated guest sessions, but any
-- mutation requires a registered user whose current JWT reflects verified MFA.

drop policy if exists "Anonymous neighbours can post updates" on public.water_updates;
create policy "Account holders can post updates"
  on public.water_updates for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );
create policy "Water updates require verified MFA for insert"
  on public.water_updates as restrictive for insert to authenticated
  with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Authors can edit their own updates" on public.water_updates;
create policy "Account holders can edit their own updates"
  on public.water_updates for update to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );
create policy "Water updates require verified MFA for update"
  on public.water_updates as restrictive for update to authenticated
  using (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );
create policy "Water updates require verified MFA for delete"
  on public.water_updates as restrictive for delete to authenticated
  using (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Anonymous neighbours can confirm once" on public.update_confirmations;
create policy "Account holders can confirm once"
  on public.update_confirmations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );
create policy "Confirmations require verified MFA for insert"
  on public.update_confirmations as restrictive for insert to authenticated
  with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );
create policy "Confirmations require verified MFA for delete"
  on public.update_confirmations as restrictive for delete to authenticated
  using (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists "Anonymous neighbours can send area messages" on public.community_messages;
create policy "Account holders can send area messages"
  on public.community_messages for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );
create policy "Community messages require verified MFA for insert"
  on public.community_messages as restrictive for insert to authenticated
  with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );
create policy "Community messages require verified MFA for delete"
  on public.community_messages as restrictive for delete to authenticated
  using (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- Run AFTER signing up via /admin/.
-- 1. Find your UID: Supabase dashboard → Authentication → Users → click your row.
-- 2. Replace the literal below with that UID.
-- 3. Paste into the SQL editor and run.

drop policy if exists wishlist_admin_all on public.wishlist_items;

create policy wishlist_admin_all
  on public.wishlist_items
  for all
  to authenticated
  using (auth.uid() = '895f6ecf-689f-404e-9bf4-2ac1580d0020'::uuid)
  with check (auth.uid() = '895f6ecf-689f-404e-9bf4-2ac1580d0020'::uuid);

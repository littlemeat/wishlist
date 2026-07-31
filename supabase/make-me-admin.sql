-- Zapne admin práva pro jedno konkrétní UUID. Spusť po setup.sql.
--
-- Uživatel se NEregistruje na /admin/ — ta stránka umí jen přihlášení. Účet
-- vytvoř v Supabase dashboard → Authentication → Users → Add user →
-- Create new user (zaškrtni Auto Confirm User).
--
-- 1. Najdi UID: Authentication → Users → klikni na svůj řádek.
-- 2. Přepiš literál níž tím UID (je na dvou místech).
-- 3. Vlož do SQL editoru a spusť.
--
-- UUID níž je Mariino. Nová instance ho musí přepsat, jinak nikdo nebude admin.
-- Spusť tenhle soubor znovu i po každém opakovaném spuštění setup.sql.

drop policy if exists wishlist_admin_all on public.wishlist_items;

create policy wishlist_admin_all
  on public.wishlist_items
  for all
  to authenticated
  using (auth.uid() = '895f6ecf-689f-404e-9bf4-2ac1580d0020'::uuid)
  with check (auth.uid() = '895f6ecf-689f-404e-9bf4-2ac1580d0020'::uuid);

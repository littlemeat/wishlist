-- Soft delete migration. Run once v Supabase SQL editoru.
-- Po spuštění bude tlačítko „Smazat" v adminu mazat měkce — položka zmizí
-- z veřejné stránky, ale v DB zůstane a v adminu jde obnovit přes „Zobrazit smazané".

alter table public.wishlist_items
  add column if not exists deleted_at timestamptz default null;

-- Index pomáhá s filtrováním smazaných v každém SELECT.
create index if not exists wishlist_items_deleted_at_idx
  on public.wishlist_items (deleted_at);

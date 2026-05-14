-- Marie chce — Supabase setup
-- Paste into the Supabase SQL editor and run once.

create extension if not exists pgcrypto;

create table if not exists public.wishlist_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  link          text,
  price_tier    text check (price_tier in ('€','€€','€€€')),
  image_url     text,
  tags          text[],
  note          text,
  variant       text,
  reserved      boolean not null default false,
  reserved_by   text,
  reserved_at   timestamptz,
  created_at    timestamptz not null default now(),
  position      int not null default 0
);

alter table public.wishlist_items enable row level security;

-- Anyone (including anon) can read.
drop policy if exists wishlist_select_all on public.wishlist_items;
create policy wishlist_select_all
  on public.wishlist_items
  for select
  using (true);

-- Admin policy is gated by UID, populated by make-me-admin.sql.
-- Until then the literal UID below matches no real user, so no one is admin.
drop policy if exists wishlist_admin_all on public.wishlist_items;
create policy wishlist_admin_all
  on public.wishlist_items
  for all
  to authenticated
  using (auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid)
  with check (auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid);

-- Belt-and-suspenders: deny direct writes from anon at the privilege level.
-- The only mutation path for visitors is toggle_reserved() below.
revoke insert, update, delete on public.wishlist_items from anon;
grant select on public.wishlist_items to anon;

-- Idempotent reservation toggle. SECURITY DEFINER bypasses RLS so it can flip
-- the reserved fields for an anon caller. It does ONLY that — no other writes.
create or replace function public.toggle_reserved(item_id uuid, by_name text)
returns public.wishlist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.wishlist_items;
  updated_row public.wishlist_items;
  clean_name  text;
begin
  select * into current_row from public.wishlist_items where id = item_id;
  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  if current_row.reserved then
    update public.wishlist_items
       set reserved    = false,
           reserved_by = null,
           reserved_at = null
     where id = item_id
     returning * into updated_row;
  else
    clean_name := nullif(btrim(coalesce(by_name, '')), '');
    update public.wishlist_items
       set reserved    = true,
           reserved_by = clean_name,
           reserved_at = now()
     where id = item_id
     returning * into updated_row;
  end if;

  return updated_row;
end;
$$;

revoke all on function public.toggle_reserved(uuid, text) from public;
grant execute on function public.toggle_reserved(uuid, text) to anon, authenticated;

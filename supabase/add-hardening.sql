-- Hardening pass. Run once v Supabase SQL editoru.
-- - DB length check pro reserved_by a check pro neprázdný title
-- - Composite index pro public query (deleted_at, reserved, position)
-- - Aktualizovaný toggle_reserved s ořezem reserved_by
-- - Nová admin_reorder RPC, která atomicky swapne pozici místo N+1 update z klienta.

-- Title nesmí být prázdný string.
alter table public.wishlist_items
  drop constraint if exists wishlist_items_title_not_blank;
alter table public.wishlist_items
  add constraint wishlist_items_title_not_blank
  check (length(btrim(title)) > 0);

-- reserved_by capnutý na 80 znaků (klient už má maxlength="80", tohle drží i přes RPC).
alter table public.wishlist_items
  drop constraint if exists wishlist_items_reserved_by_max_len;
alter table public.wishlist_items
  add constraint wishlist_items_reserved_by_max_len
  check (reserved_by is null or length(reserved_by) <= 80);

-- Index sedící na public query a sort.
create index if not exists wishlist_items_public_idx
  on public.wishlist_items (deleted_at, reserved, position);

-- Aktualizovat toggle_reserved — pojistka, aby reserved_by neprošlo nečištěný / přes 80.
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
    if clean_name is not null and length(clean_name) > 80 then
      clean_name := substring(clean_name from 1 for 80);
    end if;
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

-- Atomické přesouvání pozic. SECURITY INVOKER => RLS (wishlist_admin_all) hlídá,
-- že jen admin může update; anon to nevolá. Funkce přebije pozice spreadem po 10
-- v jednom UPDATE, takže žádné N+1 a žádné rozsypané state v půlce.
create or replace function public.admin_reorder(p_id uuid, p_direction int)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  ordered uuid[];
  curr_idx int;
  swap_idx int;
begin
  if p_direction not in (-1, 1) then
    raise exception 'p_direction must be -1 or 1';
  end if;

  select array_agg(id order by position, created_at)
    into ordered
    from public.wishlist_items;

  curr_idx := array_position(ordered, p_id);
  if curr_idx is null then
    return;
  end if;

  swap_idx := curr_idx + p_direction;
  if swap_idx < 1 or swap_idx > array_length(ordered, 1) then
    return;
  end if;

  -- Swap v poli.
  ordered[curr_idx] := ordered[swap_idx];
  ordered[swap_idx] := p_id;

  -- Single UPDATE: každý řádek dostane (idx * 10) jako novou position.
  update public.wishlist_items w
     set position = src.idx * 10
    from unnest(ordered) with ordinality as src(item_id, idx)
   where w.id = src.item_id;
end;
$$;

grant execute on function public.admin_reorder(uuid, int) to authenticated;

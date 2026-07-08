-- Keepalive zápisem. Run once v Supabase SQL editoru.
--
-- Proč: anonymní REST čtení se do Supabase "aktivity" nepočítá — projekt
-- v červnu zaspal pár hodin po úspěšném GET pingu. Zápis je jednoznačná
-- databázová aktivita, proto cron nově volá keepalive_ping(), která updatne
-- timestamp v téhle jednořádkové tabulce.

create table if not exists public.keepalive (
  id        boolean primary key default true check (id),  -- vynutí single row
  last_ping timestamptz not null default now()
);

insert into public.keepalive (id) values (true)
on conflict do nothing;

-- RLS bez policies: nikdo na tabulku nesahá přímo, jen definer funkce níž.
alter table public.keepalive enable row level security;

create or replace function public.keepalive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.keepalive set last_ping = now() where id returning last_ping;
$$;

revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, authenticated;

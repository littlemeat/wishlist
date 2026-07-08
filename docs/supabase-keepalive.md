# Jak udržet Supabase free-tier projekt vzhůru (keepalive návod)

Přenositelný návod. Funguje pro jakýkoli projekt: statický web + Supabase free tier + GitHub repo.

## Problém

Supabase free tier automaticky pausne projekt po ~7 dnech „bez aktivity". Dvě pasti, obě ověřené v praxi (červen–červenec 2026):

1. **Anonymní REST čtení se do aktivity nepočítá.** GET ping přes PostgREST s publishable klíčem vypadá jako aktivita, ale detektor pauz ho ignoruje — projekt zaspal pár hodin po úspěšném pingu. Do aktivity se počítá **zápis do databáze** (a práce v dashboardu).
2. **GitHub vypíná scheduled workflows po 60 dnech bez commitů v repu.** Hotový projekt bez commitů = cron potichu umře a projekt zaspí, i když byl workflow správně.

Řešení: denní cron, který **zapisuje** (RPC updatne timestamp), a který si sám hlídá 60denní GitHub limit prázdným commitem.

## Krok 1: SQL migrace

Spusť v Supabase SQL editoru (Dashboard → SQL Editor → New query → Run):

```sql
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
```

Očekávaný výsledek: `Success. No rows returned`.

## Krok 2: GitHub Actions workflow

Vytvoř `.github/workflows/keep-supabase-warm.yml`. Nahraď dva placeholdery:

- `YOUR-PROJECT-REF` — reference ID projektu (Project Settings → General)
- `YOUR-PUBLISHABLE-KEY` — publishable klíč (Project Settings → API Keys, začíná `sb_publishable_`)

Publishable klíč je bezpečný k veřejnému vystavení (chrání ho RLS), takže může být v YAML natvrdo. **Nikdy tam nedávej `service_role` ani `secret` klíč.** Pokud by ses přece jen cítila líp se secretem, dej klíč do repo Settings → Secrets and variables → Actions a referencuj `${{ secrets.SUPABASE_KEY }}`.

Poznámka: GET fallback níž předpokládá tabulku `keepalive` z kroku 1, takže funguje v každém projektu bez úprav — kdyby RPC neexistovala, aspoň ověří dostupnost.

```yaml
name: Keep Supabase warm

on:
  schedule:
    - cron: '0 7 * * *'  # každý den 07:00 UTC
  workflow_dispatch:  # ruční trigger z GitHub UI pro debug

permissions:
  contents: write  # kvůli keepalive commitu (krok 3)

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Write-ping Supabase (RPC keepalive_ping + GET fallback)
        env:
          SUPABASE_URL: https://YOUR-PROJECT-REF.supabase.co
          SUPABASE_KEY: YOUR-PUBLISHABLE-KEY
        run: |
          rpc=$(curl -s -o /tmp/rpc -w "%{http_code}" -X POST \
            -H "apikey: $SUPABASE_KEY" \
            -H "Content-Type: application/json" \
            -d '{}' \
            "$SUPABASE_URL/rest/v1/rpc/keepalive_ping")
          echo "RPC keepalive_ping: HTTP $rpc — $(cat /tmp/rpc)"
          if [ "$rpc" = "404" ]; then
            echo "::warning::keepalive_ping() v DB neexistuje — spusť SQL migraci (krok 1)"
          fi

          get=$(curl -s -o /tmp/get -w "%{http_code}" \
            -H "apikey: $SUPABASE_KEY" \
            "$SUPABASE_URL/rest/v1/keepalive?select=last_ping&limit=1")
          echo "REST read: HTTP $get"

          if [ "$rpc" != "200" ] && [ "$get" != "200" ]; then
            echo "::error::Supabase nedostupná (RPC $rpc, GET $get) — projekt nejspíš spí"
            exit 1
          fi

      - name: Checkout
        uses: actions/checkout@v4

      - name: Keepalive commit when repo idles too long
        run: |
          last_commit=$(git log -1 --format=%ct)
          now=$(date +%s)
          days=$(( (now - last_commit) / 86400 ))
          echo "Days since last commit: $days"
          if [ "$days" -ge 21 ]; then
            git config user.name "keep-warm-bot"
            git config user.email "actions@users.noreply.github.com"
            git commit --allow-empty -m "chore: keepalive — GitHub vypíná neaktivní crony po 60 dnech"
            git push
            echo "Keepalive commit pushed."
          else
            echo "Repo is active enough, no commit needed."
          fi
```

## Krok 3: Ověření

1. GitHub → Actions → „Keep Supabase warm" → **Run workflow** (ruční trigger).
2. V logu hledej `RPC keepalive_ping: HTTP 200 — "2026-…"` — vrácený timestamp znamená, že zápis proběhl.
3. Pokud vidíš `HTTP 404` + warning, migrace z kroku 1 neproběhla.

## Jak poznat, že to funguje dlouhodobě

- **Ticho v inboxu.** Žádné „your project is going to be paused" emaily.
- Warning email znamená, že poslední *započítaná* aktivita je 7+ dní stará. Pokud přijde i při běžícím write-pingu, detektor počítá jen dashboard návštěvy — pak zbývá jen Supabase Pro, nebo migrace (např. Neon má scale-to-zero s automatickým probuzením, žádné ruční resume).
- Cron **neumí probudit už pauznutý projekt** (subdoména přestane resolvovat — proto ten `::error` exit). Pauza = ruční resume v dashboardu, do 90 dnů.

## Poznámky

- GitHub Actions cron má drift — plánovaný čas je „nejdřív v", reálně běží o minuty až desítky minut později. Pro tento účel jedno.
- Frekvence denně je schválně konzervativní: threshold je ~7 dní, denní zápis dává velkou rezervu i při výpadku několika runů.
- Prázdný keepalive commit (1× za ~3 týdny) spustí rebuild GitHub Pages — no-op, neškodí.

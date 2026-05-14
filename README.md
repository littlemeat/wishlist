# Maruška by si přála…

Osobní wishlist Marie. Statické HTML/CSS/JS na GitHub Pages, Supabase jako backend.
Cizí lidi rezervují přes RPC bez přihlášení, já edituju přes `/admin/`.

Live: <https://littlemeat.github.io/wishlist/>

## Setup z čistého stavu

Návod pro budoucí mě (kdybych to chtěla rozjet jinde) nebo pro někoho, kdo si tenhle pattern chce ojet:

1. Založ projekt na [supabase.com](https://supabase.com).
2. V Supabase SQL editoru spusť `supabase/setup.sql` — vytvoří tabulku, RLS a `toggle_reserved()` funkci.
3. V Supabase → Authentication → Users → **Add user** → **Create new user**. Zaškrtni *Auto Confirm User*.
4. Zkopíruj UID nově vytvořeného uživatele.
5. V `supabase/make-me-admin.sql` přepiš UUID na své a spusť v SQL editoru.
6. V `js/config.js` vyplň `SUPABASE_URL` (Project Settings → Data API → URL) a `SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys → Publishable key).
7. Commitni a pushni na GitHub.
8. V repo Settings → Pages nastav Source = `Deploy from a branch`, branch = `main`, folder = `/` (root).
9. Po ~minutě bude live na `https://<user>.github.io/<repo>/`. Dárky přidáváš přes `/admin/`.

## Bezpečnostní model

- **Anon SELECT** je povolený — kdokoliv s linkem si seznam přečte.
- **Anon INSERT/UPDATE/DELETE** je zakázaný. Jediná cesta, jak host něco změní, je RPC `toggle_reserved(item_id, by_name)` s `SECURITY DEFINER`. Funkce flipne jen `reserved` / `reserved_by` / `reserved_at` na daném řádku — žádné jiné write.
- **Admin** (já) mám full CRUD přes RLS policy `wishlist_admin_all`, která se zapíná po spuštění `make-me-admin.sql` s mým UID.
- **Publishable key** je v repu schválně. Je z definice určený k použití v prohlížeči, ochranu obstarává RLS + ta jedna RPC funkce. Service-role key v repu **nikdy nemá co dělat**.

## Co se kde mění

- **Barvy a typografie:** `:root` blok v `css/style.css`. Zbytek stylu sahá jen na proměnné, takže redesign = editace toho jednoho bloku.
- **Hlavní titulek + rotující podtitul:** `<h1>` v `index.html` a `SUBTITLES` pole v `js/app.js`.
- **Logika rezervace:** `toggle_reserved()` v `supabase/setup.sql`. Idempotentní — druhé volání rezervaci zruší.
- **Admin UI:** `admin/index.html` + `js/admin.js`. Inline edit ukládá na blur, toast dole potvrzuje.

## Out of scope

Žádné npm, žádný bundler, žádné notifikace, žádné analytics, žádný image upload, žádný language toggle. Když by to chtělo, jde to jinam.

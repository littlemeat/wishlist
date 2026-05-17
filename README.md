# Maruška by si přála…

Osobní wishlist Marie. Statické HTML/CSS/JS na GitHub Pages, Supabase jako backend.
Cizí lidi rezervují přes RPC bez přihlášení, já edituju přes `/admin/`.

Live: <https://littlemeat.github.io/wishlist/>

## Setup z čistého stavu

Návod pro budoucí mě (kdybych to chtěla rozjet jinde) nebo pro někoho, kdo si tenhle pattern chce ojet:

1. Založ projekt na [supabase.com](https://supabase.com).
2. V Supabase SQL editoru spusť **`supabase/setup.sql`** — tabulka `wishlist_items`, RLS a `toggle_reserved()` funkce.
3. Spusť **`supabase/add-soft-delete.sql`** — přidá sloupec `deleted_at` pro soft delete.
4. Spusť **`supabase/add-hardening.sql`** — DB length / non-empty checky, composite index, atomické `admin_reorder()` RPC.
5. V Supabase → Authentication → Users → **Add user** → **Create new user**. Zaškrtni *Auto Confirm User*.
6. Zkopíruj UID nově vytvořeného uživatele.
7. V `supabase/make-me-admin.sql` přepiš UUID na své a spusť v SQL editoru.
8. V `js/config.js` vyplň `SUPABASE_URL` (Project Settings → Data API → URL) a `SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys → Publishable key).
9. **Authentication → URL Configuration**: Site URL = `https://<user>.github.io/<repo>/`, do Redirect URLs přidej `https://<user>.github.io/<repo>/admin/`. Bez toho nefunguje reset hesla.
10. Commitni a pushni na GitHub.
11. Repo Settings → Pages: Source = `Deploy from a branch`, branch = `main`, folder = `/` (root).
12. Po ~minutě bude live na `https://<user>.github.io/<repo>/`. Dárky přidáváš přes `/admin/`.

## Co umí

**Veřejná stránka `/`:**
- Karty s případným obrázkem (klik → lightbox), cenovkou (€/€€/€€€), tagy, poznámkou, varianta, externí odkaz.
- Filtry podle tagů (multi-select AND), `Vše` resetuje, `Překvap mě` (oranžová pilulka vpravo) scrollne + zvýrazní náhodný nerezervovaný dárek.
- Rezervovat / Ruším rezervaci bez přihlášení — jediná write cesta je RPC `toggle_reserved`.
- Rezervované klesnou na konec, při odrezervování se vrátí na svojí pozici. Karta při rezervaci `opacity: 0.5`.

**Admin `/admin/`:**
- Email/password login, „Zapomenuté heslo?" → reset email s `redirectTo` na `/admin/` → recovery flow s novým heslem.
- Sbalitelné karty: defaultně header (název, cenovka/tag/badge, šipky ↑↓, chevron). Klik na header rozbalí — bílá karta s plnou sadou polí (název, odkaz, cenovka, obrázek URL, varianta, tagy, poznámka).
- Auto-save na blur s toastem „Uloženo" / chybou. + Nový dárek inserne, rozbalí, fokusne Název.
- **Soft delete:** Smazat = `update deleted_at = now()`. Položka zmizí z public i z defaultního admin viewu. „Zobrazit smazané" v patičce zapne náhled smazaných (tlumeně, `opacity: 0.5`) s tlačítky Obnovit / Smazat natrvalo.

## Bezpečnostní model

- **Anon SELECT** je povolený — kdokoliv s linkem si seznam přečte. Smazané (`deleted_at != null`) se filtrují v query, ne v RLS.
- **Anon INSERT/UPDATE/DELETE** je zakázaný. Jediná cesta, jak host něco změní, je RPC `toggle_reserved(item_id, by_name)` s `SECURITY DEFINER`. Funkce flipne jen `reserved` / `reserved_by` / `reserved_at` na daném řádku — žádné jiné write.
- **Admin** (já) má full CRUD přes RLS policy `wishlist_admin_all`, která se zapíná po spuštění `make-me-admin.sql` s mým UID.
- **Publishable key** je v repu schválně. Je z definice určený k použití v prohlížeči, ochranu obstarává RLS + ta jedna RPC funkce. Service-role key v repu **nikdy nemá co dělat**.
- **Login form** používá `action="javascript:void(0)"` a registruje submit handler synchronně před `await getSession()`, aby heslo nikdy neproletělo do URL při race condition.

## Co se kde mění

- **Barvy a typografie:** `:root` blok v `css/style.css`. Zbytek stylu sahá jen na proměnné, takže redesign = editace toho jednoho bloku. Tokens: `--bg --ink --muted --accent --accent-text --price --border --border-radius-lg --font-display --font-body`.
- **Titulek + podtitul:** oba v `index.html` (`<h1>` a `<p class="subtitle">`). Podtitul je statický.
- **Logika rezervace:** `toggle_reserved()` v `supabase/setup.sql`. Idempotentní — druhé volání rezervaci zruší.
- **Public UI:** `index.html` + `js/app.js` + `css/style.css`.
- **Admin UI:** `admin/index.html` + `js/admin.js` + `css/style.css` (sekce na konci souboru).

## Out of scope

Žádné npm, žádný bundler, žádné notifikace, žádné analytics, žádný image upload (jen URL), žádný language toggle, žádný export. Když by to chtělo, jde to jinam.

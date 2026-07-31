# Maruška by si přála…

Osobní wishlist Marie. Statické HTML/CSS/JS na GitHub Pages, Supabase jako backend.
Cizí lidi rezervují přes RPC bez přihlášení, já edituju přes `/admin/`.

Live: <https://littlemeat.github.io/wishlist/>

## Další dokumentace

- **[docs/handover.md](docs/handover.md)** — přístupy a vlastnictví účtů, vědomě přijaté
  kompromisy (co nejsou bugy a nemá cenu je znovu řešit) a provozní runbook. Začni tady,
  pokud tenhle projekt přebíráš nebo se k němu vracíš po delší době.
- **[docs/supabase-keepalive.md](docs/supabase-keepalive.md)** — jak držet free-tier Supabase
  projekt vzhůru. Přenositelný návod, dá se použít i v jiných projektech.

## Lokální vývoj

Žádný build step, ale `file://` nestačí (`<dialog>` a Supabase potřebují origin):

```bash
python3 -m http.server 8765
```

Pak <http://localhost:8765/> a <http://localhost:8765/admin/>. Používá se `js/config.js`
z repa, takže lokální běh píše do **produkční** databáze — pozor při mazání.

## Setup z čistého stavu

Návod pro budoucí mě (kdybych to chtěla rozjet jinde) nebo pro někoho, kdo si tenhle pattern chce ojet:

1. Založ projekt na [supabase.com](https://supabase.com).
2. V Supabase SQL editoru spusť **`supabase/setup.sql`** — tabulka `wishlist_items`, RLS a první verze `toggle_reserved()`.
3. Spusť **`supabase/add-soft-delete.sql`** — přidá sloupec `deleted_at` pro soft delete.
4. Spusť **`supabase/add-hardening.sql`** — DB length / non-empty checky, composite index, atomické `admin_reorder()` RPC a **novější verze `toggle_reserved()`**, která přepíše tu ze `setup.sql`.
5. Spusť **`supabase/add-keepalive.sql`** — tabulka `keepalive` + funkce `keepalive_ping()` pro denní GitHub Actions cron (anonymní čtení se do Supabase „aktivity" nepočítá, zápis ano; bez toho free-tier projekt zaspí).
6. V Supabase → Authentication → Users → **Add user** → **Create new user**. Zaškrtni *Auto Confirm User*. (Přihlašovací stránka `/admin/` registraci neumí, uživatel se zakládá jen tady.)
7. Zkopíruj UID nově vytvořeného uživatele.
8. V `supabase/make-me-admin.sql` přepiš UUID na své a spusť v SQL editoru.
9. `js/config.js` **je v repu a obsahuje moje hodnoty** — přepiš `SUPABASE_URL` (Project Settings → Data API → URL) a `SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys → Publishable key). Klíč musí začínat `sb_publishable_`, jinak se klient odmítne spustit a stránka zůstane prázdná (chyba jen v konzoli). `js/config.example.js` je jen šablona pro referenci; `config.js` se **nekopíruje**, ten už existuje.
10. **Authentication → URL Configuration**: Site URL = `https://<user>.github.io/<repo>/`, do Redirect URLs přidej `https://<user>.github.io/<repo>/admin/`. Bez toho nefunguje reset hesla.
11. V `.github/workflows/keep-supabase-warm.yml` přepiš `SUPABASE_URL` a `SUPABASE_KEY` na
    svoje hodnoty. **Jsou tam natvrdo hodnoty mého projektu** — jinak bys držela vzhůru
    cizí databázi a svoje by ti zaspalo.
12. Commitni a pushni na GitHub.
13. Repo Settings → Pages: Source = `Deploy from a branch`, branch = `main`, folder = `/` (root).
14. Po ~minutě bude live na `https://<user>.github.io/<repo>/`. Dárky přidáváš přes `/admin/`.
15. GitHub → Actions → **Keep Supabase warm** → *Run workflow*. V logu musí být
    `RPC keepalive_ping: HTTP 200` a vrácený timestamp. Tím je ověřené, že projekt nezaspí.
    (Repo Settings → Actions → Workflow permissions přepínat nemusíš, workflow si o zápis
    říká sám v YAML.)

## Co umí

**Veřejná stránka `/`:**
- Karty s případným obrázkem (klik → lightbox), cenovkou (€/€€/€€€), tagy, poznámkou, varianta, externí odkaz.
- Filtry podle tagů (multi-select AND), `Vše` resetuje, `Překvap mě` (oranžová pilulka vpravo) scrollne + zvýrazní náhodný nerezervovaný dárek.
- Rezervovat / Ruším rezervaci bez přihlášení — jediná write cesta je RPC `toggle_reserved`.
- Rezervované klesnou na konec pod vloženou italic hlavičku „Rezervováno", název se přeškrtne a karta jde na `opacity: 0.5`. Při odrezervování se vrátí na svojí pozici.
- V patičce nenápadný odkaz na `/admin/`.

**Admin `/admin/`:**
- Email/password login, „Zapomenuté heslo?" → reset email s `redirectTo` na `/admin/` → recovery flow s novým heslem.
- Sbalitelné karty: defaultně header (název, cenovka/tag/badge, šipky ↑↓, chevron). Klik na header rozbalí — bílá karta s plnou sadou polí (název, odkaz, cenovka, obrázek URL, varianta, tagy, poznámka).
- Auto-save na `change` každého políčka (u textu tedy při odkliknutí, u selectu hned) s toastem „Uloženo" / chybou. + Nový dárek inserne, rozbalí, fokusne Název.
- **Soft delete:** Smazat = `update deleted_at = now()`. Položka zmizí z public i z defaultního admin viewu. Checkbox „Zobrazit smazané" v patičce vypne filtr úplně — v seznamu pak jsou živé i smazané položky pohromadě, smazané tlumeně (`opacity: 0.5`) s tlačítky Obnovit / Smazat natrvalo.

## Bezpečnostní model

- **Anon SELECT** je povolený — kdokoliv s linkem si seznam přečte. Smazané (`deleted_at != null`) se filtrují v query, ne v RLS — každá nová čtecí cesta si ten filtr musí přidat sama.
- **Anon INSERT/UPDATE/DELETE** je zakázaný. Jediná cesta, jak host něco změní, je RPC `toggle_reserved(item_id, by_name)` s `SECURITY DEFINER`. Funkce flipne jen `reserved` / `reserved_by` / `reserved_at` na daném řádku — žádné jiné write.
- **Jména rezervujících jsou veřejná.** `reserved_by` se vypisuje na veřejné stránce komukoli. Je to záměr (ať vím, komu děkovat), ale kdo se podepíše, uvidí to i ostatní.
- **Admin** (já) má full CRUD přes RLS policy `wishlist_admin_all`, která se zapíná po spuštění `make-me-admin.sql` s mým UID.
- **`/admin/` není tajný**, jen nezajímavý — je odkázaný z patičky a chráněný jen `noindex` metou a přihlášením. Bezpečnost stojí na RLS, ne na tom, že URL nikdo nezná.
- **Publishable key** je v repu schválně. Je z definice určený k použití v prohlížeči, ochranu obstarává RLS + ta jedna RPC funkce. Service-role key v repu **nikdy nemá co dělat**.
- **Login form** používá `action="javascript:void(0)"` a registruje submit handler synchronně před `await getSession()`, aby heslo nikdy neproletělo do URL při race condition.

## Co se kde mění

- **Barvy a typografie:** `:root` blok na začátku `css/style.css`. Tokens: `--bg --ink --muted --accent --accent-text --price --border --border-radius-lg --font-display --font-body`. Většina stylu sahá jen na proměnné, ale **ne všechno**: bílá `#FFFFFF` u karet a rozbalených admin řádků je natvrdo, stejně jako `rgba(10, 20, 36, …)` u backdropů. Fraunces se tahá z CDN `<link>`y v `index.html` i `admin/index.html`, takže změna fontu je i tam.
- **Titulek + podtitul:** `index.html` (`<title>`, `<h1>`, `<p class="subtitle">`) a `admin/index.html` (`<title>`, `<p class="subtitle">`). Podtitul je statický. Přejmenování projektu znamená projít obojí plus odkaz nahoře v tomhle README.
- **Logika rezervace:** `toggle_reserved()` — živá verze je v **`supabase/add-hardening.sql`**, ta ve `setup.sql` je starší a přepsaná. Editovat `setup.sql` na běžící databázi nic neudělá. Idempotentní: druhé volání rezervaci zruší.
- **Pořadí dárků:** `admin_reorder()` v `supabase/add-hardening.sql`, volané šipkami ↑↓. Sloupec `position` se v UI nikde nezobrazuje.
- **Public UI:** `index.html` + `js/app.js` + `css/style.css`.
- **Admin UI:** `admin/index.html` + `js/admin.js` + `css/style.css` (sekce na konci souboru).
- **Cenovky:** seznam možností je na dvou místech — `parseFieldValue` / select v `js/admin.js` a CHECK constraint ve `supabase/setup.sql`. Přidání čtvrté úrovně = obojí.

## Out of scope

Žádný bundler, žádné npm skripty, žádné notifikace, žádné analytics, žádný image upload (jen URL), žádný language toggle, žádný export. Runtime závislosti jsou dvě a tahají se z CDN: `supabase-js@2` a Fraunces. Když by to chtělo víc, jde to jinam.

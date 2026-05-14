# Marie chce

Osobní wishlist. Statické HTML/CSS/JS na GitHub Pages, Supabase jako backend.
Cizí lidi rezervují přes RPC bez přihlášení, ty edituješ přes `/admin/`.

## Setup

1. Založ projekt na [supabase.com](https://supabase.com).
2. V Supabase SQL editoru spusť `supabase/setup.sql` (tabulka + RLS + `toggle_reserved`).
3. V repu si zkopíruj `js/config.example.js` → `js/config.js` a vyplň `SUPABASE_URL` (Project Settings → General → Reference ID nebo General → API → URL) a `SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys → Publishable key).
4. Lokálně otevři přes `python3 -m http.server 8000` (file:// na `dialog` nestačí) a ověř, že se stránka načte bez chyb v konzoli.
5. Jdi na `/admin/`, dole se přihlas — ale nejdřív si vytvoř uživatele v Supabase → Authentication → Users („Add user → Create new user", potvrď email).
6. Zkopíruj svoje UID z Authentication → Users.
7. V `supabase/make-me-admin.sql` přepiš `YOUR-UID-HERE` na své UID a spusť v SQL editoru.
8. Commitni a pushni repo na GitHub.
9. V Settings → Pages nastav Source = `Deploy from a branch`, branch = `main`, folder = `/` (root).
10. Otevři `https://<user>.github.io/<repo>/` a přidávej dárky přes `/admin/`.

## Co se kde mění

- Barvy/typografie: `:root` v `css/style.css`. Zbytek stylu jen sahá na proměnné.
- Texty hlavičky a podtitulu: `index.html` (titulek) a `SUBTITLES` v `js/app.js`.
- Logika rezervace: `toggle_reserved()` v `supabase/setup.sql`. Idempotentní — druhé volání odrezervuje.

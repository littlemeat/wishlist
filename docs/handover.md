# Handover — co není vidět z kódu

Tenhle soubor existuje proto, že projekt vznikl v konverzaci s AI asistentem, která nikam
nepřežije. Kód a README popisují **co** aplikace dělá. Tady je **proč** je to takhle,
**kdo** k tomu má přístup a **co dělat, když se něco rozbije**.

Psáno v červenci 2026, kdy jsem projekt dokončila.

---

## 1. Přístupy a vlastnictví

Všechno běží pod **osobními** účty, nic pod firemními. To je záměr — projekt má přežít
změnu práce.

| Věc | Kde | Účet |
|---|---|---|
| Repo + hosting | GitHub `littlemeat/wishlist`, Pages z `main` / root | GitHub účet `littlemeat` |
| Databáze + auth | Supabase, organizace **HSDC**, projekt **Maru wishlist** | login `marie.michalova@gmail.com` |
| Supabase project ref | `vaxujjcvykatjivgkzjn` (je v `js/config.js` a ve workflow) | — |
| Admin login do `/admin/` | uživatel v Supabase → Authentication → Users | `marie.michalova@gmail.com` |
| Git commity | `Marie Michalova <marie.michalova@gmail.com>` | — |

**Zkontroluj jednou a odškrtni:** organizace v Supabase se jmenuje `HSDC`, což vypadá jako
firemní zkratka, ne jako osobní jméno. Pokud je ta organizace navázaná na firmu nebo ji
sdílíš s někým z práce, přesuň projekt do vlastní osobní organizace, **dokud máš ještě
přístup**. Notifikační maily o pauze chodí na gmail, což naznačuje osobní účet, ale ověř to
v Supabase → Organization settings → Members.

**Co se ztrácí a je to v pořádku:** projekt vznikl pod pracovním účtem Claude Code
(`marie.michalova@carvago.com`) a v jeho paměti byla jediná poznámka — lekce o tom, že se
formulářové handlery musí registrovat synchronně před `await`. Ta je zachovaná na dvou
místech v repu: v README v sekci Bezpečnostní model a jako komentář v `js/admin.js` u
`init()`. Nic dalšího v té paměti nebylo.

---

## 2. Vědomě přijaté kompromisy

Tohle **nejsou bugy** a nemá cenu je znovu řešit. Prošly review (architekt / tester / UX
designér) v červenci 2026 a byly zamítnuté s rozmyslem. Pokud je někdo „objeví" znovu,
tady je odpověď.

**Rezervace jsou postavené na důvěře.**
`toggle_reserved()` nekontroluje, kdo volá. Kdokoli s odkazem může rezervovat cokoli,
zrušit cizí rezervaci a poslat libovolné jméno. Není tam rate limit ani captcha. Je to
wishlist pro rodinu a přátele, ne e-shop — hlídat to by znamenalo přihlašování pro
návštěvníky, což je celý smysl téhle věci naruby. Stejně tak jde přes přímé volání RPC
rezervovat i soft-smazanou položku; nikdo to neuvidí, takže je to jedno.

**Admin je jedno UUID zadrátované v RLS policy.**
`supabase/make-me-admin.sql` má můj UID natvrdo. Druhý admin nebo výměna účtu = ručně
přepsat a znovu spustit ten soubor. Správné řešení (tabulka `profiles` s `is_admin`) je
zbytečná infrastruktura pro jednoho člověka.

**Editace v adminu nemá debounce ani řešení konfliktů.**
Ukládá se na `change` každého políčka, poslední zápis vyhrává. Dvě otevřené záložky si můžou
navzájem přepsat změny. Jeden uživatel = nikdy se to nestane.

**Tagy jsou `text[]`, ne normalizovaná tabulka.**
Přejmenování tagu = projít všechny řádky. Do ~20 tagů je to jednodušší než join tabulka.

**CDN závislosti bez SRI hashů a bez pinnutých verzí.**
`supabase-js@2` a Fraunces se tahají z jsdelivr. Výpadek jsdelivr = rozbitá stránka,
breaking change v minoru supabase-js taky. Pinnutí na přesnou verzi by znamenalo ruční
aktualizace.

**Kompletní re-render při každé změně.**
`innerHTML = ''` a postavit znovu. Ztrácí se tím focus a scroll pozice. Nad ~200 dárky by
to začalo být viditelně pomalé. Reálný počet je jednociferný.

**Admin nemá filtrování ani hledání.**
Při pár desítkách dárků se scrolluje rychleji, než by se psalo do hledání.

**Kontrast tagových pilulek je záměrně nízký.**
Bílý text na `--accent` modré má poměr ~2.8:1, což je pod WCAG AA. Je to vědomé estetické
rozhodnutí, ne opomenutí — pastelový vzhled byl v původním zadání. **Neopravovat**
ztmavením akcentu ani přechodem na tmavý text. Poznámka je i v `css/style.css` u `.tag`.

**Lighthouse skóre nikdy nezměřeno.**
V původním zadání byl cíl mobile ≥ 90. Nikdy jsme to nespustili. Není to změřené ani
vyvrácené — kdyby to někdy někdo chtěl, začni tady.

### Malé zvláštnosti, o kterých vím

Nic z toho nemá dopad na běžné používání, ale ať to nikoho nepřekvapí:

- **Šipky ↑↓ počítají i se smazanými položkami.** `admin_reorder()` bere všechny řádky
  včetně soft-smazaných, ale šipky se zakazují podle toho, co je vidět. Stisk šipky
  u poslední viditelné položky si ji tak může vyměnit se skrytou smazanou a zdánlivě
  neudělat nic. Náprava by byla `where deleted_at is null` v té funkci.
- **Vymazání názvu do prázdna skončí chybou.** Prázdný název se pošle jako `null`, což
  databáze odmítne (`not null` + non-blank CHECK) a v UI se objeví jen „Uložení selhalo".
  Je to správné selhání, jen nemá hezčí hlášku.
- **Reset hesla je citlivý na přesnou adresu.** Návratová adresa se skládá z aktuální
  cesty, takže když otevřeš `/admin/index.html` místo `/admin/`, vznikne adresa, která
  není v Supabase allowlistu, a odkaz z mailu nikam nevede.

---

## 3. Provozní runbook

### Supabase free tier chce projekt uspat

Tohle je jediná věc, která na tomhle projektu vyžaduje pozornost. Celý příběh a přenositelný
návod (pro použití v jiných projektech) je v [supabase-keepalive.md](supabase-keepalive.md).
Krátká verze:

- Free tier pausne projekt po ~7 dnech „bez aktivity".
- **Anonymní čtení se do aktivity nepočítá.** Ověřeno bolestivě: v červnu projekt zaspal
  pár hodin po úspěšném GET pingu. Počítá se **zápis**.
- Proto GitHub Actions workflow `.github/workflows/keep-supabase-warm.yml` každý den
  v 07:00 UTC volá `keepalive_ping()`, která updatne timestamp v tabulce `keepalive`.
- Druhá past: **GitHub vypíná naplánované workflow po 60 dnech bez commitu v repu.** Projekt
  je hotový, commity nepřicházejí — proto si workflow jednou za ~3 týdny udělá prázdný
  commit `chore: keepalive` a drží tím naživu sám sebe. Ten bot commit v historii je
  v pořádku, nemazat ten krok.

> **Ověřeno v provozu:** poprvé se ta větev spustila **30. 7. 2026** (commit `d46a3c2` od
> `keep-warm-bot`) a prošla. Takže to funguje, není to jen teorie.
>
> Důležitý detail k oprávněním: repo má Settings → Actions → General → Workflow permissions
> na *Read-only* a push **i tak projde**, protože workflow si v YAML říká o `permissions:
> contents: write`. To repo nastavení je jen default pro workflow, které si oprávnění
> nevyžádají — není to strop. Nemusíš tam nic přepínat.

### Když přijde mail „your project is going to be paused"

1. Zkontroluj, že cron vůbec běží: GitHub → Actions → Keep Supabase warm. Poslední runy
   musí být zelené a denní.
2. V logu hledej `RPC keepalive_ping: HTTP 200` a vrácený timestamp. Pokud je tam `404`,
   v databázi chybí funkce — spusť `supabase/add-keepalive.sql`.
3. Pokud cron běží zeleně a mail přišel i tak, znamená to, že Supabase přestala počítat
   i zápisy. Programově už to obejít nejde. Volby: Supabase Pro (~$25/měsíc, pauza
   neexistuje), nebo migrace na Neon (Postgres se scale-to-zero, ale probouzí se sám;
   auth by se musela nahradit, cca 3 hodiny práce).

### Když projekt už zaspal

Cron ho **neprobudí** — subdoména přestane odpovídat v DNS, takže není kam poslat request
(proto workflow v takovém případě selže s errorem, což je správně). Musíš ručně:
Supabase dashboard → projekt → **Resume**. Data zůstávají 90 dní od pauzy; po devadesáti
dnech už jde jen exportovat, ne probudit.

### Reset hesla do adminu nefunguje

Skoro vždycky chybí povolená návratová adresa. Supabase → Authentication → URL
Configuration → Redirect URLs musí obsahovat `https://littlemeat.github.io/wishlist/admin/`.
Bez toho se mail pošle, ale odkaz v něm nikam nevede a uživatel nedostane žádnou chybu.

---

## 4. Kdyby se to mělo nasadit znovu odjinud

README má setup postup od nuly a zmiňuje i to, co je potřeba přepsat. Pro úplnost: na třech
místech jsou natvrdo hodnoty **téhle** instance a nová instalace je musí vyměnit, jinak bude
sahat na moji databázi.

- `js/config.js` — project URL a publishable klíč.
- `.github/workflows/keep-supabase-warm.yml` — totéž podruhé, v `env` bloku. Rotace klíče
  znamená přepsat obojí.
- `supabase/make-me-admin.sql` — moje UID, na dvou řádcích.

Původní zadání projektu (`wishlist-claude-code-prompt.md`) je záměrně mimo git. Nic tajného
v něm není, jen je to interní brief — všechno podstatné z něj se dostalo do README, do
tokenů v `css/style.css` a do sekce s kompromisy výš. Pokud chceš mít i původní spec
v repu, stačí ho odebrat z `.gitignore` a commitnout.

# Meteogram – návrh projektu

Webová aplikace, která reprodukuje klasický meteogram SHMÚ/ECMWF, ale
interaktivně, na 16 dní, s výběrem lokality, meteorologickými výstrahami
a srážkovým radarem. Hostováno na Netlify.

Stav dokumentu: **návrh odsouhlasen** (rozhodnutí zadavatele viz §0) –
zatím se nepíše žádný kód.

---

## 0. Odsouhlasená rozhodnutí

| # | Otázka           | Rozhodnutí                                                    |
| - | ---------------- | ------------------------------------------------------------- |
| 1 | Vzhled           | **moderní redesign se zachovaným rozvržením** – pořadí a sdílená osa panelů jako v předloze, vlastní vizuální jazyk (§3.0) |
| 2 | Jazyk            | **SK primárně, CS jako druhý**; EN mimo rozsah                 |
| 3 | Zařízení         | **device-aware** – layout se přizpůsobuje třídě zařízení a schopnostem vstupu, ne jen šířce okna (§3.6) |
| 4 | Model            | **ECMWF (`ecmwf_ifs025`) napevno jako výchozí** kvůli shodě s předlohou; přepínač modelů až ve fázi 2 |
| 5 | Rozsah MVP       | **jen meteogram** + výběr lokality. Výstrahy a radar jsou fáze 2, architektura na ně zůstává připravená |

---

## 1. Cíl

Vzít statický obrázek meteogramu (viz referenční předloha SHMÚ – ECMWF,
`+240 h`) a udělat z něj živou aplikaci:

| Předloha (SHMÚ)                  | Nová aplikace                                     | Fáze |
| -------------------------------- | -------------------------------------------------- | ---- |
| statický PNG, jedna obec         | interaktivní SVG, libovolné místo na světě          | MVP  |
| 10 dní (240 h)                   | 16 dní (384 h)                                      | MVP  |
| pevný model ECMWF                | ECMWF zachován; přepínač modelů později             | MVP  |
| desktop only                     | device-aware, PWA, instalovatelné na mobil          | MVP  |
| bez výstrah                      | panel meteorologických výstrah pro danou lokalitu   | 2    |
| bez radaru                       | animovaný srážkový radar + nowcast                  | 2    |

Nejde o pixel-perfect klon: **rozvržení zůstává** (stejné pořadí panelů,
jedna sdílená časová osa, stejná informační hustota), **vizuál je nový**
(typografie, barvy, tmavý režim, interaktivita – hover/tap → přesné
hodnoty pro daný časový krok).

---

## 2. Zdroje dat

Vše je zvoleno tak, aby MVP běželo **bez placených API a bez API klíčů**.

### 2.1 Předpověď – Open-Meteo

- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Bez registrace a klíče, `forecast_days=16`, hodinový krok.
- **Model: `models=ecmwf_ifs025`** – shoda s předlohou SHMÚ (rozhodnutí 4).
  Datová vrstva ale model bere jako parametr, ne jako konstantu, aby
  přepínač (`icon_seamless`, `gfs_seamless`, `best_match`) šel ve fázi 2
  přidat bez zásahu do komponent.
- Dopady volby ECMWF, se kterými je třeba počítat:
  - IFS má na volném datasetu rozlišení 0,25° (~25 km) – hrubší než ICON
    (~7 km). V členitém terénu je proto rozdíl `model_alt` vs. `real_alt`
    výraznější (viz poznámka níže).
  - Za hranicí zhruba 90 h přechází IFS na **3hodinový krok**; některé
    proměnné tedy nebudou hodinové po celých 16 dní. Panely musí umět
    nerovnoměrný krok a chybějící hodnoty (mezera, ne interpolace na sílu).
  - Běh modelu (`00`/`12` UTC) je dostupný s několikahodinovým zpožděním;
    v hlavičce ukazujeme čas běhu, ne čas načtení.
- Potřebné hodinové proměnné:
  `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`,
  `cloud_cover`, `cloud_cover_low/mid/high`,
  `precipitation`, `rain`, `showers`, `snowfall`, `precipitation_probability`,
  `pressure_msl`, `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`,
  `weather_code`, `snow_depth`, `freezing_level_height`.
- Denní: `sunrise`, `sunset`, `precipitation_sum`, `temperature_2m_min/max`,
  `uv_index_max` (denní úhrny do boxíků nad panelem srážek – jako v předloze).
- Odpověď obsahuje `elevation` = nadmořská výška modelového bodu →
  zobrazíme jako `model_alt`, obdobně jako v hlavičce předlohy.
- Licence: CC-BY 4.0, atribuce povinná. Fair-use free tieru je
  řádově 10 000 požadavků/den – s CDN cachí (viz §4) bezpečně stačí.

**Poznámka k přesnosti:** předloha ukazuje `model_alt: 786 m` vs.
`real_alt: 556 m`. Tento rozdíl znamená systematickou chybu teploty
(~ +2 °C). V aplikaci to řešíme dvěma způsoby:

1. zobrazíme obě výšky v hlavičce (transparentnost),
2. volitelná korekce teploty suchoadiabatickým gradientem
   (0,65 °C / 100 m) přepínatelná v nastavení, defaultně **vypnutá**.

### 2.2 Skutečná nadmořská výška

- `https://api.open-meteo.com/v1/elevation` (Copernicus DEM, 90 m) →
  hodnota `real_alt` do hlavičky.

### 2.3 Vyhledávání lokalit – geokódování

- `https://geocoding-api.open-meteo.com/v1/search?name=…&language=sk`
- Bez klíče, vrací název, kraj, stát, lat/lon, výšku, timezone.
- Doplněno o:
  - **GPS** – browser Geolocation API (jen na vyžádání, ne automaticky),
  - **oblíbené** a **poslední** lokality v `localStorage`.

### 2.4 Meteorologické výstrahy – MeteoAlarm (CAP) *(fáze 2)*

- MeteoAlarm agreguje oficiální výstrahy evropských met. služeb
  (za SK je zdrojem SHMÚ) ve formátu **CAP / ATOM**.
- Feed je XML a **nemá CORS hlavičky** → musí přes serverovou funkci
  (§4), která ho parsuje na JSON a cachuje.
- Z CAP bereme: `severity` (Minor/Moderate/Severe/Extreme →
  žlutá/oranžová/červená), `event` (typ jevu), `onset`/`expires`,
  `description`, `area` (geokód regionu – NUTS/EMMA_ID).
- **Nutno ověřit při implementaci:** MeteoAlarm vyžaduje registraci
  přístupu k feedům a dodržení podmínek užití (identifikace v
  `User-Agent`, povinná atribuce, zákaz přeprodeje). Toto je jediný
  bod návrhu se skutečným právním/provozním rizikem – viz §10.
- **Záloha, pokud by MeteoAlarm nevyšel:** odvození vlastních
  „upozornění“ z prahových hodnot Open-Meteo (nárazy > 20 m/s, srážky >
  30 mm/24 h, teplota > 32 °C / < −15 °C, `cape` > 1500 J/kg). Jasně
  označit, že **nejde o oficiální výstrahu**.

### 2.5 Radar – RainViewer *(fáze 2)*

- `https://api.rainviewer.com/public/weather-maps.json` – seznam snímků:
  ~2 h historie (10min krok) + **30 min nowcast**.
- Dlaždice: `{host}{path}/{size}/{z}/{x}/{y}/{color}/{options}.png`,
  vrství se přes podkladovou mapu jako Leaflet `TileLayer`.
- Zdarma pro nekomerční použití, atribuce povinná.
- Podkladová mapa: **MapLibre GL** nebo **Leaflet** + OSM raster.
  Pro produkci raději CARTO Positron / Stadia (OSM tile policy
  neumožňuje vyšší provoz), případně vlastní styl.
- Alternativa/rozšíření: statické radarové kompozity SHMÚ (přesnější
  pokrytí SR, ale nutná ruční georeference a nejasná licence) – mimo MVP.

---

## 3. Obrazovky a UX

### 3.0 Vizuální jazyk (moderní redesign)

Co se z předlohy **zachovává**: pořadí panelů, jedna sdílená časová osa,
denní pás pod grafy, boxíky denních úhrnů srážek, hustota informací.

Co se **mění**:

| Prvek        | Předloha                              | Nově                                                                 |
| ------------ | ------------------------------------- | -------------------------------------------------------------------- |
| Rámečky      | plný černý rámeček kolem každého panelu | bez rámečků; panely odděluje bílé místo a jemná základní linka        |
| Mřížka       | plná mřížka přes celou plochu          | jen vodorovné linky u popisků os, 10 % opacity; svislé jen na 00 UTC  |
| Nadpisy      | červený centrovaný text nad panelem    | popisek vlevo nahoře, malý, sekundární barva; jednotka v závorce      |
| Písmo        | bitmapové, ~9 px                       | systémový sans (`ui-sans-serif`), tabulární číslice pro osy           |
| Barvy        | plné primární (červená/žlutá/modrá)    | tlumená paleta s dostatečným kontrastem v obou motivech (§8)          |
| Popisky osy  | `00 06 12 18` u každého dne            | adaptivní hustota podle šířky – od 6h kroku po jen půlnoci            |
| Pozadí       | bílá                                   | světlý i **tmavý motiv**, výchozí podle `prefers-color-scheme`         |

Design tokens jako CSS proměnné (`--panel-temp`, `--panel-precip-rain`,
`--panel-precip-snow`, `--panel-wind`, `--panel-gust`, `--grid`, `--ink`,
`--ink-muted`), obě sady motivů v jednom souboru. Žádná barva se
nezapisuje natvrdo v komponentě – to je podmínka toho, aby tmavý režim
a barvoslepá paleta nebyly dodatečné záplaty.

Noc, víkend a nejistota po dni 10 se kreslí jako **podklad**, ne jako
další čára – graf tím nezhoustne.

### 3.0.1 Paleta panelů (ověřená, ne odhadnutá)

Barvy nejsou vybrané od oka – každý pár, který se potkává **v jednom
panelu**, prošel validátorem (CVD odstup, normální vidění, kontrast vůči
ploše). Hodnoty žijí v `src/styles/tokens.css`, tady je zdůvodnění.

| Panel        | Role            | Světlý    | Tmavý     | Poznámka                                  |
| ------------ | --------------- | --------- | --------- | ----------------------------------------- |
| Teplota      | teplota         | `#eb6834` | `#d95926` | oranžová = teplo                          |
| Teplota      | pocitová        | `#f29d7c` | `#a04d26` | slabší krok téhož odstínu + čárkovaně     |
| Oblačnost    | celková         | `#6b7683` | `#8a94a1` | břidlicová plocha, ne žlutá – viz níže    |
| Srážky       | déšť            | `#2a78d6` | `#3987e5` |                                           |
| Srážky       | sníh            | `#1baf7a` | `#199e70` | ověřený pár s deštěm                      |
| Tlak         | tlak            | `#4a3aa7` | `#9085e9` | tenká čára, vysoký kontrast               |
| Vítr         | rychlost (čára) | `#008300` | `#4f9c4f` | zeleň jako v předloze                     |
| Vítr         | nárazy (plocha) | `#7ab876` | `#2d6b2d` | slabší krok téže zeleně                   |
| Směr větru   | body            | `#e34948` | `#e66767` | červené body jako v předloze              |

**Naměřené výsledky** (OKLab ΔE ×100; práh CVD ≥ 8, normální vidění ≥ 15):

- déšť ↔ sníh: světlý ΔE 23,1 CVD / 24,0 normální · tmavý 19,6 / 20,9 — **prochází**
- teplota ↔ pocitová: jeden odstín, ordinální pár — prochází v obou motivech
- vítr ↔ nárazy: jeden odstín, ordinální pár — prochází v obou motivech

**Tři vědomé odchylky, každá s důvodem:**

1. **Oblačnost není žlutá, jak v předloze.** Teplota je oranžová a panel
   oblačnosti leží přímo pod ní; žlutá vedle oranžové je měřitelně
   nejhorší pár celé palety (normální vidění ΔE 13,7 — pod prahem 15).
   Břidlicová navíc odpovídá tomu, co oblačnost je, a nechá panel
   ustoupit do pozadí. Ve fázi 2 se rozpad na nízkou/střední/vysokou
   udělá jako tři kroky téhož odstínu, což je sekvenční kódování.
2. **Oblačnost neprochází prahem sytosti** (čte se jako šedá). To je
   správně: práh existuje kvůli rozlišení více sérií v jednom grafu a
   oblačnost je v MVP sama ve svém panelu.
3. **Sníh má ve světlém motivu kontrast 2,74:1**, tedy pod 3:1. Platí
   pravidlo úlevy: hodnoty musí být dostupné i jinak než barvou —
   tooltip a tabulkový výpis jsou proto povinné, ne volitelné.

Napříč panely se barvy validovat nemusí (každý panel má vlastní osu,
popisek a jednotku, identitu tedy nenese barva), ale v tmavém motivu
jsou si tlak `#9085e9` a déšť `#3987e5` blízké – kdyby to v praxi rušilo,
tlak se přebarví, ne přeuspořádá.

### 3.1 Meteogram (hlavní obrazovka)

Sticky hlavička: název lokality, souřadnice, `model_alt` / `real_alt`,
běh modelu (`ECMWF: 27/07/2026 00 UTC + 384 H`), badge s počtem
aktivních výstrah, tlačítko vyhledávání.

Pod ní panely se **sdílenou časovou osou** (svisle zarovnané, jako v
předloze):

| # | Panel                    | Vykreslení                                                   |
| - | ------------------------ | ------------------------------------------------------------ |
| 1 | Teplota 2 m [°C]         | lomená čára; volitelně pocitová teplota tenčí čarou           |
| 2 | Oblačnost [%]            | žluté sloupce; přepínač na skládané nízká/střední/vysoká      |
| 3 | Srážky [mm]              | modré (déšť) a šedé (sníh) sloupce + boxíky denních úhrnů     |
| 4 | Tlak na hl. moře [hPa]   | hladká čára                                                   |
| 5 | Vítr 10 m [m/s]          | čára = rychlost, zelené sloupce = nárazy                      |
| 6 | Směr větru               | bodový graf světových stran (S/SV/V/JV/J/JZ/Z/SZ), jako předloha |

Průřezové prvky časové osy:
- svislé linky na 00 UTC, popisky hodin v hustotě podle šířky (§3.6),
- pás s dny (`Pon 27`, `Uto 28`, …), víkendy zvýrazněné,
- **noční pásma** (mezi západem a východem slunce) jemným podkladem,
- svislá čára „teď“,
- **sdílený hover/tap crosshair** – ve všech panelech naráz + plovoucí
  tooltip se všemi hodnotami pro daný čas,
- za dnem 10 tlumené vykreslení + poznámka o klesající spolehlivosti.

### 3.2 Výběr lokality

Našeptávač (debounce 300 ms), tlačítko „Moja poloha“, seznam oblíbených
a posledních. Podání se liší podle zařízení (§3.6): bottom sheet na
dotykových, dialog uprostřed na desktopu. Výsledek se propíše do URL
(`/?lat=49.276&lon=20.683&name=Nová%20Ľubovňa`) → sdílitelný odkaz,
funkční deep-link.

### 3.3 Výstrahy *(fáze 2)*

Banner nad meteogramem obarvený podle nejvyšší severity; klik otevře
detail: typ jevu, ikona, platnost od–do, text, zdroj + odkaz na SHMÚ.
Období platnosti výstrahy se navíc vyznačí jako barevný pás v časové
ose meteogramu – to je hlavní přidaná hodnota oproti předloze.

### 3.4 Radar *(fáze 2)*

Fullscreen mapa, marker vybrané lokality, časová osa se snímky,
play/pauza, krokování, přepínač historie/nowcast, průhlednost vrstvy,
barevná škála. Mapová knihovna se načítá **lazy** jen na této route.

### 3.5 Nastavení

Jednotky (°C, m/s vs. km/h, mm), jazyk (SK/CS), motiv (auto/světlý/tmavý),
korekce teploty podle nadm. výšky, 12/24 h. Přepínač modelu přibude
ve fázi 2.

### 3.6 Device-aware chování

„Device-aware“ znamená víc než breakpointy podle šířky okna. Aplikace
se rozhoduje podle **čtyř nezávislých signálů**, protože se nekryjí –
tablet s klávesnicí je široký a dotykový zároveň, notebook s dotykovým
displejem umí obojí:

| Signál            | Zjištění                                   | Co ovlivňuje                                            |
| ----------------- | ------------------------------------------- | -------------------------------------------------------- |
| Šířka plochy      | container queries nad meteogramem           | počet zobrazených dní, hustota popisků osy, výška panelů  |
| Druh vstupu       | `pointer: fine` / `coarse`, `hover: hover`  | crosshair na hover vs. na tažení prstem; velikost cílů    |
| Orientace         | `orientation: landscape`                    | na mobilu na šířku se zobrazí víc dní a skryje se hlavička |
| Preference        | `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast` | motiv, animace přechodů, síla mřížky      |

Konkrétní chování:

| Třída                     | Výchozí rozsah | Ovládání                                    | Panely                            |
| ------------------------- | -------------- | -------------------------------------------- | --------------------------------- |
| Telefon na výšku (<600 px) | 2 dny          | swipe = posun v čase, pinch = zoom, tap = crosshair, haptika | všech 6, nižší, popisek uvnitř panelu |
| Telefon na šířku          | 4 dny          | totéž, hlavička se sbalí                     | všech 6                           |
| Tablet (600–1024 px)      | 5 dní          | dotyk i myš, obojí aktivní                   | všech 6, plná výška                |
| Desktop (>1024 px)        | 16 dní naráz   | hover crosshair, kolečko = zoom, klávesnice (←/→ po hodinách, Home/End) | všech 6 + druhotné čáry (pocitová teplota) |

Implementačně:
- rozsah a hustota popisků se počítají z **naměřené šířky kontejneru**
  (ResizeObserver), ne z `window.innerWidth` – graf se pak chová správně
  i při split-screenu a při změně orientace,
- vstupní vrstva je jedna: Pointer Events pokrývají myš, dotyk i pero;
  nepíšou se dvě sady handlerů,
- SVG se kreslí v logických souřadnicích a škáluje `viewBox`em, takže na
  Retina/HiDPI je ostré bez zvláštní větve v kódu,
- `prefers-reduced-motion` vypne dojezd (momentum) scrollu a přechody,
- žádný sniffing `user-agent`; rozhoduje jen schopnost a rozměr.

### 3.7 Jazyk

- **SK je výchozí**, CS jako druhá volba; přepínač v nastavení,
  volba se pamatuje v `localStorage`.
- První návštěva: pokud `navigator.language` začíná na `cs`, nabídne
  se CS, jinak SK. Nikdy se nepřepíná automaticky později.
- Dvě ploché slovníkové mapy (`sk.json`, `cs.json`) + typ odvozený
  z klíčů SK, aby chybějící český překlad spadl na kompilaci, ne na
  produkci.
- Data, čísla a jednotky přes `Intl` s locale `sk-SK` / `cs-CZ` –
  zkratky dnů (`Pon`, `Uto`, `Str`, `Štv`, `Pia`, `Sob`, `Ned` vs.
  `Po`, `Út`, `St`, `Čt`, `Pá`, `So`, `Ne`) se tím vyřeší samy.
- Časová zóna se řídí lokalitou (`timezone=auto` z Open-Meteo), ne
  jazykem – meteogram pro slovenskou obec ukazuje místní čas i pro
  uživatele s CS rozhraním. Zóna se zobrazí v hlavičce.

---

## 4. Architektura

```
Prohlížeč (SPA, React + TS)
   │
   ├─► Open-Meteo Forecast / Elevation / Geocoding      (přímo, CORS OK)
   ├─► RainViewer weather-maps.json + PNG dlaždice      (přímo, CORS OK)
   │
   └─► /api/*  ── Netlify Functions ──┐
                                      ├─► MeteoAlarm CAP/ATOM → JSON
                                      └─► (volitelně) proxy+cache předpovědi
```

- **Statický frontend** buildovaný Vite, servírovaný z Netlify CDN.
- **MVP nepotřebuje žádnou serverovou funkci** – Open-Meteo posílá CORS
  hlavičky, takže prohlížeč volá API přímo. Adresář `netlify/functions`
  vznikne až s výstrahami ve fázi 2. Datová vrstva ale volá vlastní
  modul (`/src/api`), ne `fetch` roztroušený v komponentách, takže
  případné pozdější přesměrování na proxy je změna na jednom místě.
- **Netlify Functions** (fáze 2) jen tam, kde je nutná serverová strana:
  parsování CAP XML, obcházení CORS, skrytí případných klíčů, cache.
- Cache na hraně přes hlavičky:
  `Netlify-CDN-Cache-Control: public, s-maxage=600, stale-while-revalidate=3600`
  pro výstrahy (10 min) a `s-maxage=900` pro předpověď – tím drží
  provoz na upstream API hluboko pod fair-use limity bez ohledu na
  počet návštěvníků.
- Klientská cache: TanStack Query (`staleTime` 10 min) +
  persistence do `localStorage` → okamžité zobrazení po návratu
  a základní offline režim.
- Žádná databáze, žádné účty. Stav uživatele je v `localStorage` a v URL.

### Technologický stack

| Vrstva        | Volba                        | Proč                                            |
| ------------- | ---------------------------- | ----------------------------------------------- |
| Build         | Vite                         | rychlý, nativní Netlify podpora                  |
| UI            | React 18 + TypeScript        | ekosystém, typová bezpečnost nad meteo daty      |
| Grafy         | **vlastní SVG + d3-scale/d3-shape** | viz níže                                 |
| Mapa (fáze 2) | Leaflet (nebo MapLibre GL)   | lehké, dlaždicová vrstva RainVieweru triviálně   |
| Data fetching | TanStack Query               | cache, retry, dedup, persistence                 |
| Stylování     | CSS Modules + CSS proměnné   | design tokens a tmavý motiv bez build-time magie |
| i18n          | vlastní slovníky (bez knihovny) | SK + CS, plochý JSON stačí; `Intl` na data a čísla |
| Testy         | Vitest + Playwright          | jednotkové nad transformacemi, e2e nad meteogramem |
| CI            | GitHub Actions + Netlify deploy previews | kontrola PR před merge               |

**Proč vlastní SVG místo Rechartsu / Chart.js:** meteogram je šest
heterogenních panelů (čáry, sloupce, skládané sloupce, bodový graf
světových stran, boxíky denních úhrnů) sdílejících jednu časovou osu
a jeden crosshair. Hotové knihovny se v tomhle složení překonávají –
zápas s jejich layoutem stojí víc než 300 řádků vlastních komponent nad
`d3-scale`. SVG navíc dá ostrý tisk, snadnou přístupnost (`<title>`,
ARIA) a serverový export do PNG, kdyby se hodil sdílený náhled.

---

## 5. Struktura repozitáře (záměr)

Hvězdičkou označené položky vznikají až ve fázi 2.

```
/src
  /api            klienti Open-Meteo (forecast, elevation, geocoding)
                  + tolerantní parsování;  * rainviewer.ts, alerts.ts
  /components
    /meteogram    TimeAxis, DayStrip, TemperaturePanel, CloudPanel,
                  PrecipPanel, PressurePanel, WindPanel, WindDirPanel,
                  Crosshair, Tooltip, NightBands
    /location     SearchDialog, FavoritesList, GeolocateButton
  * /alerts       AlertBanner, AlertDetail
  * /radar        RadarMap, RadarTimeline
  /hooks          useForecast, useElevation, useContainerSize,
                  useViewport (třída zařízení), useUnits, useLocale
  /lib            scales, formatting, jednotky, čas/timezone
  /i18n           sk.json, cs.json, index.ts
  /styles         tokens.css (světlý + tmavý motiv), base.css
  /pages          Home, Settings;  * Radar
* /netlify/functions
    alerts.ts     MeteoAlarm CAP → JSON
/docs             tento návrh, poznámky k datovým zdrojům
netlify.toml
```

---

## 6. Etapy

### MVP – meteogram

| Etapa | Obsah                                                                 | Odhad     | Stav |
| ----- | --------------------------------------------------------------------- | --------- | ---- |
| M0    | skeleton, Vite+TS, `netlify.toml`, design tokens, první deploy, CI    | 0,5 dne   | ✅ hotovo |
| M1    | datová vrstva ECMWF přes Open-Meteo + typy + výběr lokality + URL stav | 1,5 dne  | ✅ hotovo |
| M2    | meteogram: sdílená osa, 6 panelů, crosshair, tmavý motiv              | 3 dny     | – |
| M3    | device-aware vrstva: zoom/pan, gesta, klávesnice, třídy zařízení (§3.6) | 1,5 dne  | – |
| M4    | SK/CS lokalizace, nastavení, PWA, přístupnost, testy, doladění        | 2 dny     | – |

**Poznámka k M1 – parsování bez Zodu.** Návrh původně počítal se Zod
schématy. Při psaní se ukázalo, že potřebná pravidla nejsou validace
schématu, ale doménová rozhodnutí: chybějící proměnnou je třeba ohlásit
UI (`missing`), řadu s jinou délkou než časová osa zahodit (posunuté
hodnoty jsou horší než prázdný panel) a nečíselnou hodnotu převést na
`null`, ne na výjimku. Ručně psaný parser to vyjádří přímočařeji a
nestojí nic v bundlu.

**MVP celkem ~8,5 člověkodne.** Veřejný odkaz je použitelný už po M2;
M3 a M4 jsou dolaďování téhož.

### Fáze 2 – po nasazení MVP

| Etapa | Obsah                                                          | Odhad   |
| ----- | -------------------------------------------------------------- | ------- |
| F2-A  | výstrahy: Netlify Function, CAP parser, banner, pásy v ose      | 1,5 dne |
| F2-B  | radar: mapa, dlaždice RainVieweru, časová osa, animace          | 1,5 dne |
| F2-C  | přepínač modelů (ICON/GFS/best match) + srovnání v jednom grafu | 1 den   |

---

## 7. Provoz a náklady

- Netlify **free tier**: 100 GB provozu/měsíc, 125k invokací funkcí –
  pro tento profil zdarma. Doména volitelná (~10 €/rok).
- Deploy: napojení GitHub repozitáře, `npm run build` → `dist/`,
  deploy previews pro každý PR.
- Sledování: Netlify Analytics volitelně; chyby lze posílat do
  bezplatného Sentry tieru.

---

## 8. Přístupnost a výkon

- Cíl: LCP < 2 s na 4G, JS bundle MVP < 120 kB gzip (bez mapy, ta
  přijde jako lazy chunk až ve fázi 2).
- Meteogram má textovou alternativu (tabulka hodnot) pro čtečky;
  crosshair ovladatelný klávesnicí (šipky = posun po hodinách).
- Barvy panelů mít rozlišitelné i pro deuteranopii – nespoléhat jen
  na modrá/zelená u větru a srážek, přidat vzor/tvar.
- Kontrast textu a čar min. 4,5:1 v **obou** motivech; ověřit i tlumené
  vykreslení po dni 10, aby nespadlo pod čitelnost.
- 384 hodinových bodů × 6 panelů je pro SVG bez problému, ale hodnoty
  se předpočítají jednou (`useMemo` nad odpovědí API), ne při každém
  pohybu crosshairu; crosshair se překresluje samostatně nad statickou
  vrstvou.

---

## 9. Co vědomě není v MVP

- **Výstrahy a radar** – rozhodnutí 5, přesunuto do fáze 2 (§6).
- **Přepínač modelů** – MVP jede na ECMWF napevno (rozhodnutí 4).
- **Anglická lokalizace** – jen SK a CS (rozhodnutí 2).
- Push notifikace na výstrahy – vyžadují perzistentní úložiště
  odběratelů, VAPID klíče a plánovanou funkci; jde to na Netlify
  Scheduled Functions + Supabase, ale je to samostatná etapa.
- Historická data a klimatologické srovnání (Open-Meteo Archive API).
- Ensemble/spread (rozptyl členů) – Open-Meteo Ensemble API to umí,
  vizuálně by to znamenalo sedmý panel a „vějíř“ nejistoty u teploty.
- Vlastní radar SHMÚ, blesky, satelitní snímky.
- Účty, synchronizace oblíbených mezi zařízeními.

---

## 10. Rizika

### Týkají se MVP

| Riziko                                      | Dopad   | Ošetření                                              |
| ------------------------------------------- | ------- | ----------------------------------------------------- |
| ECMWF IFS 0,25° je hrubý – nesoulad `model_alt` vs. `real_alt` v horách | střední | zobrazit obě výšky + volitelná korekce (§2.1); ve fázi 2 nabídnout ICON |
| IFS přechází po ~90 h na 3hodinový krok     | střední | panely musí zvládnout nerovnoměrný krok už od začátku (§2.1) |
| 16denní horizont je fakticky málo přesný    | –       | po dni 10 tlumené vykreslení a poznámka o nejistotě   |
| Fair-use limity Open-Meteo při růstu        | nízký   | klientská cache + krátký `staleTime`; případně proxy s CDN cachí nebo placený tier (~29 €/měs) |
| Ostrost a čitelnost na malých displejích    | nízký   | ověřit na skutečném telefonu už v M2, ne až v M3      |

### Aktivují se až ve fázi 2

| Riziko                                      | Dopad   | Ošetření                                              |
| ------------------------------------------- | ------- | ----------------------------------------------------- |
| MeteoAlarm vyžaduje registraci / omezí užití | střední | ověřit na začátku F2-A; fallback = prahová upozornění (§2.4) |
| RainViewer free jen pro nekomerční užití    | nízký   | dokud je projekt nekomerční, OK; jinak jiný poskytovatel |
| OSM dlaždice a jejich tile policy           | nízký   | přejít na CARTO/Stadia free tier                      |

---

## 11. Co ověřit hned na začátku M1

Síťový přístup při psaní tohoto návrhu byl omezený, endpointy tedy
nejsou ověřené živě. První úkol v M1 je proto jeden ruční dotaz na
Open-Meteo a kontrola, že:

1. `models=ecmwf_ifs025` vrací data na plných `forecast_days=16`
   (pokud IFS končí na 15 dnech, aplikace zobrazí, co model dá, a
   16 dní zůstane cílem pro modely, které tak daleko dosáhnou),
2. které proměnné jsou u IFS opravdu dostupné – `snow_depth`,
   `precipitation_probability` a `cape` u některých modelů chybí a
   panely na to musí být připravené,
3. od kolikáté hodiny se krok mění z 1 h na 3 h,
4. `timezone=auto` vrací očekávanou zónu a `elevation` sedí na
   `model_alt` z předlohy.

Výsledek se zapíše sem do dokumentu – tím se přestane hádat a začne
stavět na ověřených číslech.

**Stav po M1:** síť zůstala nedostupná, ověření tedy stále nikdo
neprovedl. Datová vrstva je proto napsaná tak, aby žádná z odpovědí na
otázky 1–3 nevyžadovala zásah do kódu:

- chybějící proměnná se objeví v poli `missing` a aplikace to napíše
  uživateli místo toho, aby předstírala prázdný panel,
- nepravidelný krok se nikde nepředpokládá; `stepHours()` ho počítá
  z časové osy a je otestovaný právě na přechodu 1 h → 3 h,
- kratší předpověď než 16 dní se vykreslí tak, jak přijde.

Zbývá tedy jen zapsat naměřená čísla, ne přepisovat kód. Nejrychlejší
způsob ověření je otevřít v prohlížeči:

```
https://api.open-meteo.com/v1/forecast?latitude=49.276&longitude=20.683
  &models=ecmwf_ifs025&forecast_days=16&hourly=temperature_2m,snowfall,cape
  &timezone=auto&timeformat=unixtime
```

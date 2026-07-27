# Meteogram – návrh projektu

Webová aplikace, která reprodukuje klasický meteogram SHMÚ/ECMWF, ale
interaktivně, na 16 dní, s výběrem lokality, meteorologickými výstrahami
a srážkovým radarem. Hostováno na Netlify.

Stav dokumentu: **návrh k odsouhlasení** – zatím se nepíše žádný kód.

---

## 1. Cíl

Vzít statický obrázek meteogramu (viz referenční předloha SHMÚ – ECMWF,
`+240 h`) a udělat z něj živou aplikaci:

| Předloha (SHMÚ)                  | Nová aplikace                                        |
| -------------------------------- | ---------------------------------------------------- |
| statický PNG, jedna obec         | interaktivní SVG, libovolné místo na světě            |
| 10 dní (240 h)                   | 16 dní (384 h)                                        |
| pevný model ECMWF                | volitelný model (best match / ECMWF / ICON / GFS)     |
| bez výstrah                      | panel meteorologických výstrah pro danou lokalitu     |
| bez radaru                       | animovaný srážkový radar + nowcast                    |
| desktop only                     | responzivní, PWA, instalovatelné na mobil             |

Nejde o pixel-perfect klon; jde o zachování **informační hustoty** a
sledu panelů, s modernější typografií, tmavým režimem a interaktivitou
(hover/tap → přesné hodnoty pro daný časový krok).

---

## 2. Zdroje dat

Vše je zvoleno tak, aby MVP běželo **bez placených API a bez API klíčů**.

### 2.1 Předpověď – Open-Meteo

- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Bez registrace a klíče, `forecast_days=16`, hodinový krok.
- Volba modelu parametrem `models=`:
  - `best_match` (default – Open-Meteo míchá modely podle lokality),
  - `ecmwf_ifs025` – nejbližší předloze SHMÚ,
  - `icon_seamless` – nejlepší rozlišení pro střední Evropu,
  - `gfs_seamless` – záloha.
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

### 2.4 Meteorologické výstrahy – MeteoAlarm (CAP)

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

### 2.5 Radar – RainViewer

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
- svislé mřížkové čáry po 6 h, popisky `00 06 12 18`,
- pás s dny (`Pon 27`, `Uto 28`, …), víkendy zvýrazněné,
- **noční pásma** (mezi západem a východem slunce) jemným podkladem,
- svislá čára „teď“,
- **sdílený hover/tap crosshair** – ve všech panelech naráz + plovoucí
  tooltip se všemi hodnotami pro daný čas.

Interakce: horizontální zoom/pan (16 dní se na mobil nevejde čitelně).
Na mobilu default rozsah 3 dny s plynulým scrollem a „minimapou“
celého období; na desktopu celých 16 dní.

### 3.2 Výběr lokality

Modal/sheet: našeptávač (debounce 300 ms), tlačítko „Moje poloha“,
seznam oblíbených a posledních. Výsledek se propíše do URL
(`/?lat=49.276&lon=20.683&name=Nová%20Ľubovňa`) → sdílitelný odkaz,
funkční deep-link.

### 3.3 Výstrahy

Banner nad meteogramem obarvený podle nejvyšší severity; klik otevře
detail: typ jevu, ikona, platnost od–do, text, zdroj + odkaz na SHMÚ.
Období platnosti výstrahy se navíc vyznačí jako barevný pás v časové
ose meteogramu – to je hlavní přidaná hodnota oproti předloze.

### 3.4 Radar

Fullscreen mapa, marker vybrané lokality, časová osa se snímky,
play/pauza, krokování, přepínač historie/nowcast, průhlednost vrstvy,
barevná škála. Mapová knihovna se načítá **lazy** jen na této route.

### 3.5 Nastavení

Jednotky (°C/°F, m/s vs. km/h, mm/in), model, jazyk (SK/CS/EN), motiv
(auto/světlý/tmavý), korekce teploty podle nadm. výšky, 12/24 h.

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
- **Netlify Functions** jen tam, kde je nutná serverová strana:
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
| Mapa          | Leaflet (nebo MapLibre GL)   | lehké, dlaždicová vrstva RainVieweru triviálně   |
| Data fetching | TanStack Query               | cache, retry, dedup, persistence                 |
| Stylování     | CSS Modules nebo Tailwind    | dle preference; oboje na Netlify bez problému    |
| i18n          | vlastní slovníky (bez knihovny) | 3 jazyky, plochý JSON stačí                  |
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

```
/src
  /api            klienti Open-Meteo, RainViewer, výstrah + Zod schémata
  /components
    /meteogram    TimeAxis, TemperaturePanel, CloudPanel, PrecipPanel,
                  PressurePanel, WindPanel, WindDirPanel, Crosshair
    /location     SearchDialog, FavoritesList
    /alerts       AlertBanner, AlertDetail
    /radar        RadarMap, RadarTimeline
  /hooks          useForecast, useAlerts, useRadarFrames, useUnits
  /lib            scales, formatting, jednotky, čas/timezone, i18n
  /pages          Home, Radar, Settings
/netlify/functions
  alerts.ts       MeteoAlarm CAP → JSON
/docs             tento návrh, poznámky k datovým zdrojům
netlify.toml
```

---

## 6. Etapy

| Etapa | Obsah                                                                | Odhad     |
| ----- | -------------------------------------------------------------------- | --------- |
| M0    | skeleton, Vite+TS, netlify.toml, první deploy, CI                    | 0,5 dne   |
| M1    | datová vrstva Open-Meteo + typy + výběr lokality + URL stav          | 1,5 dne   |
| M2    | meteogram: časová osa, 6 panelů, crosshair, zoom, responzivita       | 3–4 dny   |
| M3    | výstrahy: Netlify Function, CAP parser, banner, pásy v ose           | 1,5 dne   |
| M4    | radar: mapa, dlaždice, časová osa, animace                           | 1,5 dne   |
| M5    | PWA, i18n, tmavý režim, přístupnost, nastavení, testy, doladění      | 2 dny     |

Celkem ~10–11 člověkodnů. Použitelný veřejný odkaz je po M2
(meteogram funguje sám o sobě), M3/M4 jsou přírůstkové.

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

- Cíl: LCP < 2 s na 4G, JS bundle bez mapy < 150 kB gzip
  (mapa a radar lazy chunk).
- Meteogram má textovou alternativu (tabulka hodnot) pro čtečky;
  crosshair ovladatelný klávesnicí (šipky = posun po hodinách).
- Barvy panelů mít rozlišitelné i pro deuteranopii – nespoléhat jen
  na modrá/zelená u větru a srážek, přidat vzor/tvar.

---

## 9. Co vědomě není v MVP

- Push notifikace na výstrahy – vyžadují perzistentní úložiště
  odběratelů, VAPID klíče a plánovanou funkci; jde to na Netlify
  Scheduled Functions + Supabase, ale je to samostatná etapa.
- Historická data a klimatologické srovnání (Open-Meteo Archive API).
- Ensemble/spread (rozptyl členů) – Open-Meteo Ensemble API to umí,
  vizuálně by to znamenalo sedmý panel a „vějíř“ nejistoty u teploty.
- Vlastní radar SHMÚ, blesky, satelitní snímky.
- Účty, synchronizace oblíbených mezi zařízeními.

---

## 10. Rizika a otevřené otázky

| Riziko                                      | Dopad | Ošetření                                              |
| ------------------------------------------- | ----- | ----------------------------------------------------- |
| MeteoAlarm vyžaduje registraci / omezí užití | střední | ověřit hned v M3; fallback = prahová upozornění (§2.4) |
| Fair-use limity Open-Meteo při růstu        | nízký | CDN cache; případně placený tier (~29 €/měs)          |
| RainViewer free jen pro nekomerční užití    | nízký | dokud je projekt nekomerční, OK; jinak jiný poskytovatel |
| OSM dlaždice a jejich tile policy           | nízký | přejít na CARTO/Stadia free tier                      |
| Nesoulad model_alt vs. real_alt v horách    | střední | zobrazit obě výšky + volitelná korekce (§2.1)         |
| 16denní horizont je fakticky málo přesný    | –     | po dni 10 zobrazit šedivější/tečkované vykreslení a poznámku o nejistotě |

Otázky k rozhodnutí před začátkem kódování:

1. **Vzhled:** věrná nápodoba SHMÚ (bílé pozadí, červené nadpisy,
   tenké čáry) nebo moderní redesign se zachovaným rozvržením?
2. **Jazyk rozhraní:** primárně SK, CS, nebo rovnou vícejazyčně?
3. **Cílové zařízení:** mobil first, nebo desktopová hustota dat jako v předloze?
4. **Model:** držet se ECMWF kvůli shodě s předlohou, nebo default
   `best_match` (obvykle přesnější pro krátký horizont)?
5. **Rozsah MVP:** je nutné mít radar i výstrahy v prvním nasazení,
   nebo stačí meteogram a zbytek přidat později?

# Meteogram

Interaktívny meteogram na 16 dní (model ECMWF) s výberom lokality,
v SK/CS. Inšpirované statickými meteogramami SHMÚ/ECMWF, s moderným
vizuálom a device-aware ovládaním. Nasadenie na Netlify.

Meteorologické výstrahy (MeteoAlarm) a zrážkový radar (RainViewer)
sú naplánované ako fáza 2.

📄 [Návrh projektu](docs/navrh-projektu.md)

## Stav

Hotové etapy **M0 – kostra** (build, design tokens, motívy, CI, konfigurácia
nasadenia) a **M1 – dáta** (predpoveď ECMWF z Open-Meteo, výber lokality,
zdieľateľná URL, tabuľka hodnôt).

Panely meteogramu sú zatiaľ prázdne miesta – vykreslí ich etapa M2.
Do tej doby sú hodnoty v tabuľke pod nimi; tá zostane aj neskôr ako
textová alternatíva grafu.

## Vývoj

```bash
npm install
npm run dev        # vývojový server
npm run typecheck  # tsc --noEmit
npm test           # vitest
npm run build      # produkčný build do dist/
```

## Nasadenie na Netlify

Build je čisto statický, `netlify.toml` je súčasťou repozitára:

1. Netlify → **Add new site → Import an existing project** → GitHub →
   `karolkonkolcz/meteogram`.
2. Build command `npm run build`, publish directory `dist` — Netlify si
   ich načíta z `netlify.toml`, netreba ich prepisovať.
3. Node 22 sa nastavuje cez `NODE_VERSION` v `netlify.toml`.

Žiadne API kľúče ani premenné prostredia MVP nepotrebuje — Open-Meteo
funguje bez registrácie. Deploy previews pre pull requesty stačí zapnúť
v nastaveniach situ.

## Štruktúra

| Cesta               | Obsah                                                |
| ------------------- | ---------------------------------------------------- |
| `src/styles/`       | design tokens (jediné miesto s natvrdo zapísanými farbami) |
| `src/lib/`          | logika bez UI (motív, neskôr škály a formátovanie)   |
| `src/hooks/`        | React hooky                                          |
| `src/components/`   | UI komponenty                                        |
| `docs/`             | návrh projektu                                       |

## Dáta a licencie

- Predpoveď: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0), model ECMWF IFS.
- Fáza 2: [MeteoAlarm](https://meteoalarm.org/) (výstrahy),
  [RainViewer](https://www.rainviewer.com/) (radar) — obe vyžadujú atribúciu.

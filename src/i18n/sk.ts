/**
 * Slovenčina je východiskový jazyk (rozhodnutie 2 v docs §0). Z tvaru
 * tohto objektu je odvodený typ slovníka, takže chýbajúci český preklad
 * neprejde kompiláciou – nezistí sa až v produkcii.
 */
export const sk = {
  'app.name': 'Meteogram',
  'app.loading': 'Načítavam predpoveď…',
  'app.error': 'Predpoveď sa nepodarilo načítať: {message}',
  'app.retry': 'Skúsiť znova',
  'app.missing': 'Model pre túto lokalitu nedodal: {list}. Príslušné panely zostanú prázdne.',
  'app.table': 'Tabuľka hodnôt',
  'app.attribution': 'Dáta: Open-Meteo (CC BY 4.0), model ECMWF IFS.',
  'app.settings': 'Nastavenia',

  'header.change': 'zmeniť',
  'header.model': 'model {value} m',
  'header.terrain': 'terén {value} m',
  'header.elevationHigher':
    'Modelový bod je o {value} m vyššie než terén, teplota preto môže byť systematicky posunutá.',
  'header.elevationLower':
    'Modelový bod je o {value} m nižšie než terén, teplota preto môže byť systematicky posunutá.',
  'header.corrected': 'Teplota je prepočítaná na výšku terénu.',

  'search.title': 'Výber lokality',
  'search.placeholder': 'Hľadať obec alebo mesto',
  'search.label': 'Hľadať lokalitu',
  'search.close': 'Zavrieť',
  'search.locate': 'Moja poloha',
  'search.locating': 'Zisťujem polohu…',
  'search.noGeolocation': 'Prehliadač polohu neposkytuje.',
  'search.geolocationFailed': 'Polohu sa nepodarilo zistiť.',
  'search.failed': 'Vyhľadávanie zlyhalo. Skúste to znova.',
  'search.searching': 'Hľadám…',
  'search.empty': 'Nič sa nenašlo.',
  'search.recent': 'Naposledy zobrazené',

  'panel.temperature': 'Teplota v 2 m',
  'panel.cloud': 'Celková oblačnosť',
  'panel.precipitation': 'Úhrn zrážok',
  'panel.pressure': 'Tlak na hladinu mora',
  'panel.wind': 'Rýchlosť a nárazy vetra',
  'panel.direction': 'Smer vetra',
  'panel.missing': 'Model túto veličinu nedodal.',

  'series.temperature': 'teplota',
  'series.apparent': 'pocitová',
  'series.cloud': 'oblačnosť',
  'series.rain': 'dážď',
  'series.snow': 'sneh',
  'series.pressure': 'tlak',
  'series.wind': 'rýchlosť',
  'series.gust': 'nárazy',
  'series.direction': 'smer',

  'unit.celsius': '°C',
  'unit.percent': '%',
  'unit.mm': 'mm',
  'unit.hpa': 'hPa',
  'unit.ms': 'm/s',
  'unit.kmh': 'km/h',
  'unit.compass': 'svetové strany',

  'chart.label': 'Meteogram – šípkami sa posúva ukazovateľ, klávesmi + a − sa mení priblíženie',
  'chart.hintPointer': 'Kolieskom sa približuje, šípkami posúva ukazovateľ',
  'chart.hintTouch': 'Ťahaním sa posúva, štipcom približuje',
  'chart.zoomIn': 'Priblížiť',
  'chart.zoomOut': 'Oddialiť',
  'chart.zoomReset': 'Celé',
  'chart.textAlternative':
    'Graf je obrázok. Tie isté hodnoty sú v tabuľke pod ním, v sekcii Tabuľka hodnôt.',

  'table.caption': 'Hodinové hodnoty predpovede pre zvolenú lokalitu',
  'table.time': 'Čas',
  'table.temperature': 'Teplota',
  'table.apparent': 'Pocitová',
  'table.cloud': 'Oblačnosť',
  'table.precipitation': 'Zrážky',
  'table.pressure': 'Tlak',
  'table.wind': 'Vietor',
  'table.gust': 'Nárazy',
  'table.direction': 'Smer',

  'settings.title': 'Nastavenia',
  'settings.language': 'Jazyk',
  'settings.theme': 'Motív',
  'settings.themeAuto': 'Auto',
  'settings.themeLight': 'Svetlý',
  'settings.themeDark': 'Tmavý',
  'settings.windUnit': 'Jednotka vetra',
  'settings.elevation': 'Prepočítať teplotu na výšku terénu',
  'settings.elevationHelp':
    'Model počíta v inej nadmorskej výške než skutočný terén. Prepočet použije gradient 0,65 °C na 100 m.',
  'settings.close': 'Zavrieť',
};

export type Dictionary = typeof sk;
export type MessageKey = keyof Dictionary;

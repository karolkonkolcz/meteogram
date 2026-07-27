import { describe, expect, it } from 'vitest';
import {
  addRecent,
  isCoordinateName,
  isSameLocation,
  locationToParams,
  parseLocationFromParams,
  type Location,
} from './location';

const LUBOVNA: Location = { name: 'Nová Ľubovňa', latitude: 49.276, longitude: 20.683 };

describe('parseLocationFromParams', () => {
  it('přečte lokalitu ze sdíleného odkazu', () => {
    const location = parseLocationFromParams(
      new URLSearchParams('lat=49.276&lon=20.683&name=Nov%C3%A1%20%C4%BDubov%C5%88a'),
    );
    expect(location).toEqual(LUBOVNA);
  });

  it('vrátí null, když souřadnice v URL chybí', () => {
    expect(parseLocationFromParams(new URLSearchParams('name=Praha'))).toBeNull();
    expect(parseLocationFromParams(new URLSearchParams('lat=49.2'))).toBeNull();
  });

  it('zahodí souřadnice mimo rozsah i nečíselné', () => {
    expect(parseLocationFromParams(new URLSearchParams('lat=91&lon=20'))).toBeNull();
    expect(parseLocationFromParams(new URLSearchParams('lat=49&lon=181'))).toBeNull();
    expect(parseLocationFromParams(new URLSearchParams('lat=abc&lon=20'))).toBeNull();
  });

  it('při chybějícím názvu použije souřadnice', () => {
    const location = parseLocationFromParams(new URLSearchParams('lat=49.276&lon=20.683'));
    expect(location?.name).toBe('49.276, 20.683');
  });

  it('ořízne přehnaně dlouhý název z URL', () => {
    const params = new URLSearchParams({ lat: '49', lon: '20', name: 'x'.repeat(500) });
    expect(parseLocationFromParams(params)?.name).toHaveLength(120);
  });
});

describe('locationToParams', () => {
  it('je zpětně čitelný vlastním parserem', () => {
    const params = locationToParams(LUBOVNA);
    expect(parseLocationFromParams(params)).toEqual(LUBOVNA);
  });

  it('zkrátí souřadnice na pět desetinných míst', () => {
    const params = locationToParams({ ...LUBOVNA, latitude: 49.2761234567 });
    expect(params.get('lat')).toBe('49.27612');
  });
});

describe('seznam posledních lokalit', () => {
  it('řadí naposledy vybranou nahoru', () => {
    const praha: Location = { name: 'Praha', latitude: 50.08, longitude: 14.44 };
    const list = addRecent([praha], LUBOVNA);
    expect(list.map((item) => item.name)).toEqual(['Nová Ľubovňa', 'Praha']);
  });

  it('neduplikuje tutéž lokalitu', () => {
    const list = addRecent([LUBOVNA], { ...LUBOVNA, name: 'Nová Ľubovňa (znovu)' });
    expect(list).toHaveLength(1);
  });

  it('drží nejvýš osm položek', () => {
    let list: Location[] = [];
    for (let index = 0; index < 12; index += 1) {
      list = addRecent(list, { name: `Obec ${index}`, latitude: index, longitude: index });
    }
    expect(list).toHaveLength(8);
    expect(list[0]?.name).toBe('Obec 11');
  });
});

describe('isSameLocation', () => {
  it('toleruje zaokrouhlení na ~10 m', () => {
    expect(isSameLocation(LUBOVNA, { ...LUBOVNA, latitude: 49.27601 })).toBe(true);
    expect(isSameLocation(LUBOVNA, { ...LUBOVNA, latitude: 49.3 })).toBe(false);
  });
});

describe('isCoordinateName', () => {
  it('pozná lokalitu pojmenovanou souřadnicemi', () => {
    expect(isCoordinateName('50.651, 14.003')).toBe(true);
    expect(isCoordinateName('-33.9, 151.2')).toBe(true);
    expect(isCoordinateName(' 49.276, 20.683 ')).toBe(true);
  });

  it('skutečné jméno místa nechá být', () => {
    expect(isCoordinateName('Nová Ľubovňa')).toBe(false);
    expect(isCoordinateName('Praha 6')).toBe(false);
    expect(isCoordinateName('50.651')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { parseGeocodingResults, pickPlaceName } from './geocoding';

describe('parseGeocodingResults', () => {
  it('prevedie výsledky na lokality vrátane kraja a štátu', () => {
    const results = parseGeocodingResults({
      results: [
        {
          id: 3058016,
          name: 'Nová Ľubovňa',
          latitude: 49.27639,
          longitude: 20.68306,
          admin1: 'Prešovský kraj',
          country: 'Slovensko',
        },
      ],
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      name: 'Nová Ľubovňa',
      admin: 'Prešovský kraj',
      country: 'Slovensko',
    });
  });

  it('prázdna odpoveď je prázdny zoznam, nie chyba', () => {
    expect(parseGeocodingResults({})).toEqual([]);
    expect(parseGeocodingResults(null)).toEqual([]);
  });

  it('preskočí položky bez súradníc', () => {
    const results = parseGeocodingResults({
      results: [{ name: 'Bez súradníc' }, { name: 'Praha', latitude: 50.08, longitude: 14.44 }],
    });
    expect(results.map((item) => item.name)).toEqual(['Praha']);
  });
});

describe('pickPlaceName', () => {
  it('upřednostní město před krajem', () => {
    expect(
      pickPlaceName({ city: 'Děčín', locality: 'Podmokly', principalSubdivision: 'Ústecký kraj' }),
    ).toBe('Děčín');
  });

  it('bez města vezme lokalitu, pak kraj', () => {
    expect(pickPlaceName({ locality: 'Podmokly', principalSubdivision: 'Ústecký kraj' })).toBe(
      'Podmokly',
    );
    expect(pickPlaceName({ principalSubdivision: 'Ústecký kraj' })).toBe('Ústecký kraj');
  });

  it('prázdné a neúplné odpovědi nedají jméno', () => {
    expect(pickPlaceName({ city: '   ' })).toBeNull();
    expect(pickPlaceName({})).toBeNull();
    expect(pickPlaceName(null)).toBeNull();
  });
});

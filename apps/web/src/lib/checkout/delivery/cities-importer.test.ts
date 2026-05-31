/**
 * DELIV-CITIES — Tests unitaires de l'importer pur.
 *
 * Couvre :
 *  - slugifyCity : ASCII, diacritiques, apostrophes, casse, espaces multiples.
 *  - parsePriceMad : string/number/empty/decimal/suffixe ("45 MAD").
 *  - normalizeEta : trim, lowercase, espaces collapsés.
 *  - parseSenditFixture :
 *      * sortie standard (id stable, slug ASCII, MAD entier, externalRef).
 *      * dedup par slug → garde le pk LE PLUS PETIT (règle métier).
 *      * drop des records invalides + raisons agrégées.
 *      * overlay alias depuis MOROCCAN_CITIES (Casablanca → ['Casa', …]).
 *      * tri alphabétique stable.
 *      * tolérance : entrées non-tableau, fields absents, prix non parsable.
 */
import { describe, it, expect } from 'vitest';

import {
  normalizeEta,
  parsePriceMad,
  parseSenditFixture,
  slugifyCity,
  stripArabicZoneSuffix,
  type SenditCityRecord,
} from './cities-importer';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRec(
  pk: number,
  fields: Partial<SenditCityRecord['fields']> & { city: string },
): SenditCityRecord {
  return {
    model: 'delivery_gateway.senditcity',
    pk,
    fields: {
      city: fields.city,
      name: fields.name ?? fields.city,
      arabic_name: fields.arabic_name ?? null,
      price: fields.price ?? '45',
      delais: fields.delais ?? '24h - 48h',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// slugifyCity
// ─────────────────────────────────────────────────────────────────────────────

describe('slugifyCity', () => {
  it('ASCII direct', () => {
    expect(slugifyCity('Casablanca')).toBe('casablanca');
  });

  it('retire les apostrophes (droites et courbes)', () => {
    expect(slugifyCity("Ighrem N'ougdal")).toBe('ighrem-nougdal');
    expect(slugifyCity('Ighrem N\u2019ougdal')).toBe('ighrem-nougdal');
  });

  it('retire les diacritiques', () => {
    expect(slugifyCity('Aïn Sebaâ')).toBe('ain-sebaa');
    expect(slugifyCity('Béni Mellal')).toBe('beni-mellal');
    expect(slugifyCity('Kénitra')).toBe('kenitra');
    expect(slugifyCity('Témara')).toBe('temara');
  });

  it('collapse les espaces multiples', () => {
    expect(slugifyCity('Tabounte   Ouarzazate')).toBe('tabounte-ouarzazate');
  });

  it('trim les tirets de bords', () => {
    expect(slugifyCity('   Casa   ')).toBe('casa');
    expect(slugifyCity('-Casa-')).toBe('casa');
  });

  it('retourne chaîne vide si non-alphanumérique seulement', () => {
    expect(slugifyCity("'''")).toBe('');
    expect(slugifyCity('   ')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parsePriceMad
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePriceMad', () => {
  it('parse un string numérique standard', () => {
    expect(parsePriceMad('45')).toBe(45);
    expect(parsePriceMad('29')).toBe(29);
  });

  it('parse un number direct', () => {
    expect(parsePriceMad(35)).toBe(35);
  });

  it('arrondit les décimaux', () => {
    expect(parsePriceMad('29.5')).toBe(30);
    expect(parsePriceMad('29,5')).toBe(30);
    expect(parsePriceMad(29.4)).toBe(29);
  });

  it('tolère un suffixe "MAD" / "dh"', () => {
    expect(parsePriceMad('45 MAD')).toBe(45);
    expect(parsePriceMad('29 dh')).toBe(29);
    expect(parsePriceMad('19 د.م')).toBe(19);
  });

  it('clamp >= 0', () => {
    expect(parsePriceMad(-5)).toBe(0);
    expect(parsePriceMad('-10')).toBe(0);
  });

  it('renvoie null si non parsable', () => {
    expect(parsePriceMad('abc')).toBeNull();
    expect(parsePriceMad('')).toBeNull();
    expect(parsePriceMad(null)).toBeNull();
    expect(parsePriceMad(undefined)).toBeNull();
    expect(parsePriceMad({})).toBeNull();
    expect(parsePriceMad(NaN)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeEta
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeEta', () => {
  it('passe les ETA standards en lowercase', () => {
    expect(normalizeEta('24h')).toBe('24h');
    expect(normalizeEta('24h - 48h')).toBe('24h - 48h');
    expect(normalizeEta('24h - 72h')).toBe('24h - 72h');
    expect(normalizeEta('48h - 96h')).toBe('48h - 96h');
  });

  it('trim et lowercase', () => {
    expect(normalizeEta('  24H  ')).toBe('24h');
  });

  it('collapse les espaces multiples', () => {
    expect(normalizeEta('24h   -   48h')).toBe('24h - 48h');
  });

  it('retourne null si vide', () => {
    expect(normalizeEta('')).toBeNull();
    expect(normalizeEta('   ')).toBeNull();
    expect(normalizeEta(null)).toBeNull();
    expect(normalizeEta(undefined)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stripArabicZoneSuffix
// ─────────────────────────────────────────────────────────────────────────────

describe('stripArabicZoneSuffix', () => {
  it('strip un suffixe " - <zone>" hyphen-minus', () => {
    expect(stripArabicZoneSuffix('الدار البيضاء - الفداء')).toBe(
      'الدار البيضاء',
    );
  });

  it('strip un suffixe " — <zone>" em-dash', () => {
    expect(stripArabicZoneSuffix('الدار البيضاء — عبد المومن')).toBe(
      'الدار البيضاء',
    );
  });

  it('no-op si pas de séparateur', () => {
    expect(stripArabicZoneSuffix('الدار البيضاء')).toBe('الدار البيضاء');
  });

  it('trim le résultat', () => {
    expect(stripArabicZoneSuffix('  الدار البيضاء   -   الفداء')).toBe(
      'الدار البيضاء',
    );
  });

  it('préserve les hyphens nus (sans espaces) — ne casse pas les noms composés', () => {
    expect(stripArabicZoneSuffix('سيدي-قاسم')).toBe('سيدي-قاسم');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseSenditFixture
// ─────────────────────────────────────────────────────────────────────────────

describe('parseSenditFixture — sortie standard', () => {
  it('mappe un record sendit en ImportedCity (champs complets)', () => {
    const fixture = [
      makeRec(100, {
        city: 'Casablanca',
        name: 'Casablanca',
        arabic_name: 'الدار البيضاء',
        price: '29',
        delais: '24h',
      }),
    ];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(1);
    expect(cities[0]).toMatchObject({
      id: 'dc_casablanca',
      slug: 'casablanca',
      nameFr: 'Casablanca',
      nameAr: 'الدار البيضاء',
      countryCode: 'MA',
      deliveryPriceMad: 29,
      deliveryEta: '24h',
      isActive: true,
      source: 'sendit',
      externalRef: 'sendit:100',
      position: 1, // Casablanca est une ville prioritaire (position 1)
    });
    expect(summary).toEqual({
      parsed: 1,
      unique: 1,
      dropped: 0,
      droppedReasons: {},
    });
  });

  it('produit un id déterministe basé sur le slug (idempotence)', () => {
    const a = parseSenditFixture([makeRec(1, { city: 'Casablanca' })]);
    const b = parseSenditFixture([makeRec(999, { city: 'Casablanca' })]);
    expect(a.cities[0]?.id).toBe('dc_casablanca');
    expect(b.cities[0]?.id).toBe('dc_casablanca');
  });

  it('arrondit le prix décimal en MAD entier (PAS centimes)', () => {
    const { cities } = parseSenditFixture([
      makeRec(1, { city: 'Test', price: '29.5' }),
    ]);
    expect(cities[0]?.deliveryPriceMad).toBe(30);
  });

  it('externalRef est `sendit:${pk}` pour traçabilité', () => {
    const { cities } = parseSenditFixture([makeRec(617, { city: 'Test' })]);
    expect(cities[0]?.externalRef).toBe('sendit:617');
  });
});

describe('parseSenditFixture — dedup par slug (smallest pk wins)', () => {
  it('garde le pk LE PLUS PETIT en cas de doublon', () => {
    // Doublons : 3 records pour "Casablanca" avec pk 200, 100, 300
    const fixture = [
      makeRec(200, { city: 'Casablanca', price: '50', delais: 'X' }),
      makeRec(100, { city: 'Casablanca', price: '29', delais: '24h' }),
      makeRec(300, { city: 'Casablanca', price: '99', delais: 'Y' }),
    ];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(1);
    // pk=100 gagne → price=29, delais='24h', externalRef='sendit:100'
    expect(cities[0]?.deliveryPriceMad).toBe(29);
    expect(cities[0]?.deliveryEta).toBe('24h');
    expect(cities[0]?.externalRef).toBe('sendit:100');
    expect(summary.dropped).toBe(2);
    expect(summary.droppedReasons.duplicate_slug).toBe(2);
  });

  it('dedup résiste à l\'ordre du tableau d\'entrée', () => {
    // Même test, mais le pk le plus petit est en dernier
    const fixture = [
      makeRec(300, { city: 'Casablanca', price: '99' }),
      makeRec(200, { city: 'Casablanca', price: '50' }),
      makeRec(100, { city: 'Casablanca', price: '29' }),
    ];
    const { cities } = parseSenditFixture(fixture);
    expect(cities[0]?.deliveryPriceMad).toBe(29);
    expect(cities[0]?.externalRef).toBe('sendit:100');
  });

  it('considère des noms typographiques différents comme le même slug', () => {
    const fixture = [
      makeRec(500, { city: 'Casablanca', price: '50' }),
      makeRec(100, { city: 'CASABLANCA  ', price: '29' }),
      makeRec(300, { city: '   casablanca', price: '40' }),
    ];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(1);
    expect(cities[0]?.deliveryPriceMad).toBe(29);
    expect(summary.droppedReasons.duplicate_slug).toBe(2);
  });
});

describe('parseSenditFixture — overlay alias depuis MOROCCAN_CITIES', () => {
  it('Casablanca hérite des alias historiques (Casa, Dar el Beida, …)', () => {
    const { cities } = parseSenditFixture([makeRec(1, { city: 'Casablanca' })]);
    expect(cities[0]?.aliases).toEqual(
      expect.arrayContaining(['Casa', 'Dar el Beida']),
    );
  });

  it('une ville inconnue ne reçoit pas d\'alias', () => {
    const { cities } = parseSenditFixture([
      makeRec(1, { city: 'Ighrem N\u2019ougdal' }),
    ]);
    expect(cities[0]?.aliases).toEqual([]);
  });

  it('fall-back sur nameAr du overlay si fixture n\'en fournit pas', () => {
    const { cities } = parseSenditFixture([
      makeRec(1, { city: 'Rabat', arabic_name: null }),
    ]);
    expect(cities[0]?.nameAr).toBe('الرباط'); // overlay MOROCCAN_CITIES
  });
});

describe('parseSenditFixture — drops & raisons', () => {
  it('drop record sans nom', () => {
    const fixture = [makeRec(1, { city: '' })];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(0);
    expect(summary.droppedReasons.missing_name).toBe(1);
  });

  it('drop record sans prix parsable', () => {
    const fixture = [makeRec(1, { city: 'X', price: 'abc' })];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(0);
    expect(summary.droppedReasons.invalid_price).toBe(1);
  });

  it('drop record sans ETA', () => {
    const fixture = [makeRec(1, { city: 'X', delais: '' })];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(0);
    expect(summary.droppedReasons.missing_eta).toBe(1);
  });

  it('drop record dont la slugification donne une chaîne vide', () => {
    const fixture = [makeRec(1, { city: "'''" })];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(0);
    expect(summary.droppedReasons.empty_slug).toBe(1);
  });
});

describe('parseSenditFixture — tolérance entrées invalides', () => {
  it('retourne vide si l\'entrée n\'est pas un tableau', () => {
    expect(parseSenditFixture(null).cities).toEqual([]);
    expect(parseSenditFixture({}).cities).toEqual([]);
    expect(parseSenditFixture('foo').cities).toEqual([]);
    expect(parseSenditFixture(parseSenditFixture(null).cities)).toEqual({
      cities: [],
      summary: expect.any(Object),
    });
  });

  it('ignore les records avec fields manquants', () => {
    const fixture = [
      { pk: 1, fields: null },
      { pk: 2 },
      makeRec(3, { city: 'Rabat' }),
    ] as unknown[];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(1);
    expect(cities[0]?.slug).toBe('rabat');
    expect(summary.droppedReasons.missing_fields).toBe(2);
  });
});

describe('parseSenditFixture — tri alphabétique stable', () => {
  it('trie les sorties par nameFr (locale FR)', () => {
    const fixture = [
      makeRec(10, { city: 'Tanger' }),
      makeRec(20, { city: 'Agadir' }),
      makeRec(30, { city: 'Marrakech' }),
      makeRec(40, { city: 'Béni Mellal' }),
    ];
    const { cities } = parseSenditFixture(fixture);
    const names = cities.map((c) => c.nameFr);
    expect(names).toEqual(['Agadir', 'Béni Mellal', 'Marrakech', 'Tanger']);
  });
});

describe('parseSenditFixture — granularité ville (PAS zone)', () => {
  it('utilise `fields.city` comme nom canonique, IGNORE `fields.name` zone', () => {
    // Reproduit le schéma fixture sendit : `name` = nom de pickup-zone,
    // `city` = ville canonique. On ne doit JAMAIS lire `name`.
    const fixture: SenditCityRecord[] = [
      {
        model: 'delivery_gateway.senditcity',
        pk: 1,
        fields: {
          city: 'Casablanca',
          name: 'Casablanca - Al fida',
          arabic_name: 'الدار البيضاء - الفداء',
          price: '19',
          delais: '24h',
        },
      },
    ];
    const { cities } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(1);
    expect(cities[0]?.slug).toBe('casablanca');
    expect(cities[0]?.nameFr).toBe('Casablanca'); // pas "Casablanca - Al fida"
    expect(cities[0]?.nameAr).toBe('الدار البيضاء'); // suffixe zone stripé
  });

  it('collapse 3 pickup-zones de Casablanca en 1 ville (smallest pk)', () => {
    // Cas réel sendit : Casablanca a 71 entrées de pickup-zones.
    // Échantillon : pk=1 Al fida (19 MAD, 24h), pk=12 Abdelmoumen (19 MAD,
    // 24h), pk=45 Beausejour (19 MAD, 24h-48h différent !).
    const fixture: SenditCityRecord[] = [
      {
        model: 'delivery_gateway.senditcity',
        pk: 45,
        fields: {
          city: 'Casablanca',
          name: 'Casablanca - Beausejour',
          arabic_name: 'الدار البيضاء - بوسجور',
          price: '19',
          delais: '24h - 48h',
        },
      },
      {
        model: 'delivery_gateway.senditcity',
        pk: 1,
        fields: {
          city: 'Casablanca',
          name: 'Casablanca - Al fida',
          arabic_name: 'الدار البيضاء - الفداء',
          price: '19',
          delais: '24h',
        },
      },
      {
        model: 'delivery_gateway.senditcity',
        pk: 12,
        fields: {
          city: 'Casablanca',
          name: 'Casablanca - Abdelmoumen',
          arabic_name: 'الدار البيضاء - عبد المومن',
          price: '19',
          delais: '24h',
        },
      },
    ];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(1);
    expect(cities[0]?.slug).toBe('casablanca');
    expect(cities[0]?.nameFr).toBe('Casablanca');
    expect(cities[0]?.nameAr).toBe('الدار البيضاء');
    expect(cities[0]?.deliveryEta).toBe('24h'); // pk=1 gagne → 24h
    expect(cities[0]?.externalRef).toBe('sendit:1');
    expect(summary.dropped).toBe(2);
    expect(summary.droppedReasons.duplicate_slug).toBe(2);
  });

  it('drop record si `fields.city` est vide même si `fields.name` est rempli', () => {
    const fixture = [
      {
        model: 'delivery_gateway.senditcity',
        pk: 1,
        fields: {
          city: '', // vide → drop, même si name=valide
          name: 'Quelque part',
          arabic_name: null,
          price: '45',
          delais: '24h',
        },
      },
    ];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(0);
    expect(summary.droppedReasons.missing_name).toBe(1);
  });
});

describe('parseSenditFixture — fixture réel (smoke)', () => {
  it('parse un échantillon de fixture sendit sans erreur', () => {
    const fixture = [
      {
        model: 'delivery_gateway.senditcity',
        pk: 617,
        fields: {
          city: "Ighrem N'ougdal",
          name: "Ighrem N'ougdal",
          arabic_name: 'إيغرم ن أوكدال',
          price: '45',
          delais: '24h - 72h',
        },
      },
      {
        model: 'delivery_gateway.senditcity',
        pk: 1,
        fields: {
          city: 'Casablanca',
          name: 'Casablanca',
          arabic_name: 'الدار البيضاء',
          price: '29',
          delais: '24h',
        },
      },
    ];
    const { cities, summary } = parseSenditFixture(fixture);
    expect(cities).toHaveLength(2);
    expect(summary.parsed).toBe(2);
    expect(summary.unique).toBe(2);
    expect(summary.dropped).toBe(0);
    // Ordre alphabétique : Casablanca avant Ighrem N'ougdal
    expect(cities[0]?.slug).toBe('casablanca');
    expect(cities[1]?.slug).toBe('ighrem-nougdal');
  });
});

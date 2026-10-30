/**
 * Tests — analyse de l'arborescence d'import (module pur, 05 §4.8).
 */
import { describe, expect, it } from 'vitest';
import {
  KIT_HERO_MEDIA_VARIANTS,
  findComponentSeed,
  type SiteComponentSeed,
} from '@/lib/components/registry';
import {
  buildImportMediaSlug,
  buildImportPlan,
  forkImportMediaSlug,
  libraryAltFor,
  parseLocaleDir,
  parseVariantDir,
  planHasErrors,
  sanitizeAlt,
  type AltFileContent,
  type ImportIssue,
} from './component-media-import';

const KIT = 'kit-hero-produit';
const ALT = { fr: 'Ongles brillants', ar: 'أظافر لامعة', en: 'Shiny nails' };

/** Registre de test : le vrai hero kit + un composant A/B + un composant sans politique. */
const KIT_SEED = findComponentSeed(KIT)!;
const AB_SEED: SiteComponentSeed = {
  ...KIT_SEED,
  key: 'test-ab',
  mediaVariants: {
    ...KIT_HERO_MEDIA_VARIANTS,
    dimensions: ['ab:hero-media-2026-11', 'angle'],
  },
};
const PLAIN_SEED: SiteComponentSeed = { ...KIT_SEED, key: 'test-plain', mediaVariants: undefined };
const REGISTRY = [KIT_SEED, AB_SEED, PLAIN_SEED];

function ok(value: unknown): AltFileContent {
  return { ok: true, value };
}

function codes(issues: readonly ImportIssue[], severity?: ImportIssue['severity']): string[] {
  return issues.filter((i) => !severity || i.severity === severity).map((i) => i.code);
}

function plan(files: string[], altFiles: Record<string, AltFileContent> = {}, componentKey?: string) {
  return buildImportPlan({ files, altFiles, registry: REGISTRY, ...(componentKey ? { componentKey } : {}) });
}

/** Image desktop + mobile + alt d'une position. */
function trio(folder: string, nn: string, slug: string, alt: unknown = ALT) {
  const stem = `${folder}/${nn}-${slug}`;
  return {
    files: [`${stem}.png`, `${stem}.mobile.png`, `${stem}.alt.json`],
    alts: { [`${stem}.alt.json`]: ok(alt) } as Record<string, AltFileContent>,
  };
}

function tree(...parts: Array<ReturnType<typeof trio>>) {
  return {
    files: parts.flatMap((p) => p.files),
    alts: Object.assign({}, ...parts.map((p) => p.alts)) as Record<string, AltFileContent>,
  };
}

describe('parseVariantDir', () => {
  it('default, angle-<clé>, ab-<expKey>-<bras> (expKey à tirets via la politique)', () => {
    expect(parseVariantDir('default')).toEqual({ variantDim: 'default', variantKey: '*' });
    expect(parseVariantDir('angle-e')).toEqual({ variantDim: 'angle', variantKey: 'e' });
    expect(parseVariantDir('angle-temoin')).toEqual({ variantDim: 'angle', variantKey: 'temoin' });
    expect(parseVariantDir('ab-hero-media-2026-11-b', { dimensions: ['ab:hero-media-2026-11'] })).toEqual({
      variantDim: 'ab:hero-media-2026-11',
      variantKey: 'b',
    });
    // Sans dimension déclarée : coupure au dernier tiret.
    expect(parseVariantDir('ab-exp-b')).toEqual({ variantDim: 'ab:exp', variantKey: 'b' });
  });

  it('refuse les noms hors convention', () => {
    for (const dir of ['angle-', 'ab-', 'ab-solo', 'Default', 'angle_e', 'temoin', '*']) {
      expect(parseVariantDir(dir)).toBeNull();
    }
  });
});

describe('parseLocaleDir', () => {
  it('fr / ar / en, et _all → * avec crossLocale', () => {
    expect(parseLocaleDir('fr')).toEqual({ locale: 'fr', crossLocale: false });
    expect(parseLocaleDir('ar')).toEqual({ locale: 'ar', crossLocale: false });
    expect(parseLocaleDir('en')).toEqual({ locale: 'en', crossLocale: false });
    expect(parseLocaleDir('_all')).toEqual({ locale: '*', crossLocale: true });
    expect(parseLocaleDir('*')).toBeNull();
    expect(parseLocaleDir('es')).toBeNull();
    expect(parseLocaleDir('all')).toBeNull();
  });
});

describe('buildImportMediaSlug / forkImportMediaSlug', () => {
  const parts = {
    componentKey: KIT,
    slot: 'secondary',
    variantDir: 'angle-a',
    localeDir: '_all',
    position: '01',
    slug: 'texture-bord',
  };

  it('suit le format cmv-<component>-<slot>-<variant>-<locale>-<nn>-<slug>[-mobile]', () => {
    expect(buildImportMediaSlug({ ...parts, mobile: false })).toBe(
      'cmv-kit-hero-produit-secondary-angle-a-all-01-texture-bord',
    );
    expect(buildImportMediaSlug({ ...parts, mobile: true })).toBe(
      'cmv-kit-hero-produit-secondary-angle-a-all-01-texture-bord-mobile',
    );
  });

  it('reste ≤ 80 caractères, unique et stable au-delà (troncature + empreinte)', () => {
    const long = { ...parts, slug: 'texture-bord-ongle-sans-epaisseur-tres-tres-long-nom' };
    const desktop = buildImportMediaSlug({ ...long, mobile: false });
    const mobile = buildImportMediaSlug({ ...long, mobile: true });
    expect(desktop.length).toBeLessThanOrEqual(80);
    expect(mobile.length).toBeLessThanOrEqual(80);
    expect(desktop).not.toBe(mobile);
    expect(buildImportMediaSlug({ ...long, mobile: false })).toBe(desktop);
    expect(desktop).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('fork : suffixe par l’empreinte, ≤ 80 caractères', () => {
    const slug = buildImportMediaSlug({ ...parts, mobile: false });
    expect(forkImportMediaSlug(slug, 'sha256-abcdef0123456789')).toBe(`${slug}-abcdef01`);
    const long = 'a'.repeat(80);
    expect(forkImportMediaSlug(long, 'sha256-abcdef0123456789')).toHaveLength(80);
  });
});

describe('sanitizeAlt / libraryAltFor', () => {
  it('garde fr/ar/en non vides, signale le reste', () => {
    const issues: ImportIssue[] = [];
    const alt = sanitizeAlt({ fr: '  Bonjour ', ar: '', es: 'Hola', en: 3 }, 'x.alt.json', issues);
    expect(alt).toEqual({ fr: 'Bonjour' });
    expect(codes(issues)).toEqual(['alt.empty', 'alt.locale_unknown', 'alt.empty']);
    expect(codes(issues, 'error')).toEqual([]);
  });

  it('refuse un alt trop long ou non objet', () => {
    const issues: ImportIssue[] = [];
    sanitizeAlt({ fr: 'x'.repeat(301) }, 'a', issues);
    sanitizeAlt(['fr'], 'b', issues);
    expect(codes(issues, 'error')).toEqual(['alt.too_long', 'alt.invalid']);
  });

  it('alt de médiathèque : fr > en > ar > slug lisible', () => {
    expect(libraryAltFor(ALT, 'x')).toBe(ALT.fr);
    expect(libraryAltFor({ ar: 'ع', en: 'E' }, 'x')).toBe('E');
    expect(libraryAltFor({ ar: 'ع' }, 'x')).toBe('ع');
    expect(libraryAltFor({}, 'kit-en-main')).toBe('kit en main');
  });
});

describe('buildImportPlan — arborescence valide', () => {
  it('construit un ensemble par dossier, apparie mobile et alt, ordonne par position', () => {
    const t = tree(
      trio(`${KIT}/primary/angle-e/_all`, '01', 'fini-salon'),
      trio(`${KIT}/secondary/angle-e/_all`, '02', 'kit-en-main'),
      trio(`${KIT}/secondary/angle-e/_all`, '01', 'salon-vs-maison'),
      trio(`${KIT}/secondary/default/fr`, '01', 'avant-apres'),
    );
    const p = plan(t.files, t.alts);
    expect(codes(p.issues)).toEqual([]);
    expect(planHasErrors(p)).toBe(false);
    expect(p.sets.map((s) => [s.slot, s.variantDim, s.variantKey, s.locale, s.crossLocale, s.items.length])).toEqual([
      ['primary', 'angle', 'e', '*', true, 1],
      ['secondary', 'angle', 'e', '*', true, 2],
      ['secondary', 'default', '*', 'fr', false, 1],
    ]);
    const secondary = p.sets[1]!;
    expect(secondary.folder).toBe(`${KIT}/secondary/angle-e/_all`);
    expect(secondary.items.map((i) => [i.position, i.slug])).toEqual([
      [1, 'salon-vs-maison'],
      [2, 'kit-en-main'],
    ]);
    const first = secondary.items[0]!;
    expect(first.desktop).toEqual({
      relPath: `${KIT}/secondary/angle-e/_all/01-salon-vs-maison.png`,
      mediaSlug: 'cmv-kit-hero-produit-secondary-angle-e-all-01-salon-vs-maison',
    });
    expect(first.mobile?.mediaSlug).toBe('cmv-kit-hero-produit-secondary-angle-e-all-01-salon-vs-maison-mobile');
    expect(first.alt).toEqual(ALT);
    expect(first.altSource).toBe('file');
  });

  it('accepte une image sans version mobile (mobileMediaId vide)', () => {
    const files = [`${KIT}/primary/default/_all/01-packshot.jpg`, `${KIT}/primary/default/_all/01-packshot.alt.json`];
    const p = plan(files, { [files[1]!]: ok(ALT) });
    expect(planHasErrors(p)).toBe(false);
    expect(p.sets[0]?.items[0]?.mobile).toBeNull();
    expect(p.sets[0]?.items[0]?.desktop.relPath).toBe(files[0]);
  });

  it('ignore à la racine les entrées _* et cachées, et les fichiers cachés partout', () => {
    const t = trio(`${KIT}/primary/default/_all`, '01', 'packshot');
    const p = plan([
      ...t.files,
      '_log.csv',
      '_work/HP-1/master.png',
      '.gitignore',
      `${KIT}/primary/default/_all/.DS_Store`,
    ], t.alts);
    expect(codes(p.issues)).toEqual([]);
    expect(p.ignored).toEqual([
      '.gitignore',
      '_log.csv',
      '_work/HP-1/master.png',
      `${KIT}/primary/default/_all/.DS_Store`,
    ]);
  });

  it('variante A/B dont la clé d’expérience contient des tirets', () => {
    const t = trio('test-ab/secondary/ab-hero-media-2026-11-b/fr', '01', 'x');
    const p = plan(t.files, t.alts);
    expect(codes(p.issues)).toEqual([]);
    expect(p.sets[0]).toMatchObject({ variantDim: 'ab:hero-media-2026-11', variantKey: 'b', locale: 'fr' });
  });

  it('--component ne retient que ce composant', () => {
    const t = tree(trio(`${KIT}/primary/default/_all`, '01', 'a'), trio('test-ab/primary/default/_all', '01', 'b'));
    const p = plan(t.files, t.alts, KIT);
    expect(p.sets.map((s) => s.componentKey)).toEqual([KIT]);
    expect(p.ignored.every((f) => f.startsWith('test-ab/'))).toBe(true);
  });
});

describe('buildImportPlan — chemins invalides', () => {
  it('composant inconnu (signalé une fois) ou sans politique mediaVariants', () => {
    const p = plan([
      'inconnu/primary/default/_all/01-a.png',
      'inconnu/primary/default/_all/02-b.png',
      'test-plain/primary/default/_all/01-a.png',
    ]);
    expect(codes(p.issues, 'error')).toEqual(['component.unknown', 'component.no_media_variants']);
    expect(p.sets).toEqual([]);
  });

  it('--component inconnu', () => {
    expect(codes(plan([], {}, 'nope').issues)).toEqual(['component.unknown']);
  });

  it('slot non déclaré', () => {
    const t = trio(`${KIT}/tertiary/default/_all`, '01', 'a');
    const p = plan(t.files, t.alts);
    expect(codes(p.issues, 'error')).toEqual(['slot.unknown']);
    expect(p.sets).toEqual([]);
  });

  it('variante hors convention, dimension non déclarée, clé invalide', () => {
    const t = tree(
      trio(`${KIT}/primary/angle_e/_all`, '01', 'a'),
      trio(`${KIT}/primary/ab-exp-b/_all`, '01', 'b'),
      trio(`${KIT}/primary/angle-z/_all`, '01', 'c'),
    );
    const p = plan(t.files, t.alts);
    expect(codes(p.issues, 'error').sort()).toEqual(
      ['variant.dimension_unknown', 'variant.invalid', 'variant.key_invalid'].sort(),
    );
    expect(p.sets).toEqual([]);
  });

  it('langue hors convention (y compris `*` et `all`)', () => {
    const t = tree(
      trio(`${KIT}/primary/default/es`, '01', 'a'),
      trio(`${KIT}/primary/angle-a/all`, '01', 'b'),
    );
    expect(codes(plan(t.files, t.alts).issues, 'error')).toEqual(['locale.invalid', 'locale.invalid']);
  });

  it('profondeur incorrecte', () => {
    const p = plan([`${KIT}/primary/default/01-a.png`, `${KIT}/primary/default/_all/extra/01-a.png`]);
    expect(codes(p.issues, 'error')).toEqual(['path.depth', 'path.depth']);
  });

  it('fichier hors convention : avertissement, le reste du dossier passe', () => {
    const t = trio(`${KIT}/primary/default/_all`, '01', 'a');
    const p = plan([...t.files, `${KIT}/primary/default/_all/notes.txt`, `${KIT}/primary/default/_all/1-a.png`], t.alts);
    expect(codes(p.issues)).toEqual(['file.unrecognized', 'file.unrecognized']);
    expect(planHasErrors(p)).toBe(false);
    expect(p.sets).toHaveLength(1);
  });

  it('un dossier en erreur n’empêche pas les autres', () => {
    const t = tree(trio(`${KIT}/primary/angle-z/_all`, '01', 'a'), trio(`${KIT}/primary/angle-a/_all`, '01', 'b'));
    const p = plan(t.files, t.alts);
    expect(codes(p.issues, 'error')).toEqual(['variant.key_invalid']);
    expect(p.sets.map((s) => s.variantKey)).toEqual(['a']);
  });
});

describe('buildImportPlan — positions et nombre d’items', () => {
  const folder = `${KIT}/secondary/angle-b/_all`;

  it('positions non contiguës (trou ou départ à 02)', () => {
    const gap = tree(trio(folder, '01', 'a'), trio(folder, '03', 'c'));
    expect(codes(plan(gap.files, gap.alts).issues, 'error')).toEqual(['positions.not_contiguous']);
    const late = tree(trio(folder, '02', 'b'));
    expect(codes(plan(late.files, late.alts).issues, 'error')).toEqual(['positions.not_contiguous']);
  });

  it('trop d’images pour une liste (maxItems = 6)', () => {
    const t = tree(...['01', '02', '03', '04', '05', '06', '07'].map((nn) => trio(folder, nn, `s${nn}`)));
    const p = plan(t.files, t.alts);
    expect(codes(p.issues, 'error')).toEqual(['slot.too_many']);
    expect(p.sets).toEqual([]);
    const six = tree(...['01', '02', '03', '04', '05', '06'].map((nn) => trio(folder, nn, `s${nn}`)));
    expect(planHasErrors(plan(six.files, six.alts))).toBe(false);
  });

  it('slot single avec deux fichiers', () => {
    const t = tree(trio(`${KIT}/primary/angle-a/_all`, '01', 'a'), trio(`${KIT}/primary/angle-a/_all`, '02', 'b'));
    expect(codes(plan(t.files, t.alts).issues, 'error')).toEqual(['slot.single_multiple']);
  });

  it('deux images à la même position', () => {
    const t = tree(trio(folder, '01', 'a'), trio(folder, '01', 'b'));
    expect(codes(plan(t.files, t.alts).issues, 'error')).toContain('position.duplicate');
  });

  it('mobile orphelin (slug différent ou sans desktop)', () => {
    const p = plan([`${folder}/01-a.png`, `${folder}/01-b.mobile.png`, `${folder}/02-c.mobile.png`]);
    const errors = p.issues.filter((i) => i.severity === 'error');
    expect(errors.filter((e) => e.code === 'mobile.orphan').map((e) => e.path)).toEqual([
      `${folder}/01-b.mobile.png`,
      `${folder}/02-c.mobile.png`,
    ]);
    expect(p.sets).toEqual([]);
  });
});

describe('buildImportPlan — alts', () => {
  const folder = `${KIT}/secondary/default/_all`;

  it('_alt.json global (objet de langues) appliqué à toutes les images', () => {
    const files = [`${folder}/01-a.png`, `${folder}/02-b.png`, `${folder}/_alt.json`];
    const p = plan(files, { [`${folder}/_alt.json`]: ok(ALT) });
    expect(codes(p.issues)).toEqual([]);
    expect(p.sets[0]?.items.map((i) => [i.alt, i.altSource])).toEqual([
      [ALT, 'folder'],
      [ALT, 'folder'],
    ]);
  });

  it('_alt.json par fichier (clé <nn>-<slug> ou <nn>), le .alt.json de l’image prime', () => {
    const files = [`${folder}/01-a.png`, `${folder}/02-b.png`, `${folder}/03-c.png`, `${folder}/03-c.alt.json`, `${folder}/_alt.json`];
    const p = plan(files, {
      [`${folder}/_alt.json`]: ok({ '01-a': { fr: 'A' }, '02': { fr: 'B', ar: 'ب', en: 'B' }, '03-c': { fr: 'perdu' } }),
      [`${folder}/03-c.alt.json`]: ok({ fr: 'C', ar: 'ج', en: 'C' }),
    });
    expect(p.sets[0]?.items.map((i) => [i.alt.fr, i.altSource])).toEqual([
      ['A', 'folder'],
      ['B', 'folder'],
      ['C', 'file'],
    ]);
    // 01-a n'a que le français.
    expect(p.issues.find((i) => i.code === 'alt.partial')?.path).toBe(`${folder}/01-a.png`);
  });

  it('alt absent : avertissement, alt vide, l’ensemble reste importable', () => {
    const p = plan([`${folder}/01-a.png`]);
    expect(codes(p.issues)).toEqual(['alt.missing']);
    expect(planHasErrors(p)).toBe(false);
    expect(p.sets[0]?.items[0]).toMatchObject({ alt: {}, altSource: 'none' });
  });

  it('JSON invalide : erreur bloquante pour le dossier', () => {
    const files = [`${folder}/01-a.png`, `${folder}/01-a.alt.json`];
    const p = plan(files, { [files[1]!]: { ok: false, error: 'Unexpected token' } });
    expect(codes(p.issues, 'error')).toEqual(['alt.invalid_json']);
    expect(p.sets).toEqual([]);
  });

  it('alt orphelin : avertissement', () => {
    const files = [`${folder}/01-a.png`, `${folder}/01-a.alt.json`, `${folder}/02-z.alt.json`];
    const p = plan(files, { [files[1]!]: ok(ALT), [files[2]!]: ok(ALT) });
    expect(codes(p.issues)).toEqual(['alt.orphan']);
  });
});

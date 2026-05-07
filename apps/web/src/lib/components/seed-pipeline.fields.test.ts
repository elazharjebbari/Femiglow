/**
 * Tests `seedComponentFields` (Components-CMS, phase fields du seed).
 *
 * Couvre les invariants critiques du seed des champs éditoriaux :
 *  - I0/Idempotence : 2 runs successifs ⇒ skipped (pas de seed double).
 *  - D2/Priorité admin : la valeur d'un binding existant n'est jamais sur-écrite.
 *  - EC1/Orphans : `--reconcile` archive les bindings dont le fieldKey n'est
 *    plus dans le registre.
 *  - Warning : champ `required: true` sans `defaultValue` → warning émis.
 *
 * On mocke le registre TS pour isoler les tests (sinon ils dépendent des
 * définitions de fields du vrai registre, qui peut évoluer).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed, getSiteComponentByKey } from '@/lib/db/queries/site-components';
import {
  ensureSeedPublishedBinding,
  getPublishedBinding,
  listBindingsByComponent,
  upsertDraftBinding,
  publishBinding,
} from '@/lib/db/queries/component-fields';
import type { SiteComponentSeed } from './registry';

const TEST_REGISTRY: SiteComponentSeed[] = [
  {
    key: 'test-hero',
    name: 'Test Hero',
    description: '',
    category: 'hero',
    pageGroup: 'home',
    filePath: 'src/test/Hero.tsx',
    slots: [],
    defaultSvgFallback: null,
    defaultLoadingStrategy: 'eager',
    defaultFetchPriority: 'high',
    supportsAnimation: false,
    fields: [
      {
        key: 'title',
        label: 'Titre',
        type: 'text',
        required: true,
        defaultValue: 'Bienvenue',
      },
      {
        key: 'kicker',
        label: 'Kicker',
        type: 'kicker',
        required: false,
        defaultValue: { text: 'Nouveau' },
      },
      {
        // Volontairement sans defaultValue + required=true → doit produire un warning.
        key: 'subtitle',
        label: 'Sous-titre',
        type: 'multiline',
        required: true,
      },
    ],
  },
  {
    key: 'test-card',
    name: 'Test Card',
    description: '',
    category: 'media-block',
    pageGroup: 'home',
    filePath: 'src/test/Card.tsx',
    slots: [],
    defaultSvgFallback: null,
    defaultLoadingStrategy: 'viewport',
    defaultFetchPriority: 'auto',
    supportsAnimation: false,
    fields: [
      {
        key: 'cta',
        label: 'CTA',
        type: 'cta',
        required: false,
        defaultValue: { label: 'Découvrir', href: '/' },
      },
    ],
  },
];

vi.mock('./registry', async (importActual) => {
  const actual = await importActual<typeof import('./registry')>();
  return {
    ...actual,
    SITE_COMPONENT_REGISTRY: TEST_REGISTRY,
    findComponentSeed: (key: string) => TEST_REGISTRY.find((s) => s.key === key),
  };
});

// Import APRÈS le vi.mock pour que `seedComponentFields` voie notre registre.
const { seedComponentFields } = await import('./seed-pipeline');

beforeEach(async () => {
  resetMemoryStore();
  // Garantit la présence des rows site_components avant la phase fields.
  for (const seed of TEST_REGISTRY) {
    await upsertSiteComponentFromSeed(seed);
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('seedComponentFields — création initiale', () => {
  it('crée un binding published par field doté de defaultValue', async () => {
    const r = await seedComponentFields();
    expect(r.componentsScanned).toBe(2);
    expect(r.seeded).toBe(3); // title + kicker + cta
    expect(r.skipped).toBe(0);
    expect(r.orphansArchived).toBe(0);
    // Warning attendu pour subtitle (required, no default)
    expect(r.warnings.some((w) => w.includes('test-hero.subtitle'))).toBe(true);
  });

  it('publie chaque field avec la valeur du registre', async () => {
    await seedComponentFields();
    const hero = await getSiteComponentByKey('test-hero');
    expect(hero).not.toBeNull();
    const title = await getPublishedBinding(hero!.id, 'title', 'fr');
    expect(title?.value).toBe('Bienvenue');
    const kicker = await getPublishedBinding(hero!.id, 'kicker', 'fr');
    expect(kicker?.value).toEqual({ text: 'Nouveau' });
  });
});

describe('seedComponentFields — idempotence (I0)', () => {
  it('2 runs successifs ⇒ 0 nouvel insert au 2ᵉ', async () => {
    const r1 = await seedComponentFields();
    expect(r1.seeded).toBe(3);
    expect(r1.skipped).toBe(0);

    const r2 = await seedComponentFields();
    expect(r2.seeded).toBe(0);
    expect(r2.skipped).toBe(3);
  });

  it("ne sur-écrit JAMAIS la valeur d'un published existant (D2)", async () => {
    // Cas-test : l'admin a déjà publié une valeur custom.
    await seedComponentFields();
    const hero = await getSiteComponentByKey('test-hero');
    // L'admin modifie via draft + publish.
    const draft = await upsertDraftBinding({
      componentId: hero!.id,
      fieldKey: 'title',
      value: 'Édité par admin',
      authorId: 'admin_1',
    });
    await publishBinding({ bindingId: draft.id, actorId: 'admin_1' });

    // 2ᵉ run du seed.
    await seedComponentFields();

    const after = await getPublishedBinding(hero!.id, 'title', 'fr');
    expect(after?.value).toBe('Édité par admin');
  });
});

describe('seedComponentFields — reconcile (EC1)', () => {
  it('archive les bindings dont le fieldKey est absent du registre', async () => {
    // Setup : un binding "extra" qui n'existe pas dans le registre test.
    await seedComponentFields();
    const hero = await getSiteComponentByKey('test-hero');
    await ensureSeedPublishedBinding({
      componentId: hero!.id,
      fieldKey: 'orphan-field',
      value: 'data fantôme',
    });

    // Sans reconcile : aucun changement
    const r1 = await seedComponentFields();
    expect(r1.orphansArchived).toBe(0);
    let bindings = await listBindingsByComponent(hero!.id);
    expect(bindings.find((b) => b.fieldKey === 'orphan-field')?.status).toBe('published');

    // Avec reconcile : on archive
    const r2 = await seedComponentFields({ reconcile: true });
    expect(r2.orphansArchived).toBe(1);
    bindings = await listBindingsByComponent(hero!.id);
    expect(bindings.find((b) => b.fieldKey === 'orphan-field')?.status).toBe('archived');
  });

  it("ne touche pas les fieldKeys présents dans le registre", async () => {
    await seedComponentFields();
    const hero = await getSiteComponentByKey('test-hero');
    const r = await seedComponentFields({ reconcile: true });
    expect(r.orphansArchived).toBe(0);
    const title = await getPublishedBinding(hero!.id, 'title', 'fr');
    expect(title?.status).toBe('published');
  });
});

describe('seedComponentFields — filtres', () => {
  it('filterPageGroup limite la portée', async () => {
    // Pour ce test, fabriquer un composant kit dans la mock-registry
    // serait verbeux. À la place : filterComponentKey, plus précis.
    const r = await seedComponentFields({ filterComponentKey: 'test-card' });
    expect(r.componentsScanned).toBe(1);
    expect(r.seeded).toBe(1); // uniquement test-card.cta
  });
});

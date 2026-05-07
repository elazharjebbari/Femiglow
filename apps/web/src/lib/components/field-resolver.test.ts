/**
 * Tests unitaires — résolveur Components-CMS (P3).
 *
 * `unstable_cache` est mocké pour garder les tests déterministes (sinon les
 * tags `components` survivraient d'un test à l'autre).
 *
 * Couvre :
 *  - cascade single-field : binding > default > none
 *  - resolveComponentFields batché
 *  - EC1 : bindings archivés / orphelins ignorés
 *  - EC4 : locale non seedée tombe sur le defaultValue
 *  - diagnostic : counts par status corrects
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
  revalidateTag: vi.fn(),
}));

import { resetMemoryStore } from '@/lib/db/client';
import {
  archiveOrphanBindings,
  ensureSeedPublishedBinding,
  upsertDraftBinding,
} from '@/lib/db/queries/component-fields';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import {
  diagnoseComponentFields,
  resolveComponentField,
  resolveComponentFields,
  resolveComponentFieldsDraft,
} from './field-resolver';
import type { SiteComponentSeed } from './registry';

const HERO_SEED: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero Accueil',
  description: 'Hero principal de la home',
  category: 'hero',
  pageGroup: 'home',
  filePath: 'src/components/sections/Hero.tsx',
  slots: [
    {
      key: 'primary',
      label: 'Visuel principal',
      required: true,
      acceptKinds: ['image'],
    },
  ],
  defaultSvgFallback: '/svg/hero.svg',
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: true,
  fields: [
    {
      key: 'title',
      label: 'Titre',
      type: 'text',
      required: true,
      defaultValue: 'Titre par défaut',
    },
    {
      key: 'subtitle',
      label: 'Sous-titre',
      type: 'text',
      required: false,
      defaultValue: 'Sous-titre par défaut',
    },
    {
      key: 'kicker',
      label: 'Kicker',
      type: 'kicker',
      required: false,
      // pas de defaultValue : la cascade tombe sur 'none'
    },
    {
      key: 'badge',
      label: 'Badge',
      type: 'text',
      required: true,
      // required sans default -> 'none' avec warning
    },
  ],
};

beforeEach(() => {
  resetMemoryStore();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

async function setupHero() {
  return upsertSiteComponentFromSeed(HERO_SEED);
}

/* ────────────────────────────────────────────────────────────────────────
 * Single-field cascade
 * ──────────────────────────────────────────────────────────────────────── */

describe('resolveComponentField (cascade)', () => {
  it('binding wins over default (happy path)', async () => {
    const cmp = await setupHero();
    await ensureSeedPublishedBinding({
      componentId: cmp.id,
      fieldKey: 'title',
      value: { v: 'Bonjour FemiGlow' },
    });

    const r = await resolveComponentField('home-hero', 'title');
    expect(r.meta.source).toBe('binding');
    expect(r.value).toBe('Bonjour FemiGlow');
    expect(r.meta.bindingId).toMatch(/^cfb_/);
    expect(r.meta.locale).toBe('fr');
  });

  it('falls back to defaultValue when no binding', async () => {
    await setupHero();
    const r = await resolveComponentField('home-hero', 'subtitle');
    expect(r.meta.source).toBe('default');
    expect(r.value).toBe('Sous-titre par défaut');
  });

  it("returns source='none' when no binding and no default (optional field)", async () => {
    await setupHero();
    const r = await resolveComponentField('home-hero', 'kicker');
    expect(r.meta.source).toBe('none');
    expect(r.value).toBeNull();
  });

  it("returns source='none' with warning when required field has no binding & no default", async () => {
    await setupHero();
    const warnSpy = vi.spyOn(console, 'warn');
    const r = await resolveComponentField('home-hero', 'badge');
    expect(r.meta.source).toBe('none');
    expect(r.value).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * Batched resolver
 * ──────────────────────────────────────────────────────────────────────── */

describe('resolveComponentFields (batched)', () => {
  it('returns all fields in one shape with correct sources', async () => {
    const cmp = await setupHero();
    await ensureSeedPublishedBinding({
      componentId: cmp.id,
      fieldKey: 'title',
      value: { v: 'Hello' },
    });

    const out = await resolveComponentFields('home-hero');
    expect(Object.keys(out).sort()).toEqual(['badge', 'kicker', 'subtitle', 'title']);
    expect(out.title?.meta.source).toBe('binding');
    expect(out.title?.value).toBe('Hello');
    expect(out.subtitle?.meta.source).toBe('default');
    expect(out.subtitle?.value).toBe('Sous-titre par défaut');
    expect(out.kicker?.meta.source).toBe('none');
    expect(out.badge?.meta.source).toBe('none');
  });

  it('returns {} when component is not found', async () => {
    const out = await resolveComponentFields('does-not-exist');
    expect(out).toEqual({});
  });

  it('EC1 — archived/orphan bindings are not surfaced (cascade falls to default)', async () => {
    const cmp = await setupHero();
    // Binding pour un fieldKey qui sera retiré du registre
    await ensureSeedPublishedBinding({
      componentId: cmp.id,
      fieldKey: 'kicker',
      value: { v: 'Old kicker' },
    });
    // Binding sur 'title' qu'on va archiver manuellement (simule legacy)
    const titleBinding = await ensureSeedPublishedBinding({
      componentId: cmp.id,
      fieldKey: 'title',
      value: { v: 'Old title' },
    });
    expect(titleBinding.status).toBe('published');

    // Simule le seed-pipeline qui archive un fieldKey absent du registre.
    // Les fields valides du registre HERO sont title/subtitle/kicker/badge,
    // donc on simule un orphelin sur un fieldKey hors registre.
    await ensureSeedPublishedBinding({
      componentId: cmp.id,
      fieldKey: 'legacyField',
      value: { v: 'orphan' },
    });
    const archived = await archiveOrphanBindings(cmp.id, [
      'title',
      'subtitle',
      'kicker',
      'badge',
    ]);
    expect(archived).toBe(1);

    const out = await resolveComponentFields('home-hero');
    // L'orphelin n'apparaît pas (pas dans le registre)
    expect(out).not.toHaveProperty('legacyField');
    // 'title' reste publié et donc visible
    expect(out.title?.meta.source).toBe('binding');
    expect(out.title?.value).toBe('Old title');
  });

  it("EC4 — locale 'en' (not seeded) falls back to defaultValue", async () => {
    const cmp = await setupHero();
    await ensureSeedPublishedBinding({
      componentId: cmp.id,
      fieldKey: 'title',
      locale: 'fr',
      value: { v: 'Bonjour' },
    });
    const out = await resolveComponentFields('home-hero', 'en');
    expect(out.title?.meta.source).toBe('default');
    expect(out.title?.value).toBe('Titre par défaut');
    expect(out.subtitle?.meta.source).toBe('default');
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * Draft resolver (preview)
 * ──────────────────────────────────────────────────────────────────────── */

describe('resolveComponentFieldsDraft', () => {
  it('reads draft when present, else falls through to published, else default', async () => {
    const cmp = await setupHero();
    // 'title' a un published + un draft (le draft doit gagner)
    await ensureSeedPublishedBinding({
      componentId: cmp.id,
      fieldKey: 'title',
      value: { v: 'Published title' },
    });
    await upsertDraftBinding({
      componentId: cmp.id,
      fieldKey: 'title',
      value: { v: 'Draft title' },
      authorId: 'admin_1',
    });
    // 'subtitle' a uniquement un published -> on le lit
    await ensureSeedPublishedBinding({
      componentId: cmp.id,
      fieldKey: 'subtitle',
      value: { v: 'Published subtitle' },
    });
    // 'kicker' n'a rien -> 'none' (pas de default)
    // 'badge' rien -> 'none'

    const out = await resolveComponentFieldsDraft('home-hero');
    expect(out.title?.value).toBe('Draft title');
    expect(out.subtitle?.value).toBe('Published subtitle');
    expect(out.kicker?.meta.source).toBe('none');
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * Diagnostic
 * ──────────────────────────────────────────────────────────────────────── */

describe('diagnoseComponentFields', () => {
  it('returns the correct status counts and per-field sources', async () => {
    const cmp = await setupHero();
    await ensureSeedPublishedBinding({
      componentId: cmp.id,
      fieldKey: 'title',
      value: { v: 'T' },
    });
    await upsertDraftBinding({
      componentId: cmp.id,
      fieldKey: 'subtitle',
      value: { v: 'S draft' },
      authorId: 'admin_1',
    });

    const diag = await diagnoseComponentFields('home-hero');
    expect(diag.componentKey).toBe('home-hero');
    expect(diag.locale).toBe('fr');
    expect(diag.bindingsCount.published).toBe(1);
    expect(diag.bindingsCount.draft).toBe(1);
    expect(diag.bindingsCount.scheduled).toBe(0);
    expect(diag.bindingsCount.archived).toBe(0);

    const byKey = Object.fromEntries(diag.fields.map((f) => [f.key, f]));
    expect(byKey.title?.source).toBe('binding');
    expect(byKey.title?.bindingId).toMatch(/^cfb_/);
    expect(byKey.subtitle?.source).toBe('default'); // draft pas surfacé en cascade publique
    expect(byKey.kicker?.source).toBe('none');
    expect(byKey.badge?.source).toBe('none');
  });

  it('returns empty diagnostic when component is missing', async () => {
    const diag = await diagnoseComponentFields('does-not-exist');
    expect(diag.fields).toEqual([]);
    expect(diag.bindingsCount).toEqual({
      published: 0,
      draft: 0,
      scheduled: 0,
      archived: 0,
    });
  });
});

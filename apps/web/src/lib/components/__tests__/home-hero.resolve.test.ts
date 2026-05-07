/**
 * P12 — pilote `home-hero` : tests de résolution des champs éditoriaux
 * via le registre RÉEL (pas de SEED de fixture). Garantit que la cascade
 * `default` renvoie bien les littéraux du `mockHomepage.hero` documentés
 * dans `catalog/home-hero.md`.
 *
 * Cf. docs/components-cms/catalog/home-hero.md §2.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
  revalidateTag: vi.fn(),
}));

import { resetMemoryStore } from '@/lib/db/client';
import { syncComponentRegistry, seedComponentFields } from '@/lib/components/seed-pipeline';
import { ensureSeedPublishedBinding } from '@/lib/db/queries/component-fields';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { resolveComponentFields } from '@/lib/components/field-resolver';

beforeEach(async () => {
  resetMemoryStore();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  await syncComponentRegistry();
  await seedComponentFields();
});

describe('home-hero — cascade default ▸ binding (P12)', () => {
  it('rend les defaultValues du registre quand aucun binding manuel', async () => {
    // Le seed crée des bindings 'published' depuis le registre. La cascade
    // doit renvoyer source='binding' avec la valeur seedée.
    const out = await resolveComponentFields('home-hero');
    expect(out.title?.value).toBe('Le rituel ongles, en cinq minutes.');
    expect(out.kicker?.value).toBe('Maison de Casablanca');
    expect(out.subtitle?.value).toBe(
      'Trois gestes, une saison. Une beauté lente, ancrée au Maroc.',
    );
    expect(out.cta?.value).toEqual({
      label: 'Découvrir le rituel',
      href: '/rituel',
      variant: 'primary',
    });
    expect(out.ctaSecondary?.value).toEqual({
      label: 'Voir le kit',
      href: '/kit',
      variant: 'link',
    });
  });

  it('un binding manuel publié sur title prime sur la valeur seedée', async () => {
    const cmp = await getSiteComponentByKey('home-hero');
    expect(cmp).toBeTruthy();
    const { upsertDraftBinding, publishBinding } = await import(
      '@/lib/db/queries/component-fields'
    );
    const draft = await upsertDraftBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: { v: 'Édition spéciale printemps.' },
      authorId: 'adm_test',
    });
    await publishBinding({
      bindingId: draft.id,
      expectedUpdatedAt: draft.updatedAt,
      actorId: 'adm_test',
    });

    const out = await resolveComponentFields('home-hero');
    expect(out.title?.value).toBe('Édition spéciale printemps.');
    expect(out.title?.meta.source).toBe('binding');
  });

  it('cas cta manquant : retombe sur le defaultValue du registre', async () => {
    // On simule un retrait du field 'cta' du registre via archiveOrphanBindings
    // (qui archive tout binding hors liste). La cascade doit alors tomber sur
    // defaultValue (et non 'none' car cta a un default).
    const cmp = await getSiteComponentByKey('home-hero');
    expect(cmp).toBeTruthy();
    const { archiveOrphanBindings } = await import(
      '@/lib/db/queries/component-fields'
    );
    const archived = await archiveOrphanBindings(cmp!.id, [
      'kicker',
      'title',
      'subtitle',
      'ctaSecondary',
    ]);
    expect(archived).toBeGreaterThanOrEqual(1);

    const out = await resolveComponentFields('home-hero');
    expect(out.cta?.meta.source).toBe('default');
    expect(out.cta?.value).toEqual({
      label: 'Découvrir le rituel',
      href: '/rituel',
      variant: 'primary',
    });
  });

  it('un binding seedé est observable sur tous les champs déclarés', async () => {
    const out = await resolveComponentFields('home-hero');
    expect(Object.keys(out).sort()).toEqual(
      ['cta', 'ctaSecondary', 'kicker', 'subtitle', 'title'].sort(),
    );
    for (const key of Object.keys(out)) {
      expect(out[key]?.meta.source).toBe('binding');
    }
  });

  // EC4 — locale 'en' (non seedée) doit retomber sur le defaultValue
  it("locale 'en' (non seedée) tombe sur le defaultValue du registre", async () => {
    const out = await resolveComponentFields('home-hero', 'en');
    expect(out.title?.meta.source).toBe('default');
    expect(out.title?.value).toBe('Le rituel ongles, en cinq minutes.');
    expect(out.cta?.meta.source).toBe('default');
    expect(out.cta?.value).toEqual({
      label: 'Découvrir le rituel',
      href: '/rituel',
      variant: 'primary',
    });
  });
});

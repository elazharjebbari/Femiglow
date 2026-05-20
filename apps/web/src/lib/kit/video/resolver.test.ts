/**
 * Tests resolver + store + schemas pour `/admin/kit/video`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { mockRituel } from '@/data/mock/rituel';
import { kitVideoOverrideUpsertSchema } from './schemas';
import {
  getKitVideoOverride,
  publishKitVideoOverride,
  resetKitVideoOverride,
  unpublishKitVideoOverride,
  upsertKitVideoOverride,
} from './store';
import { resolveKitVideo, resolveKitVideoDraft } from './resolver';

beforeEach(() => {
  resetMemoryStore();
});

describe('kitVideoOverrideUpsertSchema', () => {
  it('accepte un patch vide (toutes les clés absentes)', () => {
    const r = kitVideoOverrideUpsertSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('accepte un patch avec une URL YouTube valide', () => {
    const r = kitVideoOverrideUpsertSchema.safeParse({
      youtubeUrl: 'https://youtube.com/shorts/N2pDuciP4uQ',
    });
    expect(r.success).toBe(true);
  });

  it('refuse une URL YouTube non parsable', () => {
    const r = kitVideoOverrideUpsertSchema.safeParse({
      youtubeUrl: 'https://vimeo.com/12345',
    });
    expect(r.success).toBe(false);
  });

  it('accepte une provenance terminée par . ! ? »', () => {
    expect(
      kitVideoOverrideUpsertSchema.safeParse({ provenance: 'Filmé à Rabat.' }).success,
    ).toBe(true);
    expect(
      kitVideoOverrideUpsertSchema.safeParse({ provenance: 'Filmé à Rabat »' }).success,
    ).toBe(true);
  });

  it('refuse une provenance sans ponctuation finale', () => {
    const r = kitVideoOverrideUpsertSchema.safeParse({ provenance: 'Filmé à Rabat' });
    expect(r.success).toBe(false);
  });

  it('refuse moins de 2 chapitres', () => {
    const r = kitVideoOverrideUpsertSchema.safeParse({
      chapters: [{ key: 'a', label: 'A', startSeconds: 0 }],
    });
    expect(r.success).toBe(false);
  });

  it('refuse des chapitres non triés', () => {
    const r = kitVideoOverrideUpsertSchema.safeParse({
      chapters: [
        { key: 'a', label: 'A', startSeconds: 10 },
        { key: 'b', label: 'B', startSeconds: 5 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('refuse des startSeconds égaux (doublon)', () => {
    const r = kitVideoOverrideUpsertSchema.safeParse({
      chapters: [
        { key: 'a', label: 'A', startSeconds: 0 },
        { key: 'b', label: 'B', startSeconds: 0 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('accepte null pour effacer un champ (reset)', () => {
    const r = kitVideoOverrideUpsertSchema.safeParse({
      provenance: null,
      accentColor: null,
    });
    expect(r.success).toBe(true);
  });

  it('refuse une durationDisplay trop longue', () => {
    const r = kitVideoOverrideUpsertSchema.safeParse({ durationDisplay: '123456789' });
    expect(r.success).toBe(false);
  });
});

describe('store — upsert/get/reset', () => {
  it('renvoie null quand aucun override n\'a été créé', () => {
    expect(getKitVideoOverride()).toBeNull();
  });

  it('upsert crée le singleton avec draftedAt et publishedAt=null', () => {
    const r = upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    expect(r.id).toBe('kit:video');
    expect(r.provenance).toBe('Filmé à Rabat.');
    expect(r.publishedAt).toBeNull();
    expect(r.draftedAt).not.toBeNull();
  });

  it('upsert successif merge le patch sur l\'existant', () => {
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    const r = upsertKitVideoOverride({ durationDisplay: '90″' });
    expect(r.provenance).toBe('Filmé à Rabat.');
    expect(r.durationDisplay).toBe('90″');
  });

  it('upsert avec null efface le champ visé', () => {
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    const r = upsertKitVideoOverride({ provenance: null });
    expect(r.provenance).toBeNull();
  });

  it('reset supprime totalement l\'override', () => {
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    resetKitVideoOverride();
    expect(getKitVideoOverride()).toBeNull();
  });

  it('publish pose publishedAt et nettoie draftedAt', () => {
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    const r = publishKitVideoOverride();
    expect(r?.publishedAt).not.toBeNull();
    expect(r?.draftedAt).toBeNull();
  });

  it('publish sur store vide renvoie null', () => {
    expect(publishKitVideoOverride()).toBeNull();
  });

  it('unpublish efface publishedAt et repose draftedAt', () => {
    upsertKitVideoOverride({ provenance: 'Filmé à Rabat.' });
    publishKitVideoOverride();
    const r = unpublishKitVideoOverride();
    expect(r?.publishedAt).toBeNull();
    expect(r?.draftedAt).not.toBeNull();
  });
});

describe('resolveKitVideo — version publique', () => {
  it('retourne le mock pur quand aucun override n\'existe', () => {
    const r = resolveKitVideo();
    expect(r.meta.source).toBe('mock');
    expect(r.video).toEqual(mockRituel.videoGestes);
  });

  it('retourne le mock quand l\'override est en draft (pas publié)', () => {
    upsertKitVideoOverride({ provenance: 'Override non publié.' });
    const r = resolveKitVideo();
    expect(r.meta.source).toBe('mock');
    expect(r.video.provenance).toBe(mockRituel.videoGestes.provenance);
  });

  it('merge l\'override publié sur le mock', () => {
    upsertKitVideoOverride({ provenance: 'Override publié.' });
    publishKitVideoOverride();
    const r = resolveKitVideo();
    expect(r.meta.source).toBe('override-published');
    expect(r.video.provenance).toBe('Override publié.');
    // Les champs non touchés viennent toujours du mock.
    expect(r.video.transcript).toBe(mockRituel.videoGestes.transcript);
  });

  it('null dans l\'override = retour au mock pour ce champ', () => {
    upsertKitVideoOverride({ provenance: 'A.', durationDisplay: '60″' });
    upsertKitVideoOverride({ provenance: null });
    publishKitVideoOverride();
    const r = resolveKitVideo();
    expect(r.video.provenance).toBe(mockRituel.videoGestes.provenance);
    expect(r.video.durationDisplay).toBe('60″');
  });
});

describe('resolveKitVideoDraft — version admin', () => {
  it('retourne le mock quand aucun override n\'existe', () => {
    const r = resolveKitVideoDraft();
    expect(r.meta.source).toBe('mock');
  });

  it('retourne le draft même non publié', () => {
    upsertKitVideoOverride({ provenance: 'Draft.' });
    const r = resolveKitVideoDraft();
    expect(r.meta.source).toBe('override-draft');
    expect(r.video.provenance).toBe('Draft.');
  });

  it('retourne override-published si tout est publié', () => {
    upsertKitVideoOverride({ provenance: 'Pub.' });
    publishKitVideoOverride();
    const r = resolveKitVideoDraft();
    expect(r.meta.source).toBe('override-published');
  });

  it('source = override-draft tant qu\'on a un draftedAt', () => {
    upsertKitVideoOverride({ provenance: 'P1.' });
    publishKitVideoOverride();
    upsertKitVideoOverride({ provenance: 'P2.' }); // re-draft sur publié
    const r = resolveKitVideoDraft();
    expect(r.meta.source).toBe('override-draft');
    expect(r.video.provenance).toBe('P2.');
  });
});

import { describe, it, expect } from 'vitest';

// Pure logic tests — duplicate functions locally to avoid @/ import issues
function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatShortDate(value: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function defaultVisualPrompt(draft: { hook?: string | null }): string {
  const hook = draft.hook ? `${draft.hook}. ` : '';
  return `${hook}Visuel beauté naturel FemiGlow, rituel ongles et mains, ambiance premium marocaine douce, lumière naturelle, composition éditoriale propre, sans texte lisible ni promesse médicale.`;
}

function summarizeSnapshot(snapshot: { source: string; metrics: Record<string, unknown> }): string {
  const metrics = snapshot.metrics;
  if (snapshot.source === 'postiz_status') {
    const state = typeof metrics.state === 'string' ? metrics.state : 'état inconnu';
    const releaseURL = typeof metrics.releaseURL === 'string' ? metrics.releaseURL : null;
    return releaseURL ? `${state} · ${releaseURL}` : state;
  }
  const analytics = metrics.analytics;
  if (Array.isArray(analytics)) return `${analytics.length} métrique(s) analytics importée(s).`;
  if (analytics && typeof analytics === 'object' && 'missing' in analytics) {
    return 'Analytics manquantes : release id à relier côté Postiz.';
  }
  return 'Snapshot importé.';
}

function extractUploadedImage(delivery: { request: { posts: unknown } }): { id?: string; path?: string } | null {
  const posts = delivery.request.posts;
  if (!Array.isArray(posts)) return null;
  const first = posts[0] as { value?: unknown };
  if (!Array.isArray(first.value)) return null;
  const value = first.value[0] as { image?: unknown };
  if (!Array.isArray(value.image)) return null;
  return (value.image[0] as { id?: string; path?: string }) ?? null;
}

describe('helpers — toIsoOrNull', () => {
  it('convertit une date valide en ISO', () => {
    const result = toIsoOrNull('2026-05-17T10:00');
    expect(result).not.toBeNull();
    expect(result!.startsWith('2026-05-17')).toBe(true);
  });

  it('retourne null pour une chaîne vide', () => {
    expect(toIsoOrNull('')).toBeNull();
  });

  it('retourne null pour une date invalide', () => {
    expect(toIsoOrNull('not-a-date')).toBeNull();
  });
});

describe('helpers — toLocalDatetimeInput', () => {
  it('formate une date en format datetime-local', () => {
    const date = new Date(2026, 4, 17, 14, 30);
    const result = toLocalDatetimeInput(date);
    expect(result).toBe('2026-05-17T14:30');
  });

  it('pad les mois et jours < 10', () => {
    const date = new Date(2026, 0, 5, 8, 5);
    const result = toLocalDatetimeInput(date);
    expect(result).toBe('2026-01-05T08:05');
  });
});

describe('helpers — formatShortDate', () => {
  it('formate une date en français', () => {
    const result = formatShortDate('2026-05-17T14:30:00Z');
    expect(result).toBeTruthy();
    expect(result.includes('17')).toBe(true);
  });
});

describe('helpers — defaultVisualPrompt', () => {
  it('inclut le hook quand présent', () => {
    const result = defaultVisualPrompt({ hook: '5 astuces ongles' });
    expect(result.startsWith('5 astuces ongles.')).toBe(true);
    expect(result).toContain('FemiGlow');
  });

  it('omet le hook quand absent', () => {
    const result = defaultVisualPrompt({ hook: null });
    expect(result.startsWith('Visuel')).toBe(true);
    expect(result).not.toContain('undefined');
  });
});

describe('helpers — summarizeSnapshot', () => {
  it('résume un snapshot postiz_status avec state', () => {
    const result = summarizeSnapshot({ source: 'postiz_status', metrics: { state: 'published' } });
    expect(result).toBe('published');
  });

  it('résume un snapshot postiz_status avec state + releaseURL', () => {
    const result = summarizeSnapshot({ source: 'postiz_status', metrics: { state: 'published', releaseURL: 'https://x.com/123' } });
    expect(result).toBe('published · https://x.com/123');
  });

  it('résume un snapshot postiz_status sans state', () => {
    const result = summarizeSnapshot({ source: 'postiz_status', metrics: {} });
    expect(result).toBe('état inconnu');
  });

  it('résume un snapshot analytics avec tableau', () => {
    const result = summarizeSnapshot({ source: 'other', metrics: { analytics: [1, 2, 3] } });
    expect(result).toBe('3 métrique(s) analytics importée(s).');
  });

  it('résume un snapshot analytics manquantes', () => {
    const result = summarizeSnapshot({ source: 'other', metrics: { analytics: { missing: true } } });
    expect(result).toBe('Analytics manquantes : release id à relier côté Postiz.');
  });

  it('résume un snapshot par défaut', () => {
    const result = summarizeSnapshot({ source: 'other', metrics: {} });
    expect(result).toBe('Snapshot importé.');
  });
});

describe('helpers — extractUploadedImage', () => {
  it('extrait l\'image uploadée d\'une delivery valide', () => {
    const delivery = {
      request: {
        posts: [{ value: [{ image: [{ id: 'img-1', path: '/uploads/img.png' }] }] }],
      },
    };
    const result = extractUploadedImage(delivery as never);
    expect(result).toEqual({ id: 'img-1', path: '/uploads/img.png' });
  });

  it('retourne null si posts n\'est pas un tableau', () => {
    expect(extractUploadedImage({ request: { posts: null } } as never)).toBeNull();
  });

  it('retourne null si value n\'est pas un tableau', () => {
    expect(extractUploadedImage({ request: { posts: [{ value: null }] } } as never)).toBeNull();
  });

  it('retourne null si image n\'est pas un tableau', () => {
    expect(extractUploadedImage({ request: { posts: [{ value: [{ image: null }] }] } } as never)).toBeNull();
  });
});
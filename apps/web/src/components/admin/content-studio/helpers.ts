import type { ContentDraft, ContentPostizDelivery, ContentPerformanceSnapshot } from '@/lib/content-studio/types';

function extractUploadedImage(delivery: ContentPostizDelivery): { id?: string; path?: string } | null {
  const posts = delivery.request.posts;
  if (!Array.isArray(posts)) return null;
  const first = posts[0] as { value?: unknown };
  if (!Array.isArray(first.value)) return null;
  const value = first.value[0] as { image?: unknown };
  if (!Array.isArray(value.image)) return null;
  return (value.image[0] as { id?: string; path?: string }) ?? null;
}

function summarizeSnapshot(snapshot: ContentPerformanceSnapshot): string {
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

function defaultScheduleValue(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return toLocalDatetimeInput(date);
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toLocalDatetimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
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

function defaultVisualPrompt(draft: ContentDraft): string {
  const hook = draft.hook ? `${draft.hook}. ` : '';
  return `${hook}Visuel beauté naturel FemiGlow, rituel ongles et mains, ambiance premium marocaine douce, lumière naturelle, composition éditoriale propre, sans texte lisible ni promesse médicale.`;
}

export {
  extractUploadedImage,
  summarizeSnapshot,
  defaultScheduleValue,
  toIsoOrNull,
  toLocalDatetimeInput,
  formatShortDate,
  defaultVisualPrompt,
};
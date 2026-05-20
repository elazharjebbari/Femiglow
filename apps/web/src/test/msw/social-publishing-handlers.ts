import { http, HttpResponse } from 'msw';

export type SocialPublishingMockKind = 'meta_container' | 'meta_publish' | 'postiz_posts' | 'postiz_media';

export interface SocialPublishingRecordedCall {
  kind: SocialPublishingMockKind;
  url: string;
  body: unknown;
  receivedAt: number;
}

const statusByKind: Record<SocialPublishingMockKind, number> = {
  meta_container: 200,
  meta_publish: 200,
  postiz_posts: 200,
  postiz_media: 200,
};

let recordedCalls: SocialPublishingRecordedCall[] = [];
let failQueue: Partial<Record<SocialPublishingMockKind, number>> = {};

export function resetSocialPublishingMocks(): void {
  recordedCalls = [];
  failQueue = {};
  for (const key of Object.keys(statusByKind) as SocialPublishingMockKind[]) statusByKind[key] = 200;
}

export function getSocialPublishingRecordedCalls(kind?: SocialPublishingMockKind): SocialPublishingRecordedCall[] {
  return kind ? recordedCalls.filter((call) => call.kind === kind) : recordedCalls.slice();
}

export function failNextSocialPublishingCall(kind: SocialPublishingMockKind, times = 1): void {
  failQueue[kind] = (failQueue[kind] ?? 0) + times;
}

export function setSocialPublishingStatus(kind: SocialPublishingMockKind, status: number): void {
  statusByKind[kind] = status;
}

function consumeFail(kind: SocialPublishingMockKind): boolean {
  const left = failQueue[kind];
  if (!left) return false;
  failQueue[kind] = left - 1;
  return true;
}

async function record(kind: SocialPublishingMockKind, request: Request): Promise<void> {
  let body: unknown = null;
  try {
    body = await request.clone().json();
  } catch {
    try {
      body = await request.clone().text();
    } catch {
      body = null;
    }
  }
  recordedCalls.push({ kind, url: request.url, body, receivedAt: Date.now() });
}

function metaError(status: number) {
  if (status === 401) return { error: { code: 190, message: 'Mocked expired token' } };
  if (status === 403) return { error: { code: 200, message: 'Mocked permission denied' } };
  if (status === 429) return { error: { code: 4, message: 'Mocked rate limit' } };
  return { error: { code: status, message: 'Mocked Meta error' } };
}

export const socialPublishingHandlers = [
  http.post('https://graph.facebook.com/*/:igUserId/media', async ({ request }) => {
    await record('meta_container', request);
    const status = consumeFail('meta_container') ? statusByKind.meta_container : 200;
    if (status >= 400) return HttpResponse.json(metaError(status), { status });
    return HttpResponse.json({ id: 'mock_meta_container_id' });
  }),

  http.post('https://graph.facebook.com/*/:igUserId/media_publish', async ({ request }) => {
    await record('meta_publish', request);
    const status = consumeFail('meta_publish') ? statusByKind.meta_publish : 200;
    if (status >= 400) return HttpResponse.json(metaError(status), { status });
    return HttpResponse.json({ id: 'mock_meta_publication_id' });
  }),

  http.post('https://postiz.test/api/upload', async ({ request }) => {
    await record('postiz_media', request);
    const status = consumeFail('postiz_media') ? statusByKind.postiz_media : 200;
    if (status >= 400) return HttpResponse.json({ message: 'Mocked Postiz media error' }, { status });
    return HttpResponse.json({ id: 'mock_postiz_media_id', path: 'https://postiz.test/media/mock.png' });
  }),

  http.post('https://postiz.test/api/posts', async ({ request }) => {
    await record('postiz_posts', request);
    const status = consumeFail('postiz_posts') ? statusByKind.postiz_posts : 200;
    if (status >= 400) return HttpResponse.json({ message: 'Mocked Postiz post error' }, { status });
    return HttpResponse.json({ id: 'mock_postiz_post_id', status: 'published' });
  }),
];

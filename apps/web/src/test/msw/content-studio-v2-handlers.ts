/**
 * MSW handlers for Content Studio v2 specific routes.
 *
 * Covers:
 * - POST /api/admin/content-studio/drafts/:id/generate-visual
 * - POST /api/admin/content-studio-v2/media/upload-and-crop
 * - POST /api/admin/content-studio-v2/media/upload-and-trim
 */
import { http, HttpResponse } from 'msw';
import { buildStudioMediaItem } from '../factories/content-studio';

export function contentStudioV2Handlers() {
  let callCount = { generateVisual: 0, uploadCrop: 0, uploadTrim: 0 };

  const handlers = [
    // POST /api/admin/content-studio/drafts/:id/generate-visual
    http.post(
      'http://localhost/api/admin/content-studio/drafts/:id/generate-visual',
      async () => {
        callCount.generateVisual++;
        const media = buildStudioMediaItem({ id: `media_gen_${callCount.generateVisual}` });
        return HttpResponse.json({ media }, { status: 200 });
      },
    ),

    // POST /api/admin/content-studio-v2/media/upload-and-crop
    http.post(
      'http://localhost/api/admin/content-studio-v2/media/upload-and-crop',
      async ({ request }) => {
        callCount.uploadCrop++;
        const contentType = request.headers.get('content-type') ?? '';
        if (!contentType.includes('multipart/form-data')) {
          return HttpResponse.json(
            { error: { code: 'invalid_request', message: 'Expected multipart/form-data' } },
            { status: 400 },
          );
        }
        const media = buildStudioMediaItem({
          id: `media_crop_${callCount.uploadCrop}`,
          kind: 'image',
        });
        return HttpResponse.json({ media }, { status: 200 });
      },
    ),

    // POST /api/admin/content-studio-v2/media/upload-and-trim
    http.post(
      'http://localhost/api/admin/content-studio-v2/media/upload-and-trim',
      async ({ request }) => {
        callCount.uploadTrim++;
        const contentType = request.headers.get('content-type') ?? '';
        if (!contentType.includes('multipart/form-data')) {
          return HttpResponse.json(
            { error: { code: 'invalid_request', message: 'Expected multipart/form-data' } },
            { status: 400 },
          );
        }
        const media = buildStudioMediaItem({
          id: `media_trim_${callCount.uploadTrim}`,
          kind: 'video',
          previewUrl: '/media-files/test/poster.webp',
        });
        return HttpResponse.json({ media }, { status: 200 });
      },
    ),
  ];

  return { handlers, callCount };
}

// Error variant handlers for server.use() overrides

export const generateVisualBudgetExceededHandler = http.post(
  'http://localhost/api/admin/content-studio/drafts/:id/generate-visual',
  () =>
    HttpResponse.json(
      { error: { code: 'budget_exceeded', message: 'Budget IA quotidien épuisé.' } },
      { status: 429 },
    ),
);

export const generateVisualProviderErrorHandler = http.post(
  'http://localhost/api/admin/content-studio/drafts/:id/generate-visual',
  () =>
    HttpResponse.json(
      { error: { code: 'upstream_failed', message: 'Image provider failed.' } },
      { status: 502 },
    ),
);

export const uploadCropTooLargeHandler = http.post(
  'http://localhost/api/admin/content-studio-v2/media/upload-and-crop',
  () =>
    HttpResponse.json(
      { error: { code: 'payload_too_large', message: 'File exceeds 25 MB limit.' } },
      { status: 413 },
    ),
);

export const uploadTrimTooLargeHandler = http.post(
  'http://localhost/api/admin/content-studio-v2/media/upload-and-trim',
  () =>
    HttpResponse.json(
      { error: { code: 'payload_too_large', message: 'File exceeds 200 MB limit.' } },
      { status: 413 },
    ),
);

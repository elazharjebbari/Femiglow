# 04 — Plan d'action backend

Découpage des phases backend en tâches atomiques, avec checklist, fichiers à créer/modifier, contrats à respecter, commandes de validation et critères de fini.

## 1. Inventaire des livrables backend

| # | Domaine | Livrable | Localisation |
| --- | --- | --- | --- |
| B1 | BDD | Migration `0016_ritual_testimonials.sql` | `apps/web/drizzle/migrations/` |
| B2 | BDD | Migration `0017_insights_rituals_daily.sql` | idem |
| B3 | BDD | Schéma Drizzle TS | `apps/web/src/lib/db/schema.ts` (append) |
| B4 | Schemas | Zod schemas | `apps/web/src/lib/schemas/rituals.ts` |
| B5 | Queries | Queries Drizzle | `apps/web/src/lib/db/queries/rituals.ts` |
| B6 | Services | Sanitization + auto-flags | `apps/web/src/lib/rituals/sanitize-body.ts`, `auto-flags.ts` |
| B7 | Services | Customer hash + email tokens | `apps/web/src/lib/rituals/customer-hash.ts`, `email-tokens.ts` |
| B8 | Services | Vision ML faces | `apps/web/src/lib/rituals/vision-ml-faces.ts` |
| B9 | Services | Pipeline photos (Sharp + storage) | `apps/web/src/lib/rituals/photo-pipeline.ts` |
| B10 | Services | Modération orchestrator | `apps/web/src/lib/rituals/moderation.ts` |
| B11 | Services | Aggregator (refresh MV) | `apps/web/src/lib/rituals/aggregator.ts` |
| B12 | API publique | GET `/api/rituals/summary` | `apps/web/src/app/api/rituals/summary/route.ts` |
| B13 | API publique | GET `/api/rituals/list` | `.../list/route.ts` |
| B14 | API publique | GET `/api/rituals/policy` | `.../policy/route.ts` |
| B15 | API publique | POST `/api/rituals/submit` | `.../submit/route.ts` |
| B16 | API publique | POST `/api/rituals/upload-photo` | `.../upload-photo/route.ts` |
| B17 | API publique | POST `/api/rituals/decode-email-token` | `.../decode-email-token/route.ts` |
| B18 | API admin | GET `/api/admin/rituals/queue` | `apps/web/src/app/api/admin/rituals/queue/route.ts` |
| B19 | API admin | GET, PATCH `/api/admin/rituals/[id]` | `.../[id]/route.ts` |
| B20 | API admin | POST `/api/admin/rituals/[id]/photos/[photoId]/recheck` | `.../[id]/photos/[photoId]/recheck/route.ts` |
| B21 | API admin | GET, PATCH `/api/admin/rituals/policy` | `.../policy/route.ts` |
| B22 | API admin | GET `/api/admin/rituals/insights` | `.../insights/route.ts` |
| B23 | CRON | `/api/cron/rituals-refresh-aggregate` | `apps/web/src/app/api/cron/rituals-refresh-aggregate/route.ts` |
| B24 | CRON | `/api/cron/rituals-email-j45` | idem |
| B25 | CRON | `/api/cron/rituals-faces-recheck-stale` | idem |
| B26 | E-mails | Templates Markdown | `apps/web/content/email-templates/rituals/*.md` |
| B27 | Config Vercel | CRON schedules | `apps/web/vercel.json` |
| B28 | Seed | Script seed initial | `apps/web/scripts/seed-rituals.ts` |

## 2. Phase B1 — Migration BDD principale

### 2.1 Checklist

- [ ] Créer `apps/web/drizzle/migrations/0016_ritual_testimonials.sql`.
- [ ] Inclure tous les ENUMS (`ritual_signal`, `ritual_status`, `ritual_source`, `ritual_language`, `photo_faces_status`).
- [ ] Créer les 3 tables (`ritual_testimonials`, `ritual_testimonial_photos`, `ritual_audit_log`).
- [ ] Créer indexes y compris partiels.
- [ ] Créer matérialized view `ritual_aggregate` + index unique.
- [ ] Tester la migration en local (`pnpm db:migrate`).

### 2.2 Référence

- `↗ 08-architecture-data.md § 2, 3, 4, 5`.

### 2.3 Test

```bash
pnpm --filter @femiglow/web db:migrate
psql $DATABASE_URL -c "\d ritual_testimonials"
psql $DATABASE_URL -c "\d ritual_testimonial_photos"
psql $DATABASE_URL -c "\d+ ritual_aggregate"
```

### 2.4 DoD

- ✓ Toutes les tables présentes.
- ✓ Tous les ENUMS définis.
- ✓ Indexes partiels créés (vérifiable via `\di+`).

## 3. Phase B3-B4 — Schéma Drizzle TS + Zod

### 3.1 Checklist Drizzle

Ajouter à la fin de `apps/web/src/lib/db/schema.ts` :

- [ ] `pgEnum('ritual_signal', [...])`.
- [ ] `pgEnum('ritual_status', [...])`.
- [ ] `pgEnum('ritual_source', [...])`.
- [ ] `pgEnum('ritual_language', [...])`.
- [ ] `pgEnum('photo_faces_status', [...])`.
- [ ] `ritualTestimonials` table.
- [ ] `ritualTestimonialPhotos` table.
- [ ] `ritualAuditLog` table.
- [ ] Relations Drizzle (`relations(...)`).
- [ ] Types exportés `InferSelectModel`, `InferInsertModel`.

### 3.2 Checklist Zod

Créer `apps/web/src/lib/schemas/rituals.ts` :

- [ ] `RitualSignalSchema` enum.
- [ ] `RitualTagSchema` enum (9 tags).
- [ ] `RitualCitySchema` enum (villes Maroc).
- [ ] `RitualTestimonialPhotoPublic` object.
- [ ] `RitualTestimonialPublic` object.
- [ ] `RitualTestimonialSubmit` object.
- [ ] `RitualSummary` object.
- [ ] `RitualModerationAction` enum + payload.

### 3.3 Tests à écrire

`apps/web/src/lib/schemas/__tests__/rituals.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { RitualTestimonialSubmit, RitualSignalSchema } from '../rituals';

describe('RitualTestimonialSubmit', () => {
  it('accepte un payload minimal valide', () => {
    const input = {
      productKey: 'pack-femiglow',
      body: 'Trois mois et l\'ongle a retrouvé sa nervure. J\'ai cessé de le forcer. Je remarque que les cuticules ont apaisé.',
      wouldRecommend: 'oui',
    };
    expect(() => RitualTestimonialSubmit.parse(input)).not.toThrow();
  });

  it('rejette un body trop court', () => {
    const input = { productKey: 'pack-femiglow', body: 'top court', wouldRecommend: 'oui' };
    expect(() => RitualTestimonialSubmit.parse(input)).toThrow();
  });

  it('rejette un wouldRecommend invalide', () => {
    expect(() => RitualSignalSchema.parse('maybe')).toThrow();
  });

  it('accepte un tableau de tags max 3', () => {
    const input = {
      productKey: 'pack-femiglow',
      body: 'a'.repeat(50),
      wouldRecommend: 'oui',
      ritualTags: ['ongles-plus-lisses', 'plaque-souple', 'cuticules-apaisees'],
    };
    expect(() => RitualTestimonialSubmit.parse(input)).not.toThrow();
  });

  it('rejette 4 tags', () => {
    const input = {
      productKey: 'pack-femiglow',
      body: 'a'.repeat(50),
      wouldRecommend: 'oui',
      ritualTags: ['ongles-plus-lisses', 'plaque-souple', 'cuticules-apaisees', 'plus-de-casse'],
    };
    expect(() => RitualTestimonialSubmit.parse(input)).toThrow();
  });
});
```

### 3.4 DoD

- ✓ Types Drizzle exportés.
- ✓ Types Zod exportés.
- ✓ Tests Vitest verts.

## 4. Phase B5 — Queries Drizzle

### 4.1 Liste des queries

| Fonction | Signature |
| --- | --- |
| `getRitualSummary(productKey: string)` | `Promise<RitualSummary>` |
| `listRituals(opts)` | `Promise<{ items: RitualPublic[]; nextCursor: string \| null; hasMore: boolean }>` |
| `getRitualByPublicSlug(slug: string)` | `Promise<RitualPublic \| null>` |
| `getRitualById(id: string)` | `Promise<RitualFull>` (admin) |
| `insertRitual(data)` | `Promise<{ id, publicSlug, status }>` |
| `updateRitualStatus(id, action, actorId)` | `Promise<RitualFull>` |
| `toggleFeatured(id, value)` | `Promise<void>` |
| `correctBody(id, newBody, actorId, note)` | `Promise<void>` |
| `insertPhoto(testimonialId, data)` | `Promise<{ photoId, url, thumbUrl }>` |
| `updatePhotoFacesStatus(photoId, status, count, override?)` | `Promise<void>` |
| `insertAuditEvent(testimonialId, actorId, action, note, payload)` | `Promise<void>` |
| `listAuditEvents(testimonialId)` | `Promise<AuditEvent[]>` |
| `refreshRitualAggregate()` | `Promise<void>` |
| `findByCustomerHash(customerHash)` | `Promise<{ count, lastCreatedAt }>` |

### 4.2 Pattern (extrait)

```ts
// apps/web/src/lib/db/queries/rituals.ts
import { db } from '@/lib/db/client';
import { ritualTestimonials, ritualTestimonialPhotos } from '@/lib/db/schema';
import { and, desc, eq, lt, sql } from 'drizzle-orm';

export async function listRituals(opts: {
  productKey: string;
  withPhotos?: boolean;
  tags?: string[];
  signal?: 'oui' | 'hesite' | 'non';
  sort?: 'recommended' | 'recent' | 'helpful';
  cursor?: { publishedAt: Date; id: string } | null;
  limit?: number;
}) {
  const limit = Math.min(opts.limit ?? 12, 24);
  const conditions = [
    eq(ritualTestimonials.productKey, opts.productKey),
    eq(ritualTestimonials.status, 'APPROVED'),
  ];

  if (opts.withPhotos) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${ritualTestimonialPhotos}
      WHERE ${ritualTestimonialPhotos.testimonialId} = ${ritualTestimonials.id}
        AND ${ritualTestimonialPhotos.facesStatus} = 'OK'
    )`);
  }

  if (opts.tags?.length) {
    conditions.push(sql`${ritualTestimonials.ritualTags} && ${opts.tags}::text[]`);
  }

  if (opts.signal) {
    conditions.push(eq(ritualTestimonials.wouldRecommend, opts.signal));
  }

  if (opts.cursor) {
    conditions.push(sql`(${ritualTestimonials.publishedAt}, ${ritualTestimonials.id}) < (${opts.cursor.publishedAt}, ${opts.cursor.id})`);
  }

  const rows = await db
    .select()
    .from(ritualTestimonials)
    .where(and(...conditions))
    .orderBy(desc(ritualTestimonials.publishedAt), desc(ritualTestimonials.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor({ publishedAt: last.publishedAt!, id: last.id })
    : null;

  // Fetch photos in batch
  const ids = items.map(i => i.id);
  const photos = ids.length ? await db
    .select()
    .from(ritualTestimonialPhotos)
    .where(sql`${ritualTestimonialPhotos.testimonialId} IN ${ids} AND ${ritualTestimonialPhotos.facesStatus} = 'OK'`)
    .orderBy(ritualTestimonialPhotos.position) : [];

  return {
    items: items.map(toPublic(photos)),
    nextCursor,
    hasMore,
  };
}
```

### 4.3 Tests

`apps/web/src/lib/db/queries/__tests__/rituals.test.ts` :

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { listRituals, insertRitual, insertPhoto, refreshRitualAggregate, getRitualSummary } from '../rituals';

describe('listRituals', () => {
  beforeEach(async () => {
    await truncateTables(['ritual_testimonials', 'ritual_testimonial_photos']);
  });

  it('retourne 12 témoignages par défaut', async () => {
    for (let i = 0; i < 15; i++) {
      await insertRitual({ /* fixture */ });
    }
    const result = await listRituals({ productKey: 'pack-femiglow' });
    expect(result.items).toHaveLength(12);
    expect(result.hasMore).toBe(true);
  });

  it('filtre par with_photos', async () => {
    const a = await insertRitual({ /* sans photo */ });
    const b = await insertRitual({ /* avec photo */ });
    await insertPhoto(b.id, { facesStatus: 'OK' });
    const result = await listRituals({ productKey: 'pack-femiglow', withPhotos: true });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].publicSlug).toBe(b.publicSlug);
  });

  it('pagine via cursor de manière stable', async () => {
    for (let i = 0; i < 15; i++) {
      await insertRitual({ /* */ });
    }
    const page1 = await listRituals({ productKey: 'pack-femiglow', limit: 5 });
    expect(page1.items).toHaveLength(5);
    const page2 = await listRituals({ productKey: 'pack-femiglow', limit: 5, cursor: decodeCursor(page1.nextCursor!) });
    expect(page2.items).toHaveLength(5);
    // Aucun doublon
    const idsP1 = page1.items.map(i => i.publicSlug);
    const idsP2 = page2.items.map(i => i.publicSlug);
    expect(idsP1.some(id => idsP2.includes(id))).toBe(false);
  });
});

describe('getRitualSummary', () => {
  it('calcule la distribution oui/hesite/non', async () => {
    await insertRitual({ wouldRecommend: 'oui' });
    await insertRitual({ wouldRecommend: 'oui' });
    await insertRitual({ wouldRecommend: 'hesite' });
    await refreshRitualAggregate();
    const summary = await getRitualSummary('pack-femiglow');
    expect(summary.totalCount).toBe(3);
    expect(summary.ouiCount).toBe(2);
    expect(summary.hesiteCount).toBe(1);
  });
});
```

### 4.4 DoD

- ✓ Toutes les queries implémentées.
- ✓ Tests vert couverture > 90 %.

## 5. Phase B6 — Sanitization et auto-flags

### 5.1 `sanitize-body.ts`

```ts
export type SanitizeResult = { sanitized: string; flags: string[] };

export function sanitizeBody(input: string): SanitizeResult {
  let body = input;
  const flags: string[] = [];

  // 1. NFC normalize
  body = body.normalize('NFC');

  // 2. Strip emojis
  const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
  if (emojiPattern.test(body)) {
    flags.push('emoji_detected');
    body = body.replace(emojiPattern, '');
  }

  // 3. Apostrophes
  body = body.replace(/'/g, '’');

  // 4. Espaces fines
  body = body.replace(/(\S) ([:;?!])/g, '$1 $2');

  // 5. Trim + collapse
  body = body.trim().replace(/\s{2,}/g, ' ');

  return { sanitized: body, flags };
}
```

### 5.2 `auto-flags.ts`

```ts
import { getForbiddenWords } from './forbidden-words';

export async function detectAutoFlags(body: string): Promise<string[]> {
  const flags: string[] = [];
  if (/https?:\/\/|www\./i.test(body)) flags.push('link_external');
  if (/\S+@\S+\.\S+/i.test(body)) flags.push('email_in_body');
  if (/(\+212|^06|^07)\d{8}/.test(body)) flags.push('phone_in_body');
  if (body.length < 80) flags.push('body_short');
  if (body.length > 500) flags.push('body_long');

  const upperRatio = body.replace(/[^A-Z]/g, '').length / body.length;
  if (upperRatio > 0.5) flags.push('all_caps');

  if (/(.)\1{5,}/.test(body)) flags.push('repetition');

  const forbidden = await getForbiddenWords();
  for (const word of forbidden) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(body)) {
      flags.push('forbidden_word');
      break;
    }
  }

  return flags;
}
```

### 5.3 Tests

12 scénarios à couvrir dans `sanitize-body.test.ts` :

| Cas | Input | Output |
| --- | --- | --- |
| Emoji simple | `Très bien 😊` | `Très bien`, flags `['emoji_detected']` |
| Multiples emojis | `🌸 paste 💅 powder ✨` | `paste powder`, `['emoji_detected']` |
| Apostrophe droite | `l'ongle` | `l’ongle` |
| Apostrophe déjà courbe | `l’ongle` | identique |
| Guillemets | `"un mot"` | `« un mot »` (à implémenter si on étend) |
| Espace avant ponctuation | `bonjour ! comment` | `bonjour ! comment` |
| Espaces multiples | `mot  mot` | `mot mot` |
| Trim | `  mot  ` | `mot` |
| Body vierge | `` | `` (puis Zod rejette pour longueur) |
| Body très long | 1000 chars | inchangé, mais `body_long` détecté |
| All caps | `JE RECOMMANDE` | inchangé, flag `all_caps` |
| URL | `voir https://exemple.com` | inchangé, flag `link_external` |

### 5.4 DoD

- ✓ Pipeline complet implémenté.
- ✓ 12 tests verts.

## 6. Phase B8-B9 — Vision ML et pipeline photos

### 6.1 `vision-ml-faces.ts`

```ts
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let detector: FaceDetector | null = null;

async function getDetector(): Promise<FaceDetector> {
  if (detector) return detector;
  const vision = await FilesetResolver.forVisionTasks('https://storage.googleapis.com/mediapipe-models/...');
  detector = await FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '...', delegate: 'CPU' },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.85,
  });
  return detector;
}

export type FacesCheckResult = {
  status: 'OK' | 'MANUAL_REVIEW' | 'REJECTED_FACE';
  facesCount: number;
};

export async function checkFaces(imageBuffer: Buffer, timeoutMs = 5000): Promise<FacesCheckResult> {
  return Promise.race([
    runDetection(imageBuffer),
    new Promise<FacesCheckResult>((resolve) =>
      setTimeout(() => resolve({ status: 'MANUAL_REVIEW', facesCount: 0 }), timeoutMs)
    ),
  ]);
}

async function runDetection(imageBuffer: Buffer): Promise<FacesCheckResult> {
  const det = await getDetector();
  const image = await loadImage(imageBuffer);
  const result = det.detect(image);

  const validFaces = result.detections.filter(d =>
    d.categories[0].score >= 0.85 &&
    boundingBoxRatio(d.boundingBox, image) >= 0.08
  );

  if (validFaces.length === 0) return { status: 'OK', facesCount: 0 };

  const hasFrontal = validFaces.some(d => d.categories[0].score >= 0.95);
  return {
    status: hasFrontal ? 'REJECTED_FACE' : 'MANUAL_REVIEW',
    facesCount: validFaces.length,
  };
}
```

### 6.2 `photo-pipeline.ts`

```ts
import sharp from 'sharp';
import { put } from '@vercel/blob';

export async function processPhoto(file: File, ritualId: string) {
  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate dimensions
  const meta = await sharp(buffer).metadata();
  if (meta.width! < 600 || meta.height! < 600) {
    throw new BadRequestError('Image too small');
  }

  // Strip EXIF
  const stripped = await sharp(buffer).rotate().withMetadata({ exif: {} }).toBuffer();

  // Variants
  const display = await sharp(stripped).resize(1200, 1200, { fit: 'inside' }).webp({ quality: 75 }).toBuffer();
  const thumb = await sharp(stripped).resize(240, 240, { fit: 'cover' }).webp({ quality: 70 }).toBuffer();

  // Upload
  const blobKey = `rituals/${ritualId}/${crypto.randomUUID()}`;
  const blobDisplay = await put(`${blobKey}-display.webp`, display, { access: 'public' });
  const blobThumb = await put(`${blobKey}-thumb.webp`, thumb, { access: 'public' });

  return {
    url: blobDisplay.url,
    thumbUrl: blobThumb.url,
    width: meta.width!,
    height: meta.height!,
    byteSize: stripped.byteLength,
    mime: 'image/webp',
  };
}
```

### 6.3 Tests

```ts
describe('checkFaces', () => {
  it('OK sur photo de mains sans visage', async () => {
    const buf = fs.readFileSync(__dirname + '/fixtures/hands-only.jpg');
    const result = await checkFaces(buf);
    expect(result.status).toBe('OK');
    expect(result.facesCount).toBe(0);
  });

  it('REJECTED_FACE sur photo de visage frontal', async () => {
    const buf = fs.readFileSync(__dirname + '/fixtures/face-frontal.jpg');
    const result = await checkFaces(buf);
    expect(result.status).toBe('REJECTED_FACE');
    expect(result.facesCount).toBeGreaterThan(0);
  });

  it('MANUAL_REVIEW sur photo de hijab (visage partiel)', async () => {
    const buf = fs.readFileSync(__dirname + '/fixtures/hijab-partial.jpg');
    const result = await checkFaces(buf);
    expect(result.status).toBe('MANUAL_REVIEW');
  });

  it('timeout retourne MANUAL_REVIEW', async () => {
    const result = await checkFaces(Buffer.alloc(0), 1);
    expect(result.status).toBe('MANUAL_REVIEW');
  });
});
```

Fixtures de test à placer dans `apps/web/src/lib/rituals/__tests__/fixtures/`.

### 6.4 DoD

- ✓ 4 fixtures testées avec résultats attendus.
- ✓ Timeout 5 sec respecté.

## 7. Phase B12-B15 — API publique

### 7.1 Pattern de Route Handler

```ts
// app/api/rituals/summary/route.ts
import { NextResponse } from 'next/server';
import { getRitualSummary } from '@/lib/db/queries/rituals';
import { handleApiError } from '@/lib/errors';

export const revalidate = 300; // 5 min cache

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productKey = searchParams.get('product_key');
    if (!productKey) throw new BadRequestError('product_key required');

    const summary = await getRitualSummary(productKey);
    return NextResponse.json(
      { data: summary },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (e) {
    return handleApiError(e);
  }
}
```

### 7.2 Route POST submit (extrait)

```ts
// app/api/rituals/submit/route.ts
import { rateLimit } from '@/lib/rate-limit';
import { RitualTestimonialSubmit } from '@/lib/schemas/rituals';
import { submitRitual } from '@/lib/rituals/moderation';
import { getClientIp } from '@/lib/http';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    await rateLimit.check({ key: `ritual-submit:ip:${ip}`, limit: 1, windowSec: 86400 });

    const body = await request.json();
    const parsed = RitualTestimonialSubmit.parse(body);

    if (parsed.emailToken) {
      const decoded = await decodeEmailToken(parsed.emailToken);
      await rateLimit.check({
        key: `ritual-submit:customer:${decoded.customerHash}`,
        limit: 1,
        windowSec: 2592000, // 30 j
      });
    }

    const result = await submitRitual(parsed, { ip });
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (e) {
    return handleApiError(e);
  }
}
```

### 7.3 Tests d'intégration

`apps/web/src/test/integration/api-rituals.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { POST as submitHandler } from '@/app/api/rituals/submit/route';

describe('POST /api/rituals/submit', () => {
  it('accepte un submit valide et retourne 202', async () => {
    const req = new Request('http://localhost/api/rituals/submit', {
      method: 'POST',
      body: JSON.stringify({
        productKey: 'pack-femiglow',
        body: 'Trois mois et l\'ongle a retrouvé sa nervure...',
        wouldRecommend: 'oui',
      }),
    });
    const res = await submitHandler(req);
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.data.publicSlug).toMatch(/^[a-z0-9]{8}$/);
  });

  it('rejette un body trop court avec 400', async () => {
    const req = new Request('http://localhost/api/rituals/submit', {
      method: 'POST',
      body: JSON.stringify({ productKey: 'pack-femiglow', body: 'court', wouldRecommend: 'oui' }),
    });
    const res = await submitHandler(req);
    expect(res.status).toBe(400);
  });

  it('rate-limit : 2e POST même IP < 24h → 429', async () => {
    // ...
  });
});
```

### 7.4 DoD

- ✓ Toutes les routes publiques répondent.
- ✓ Cache-Control headers présents sur GET.
- ✓ 202 sur POST.
- ✓ 429 sur rate-limit.

## 8. Phase B18-B22 — API admin

### 8.1 Pattern admin

```ts
// app/api/admin/rituals/[id]/route.ts
import { requireAdmin } from '@/lib/auth/require-admin';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(request);
    const body = await request.json();
    const parsed = RitualModerationAction.parse(body);

    const result = await applyModerationAction({
      ritualId: params.id,
      actorId: session.userId,
      action: parsed.action,
      note: parsed.note,
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    return handleApiError(e);
  }
}
```

### 8.2 DoD

- ✓ Toutes les routes admin requièrent admin session.
- ✓ Audit log écrit à chaque action.

## 9. Phase B23-B25 — CRON

### 9.1 CRON aggregate refresh

```ts
// app/api/cron/rituals-refresh-aggregate/route.ts
export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  await refreshRitualAggregate();
  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
}
```

### 9.2 CRON e-mail J+45

```ts
// app/api/cron/rituals-email-j45/route.ts
export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(
      eq(ordersTable.status, 'paid'),
      sql`${ordersTable.paidAt} BETWEEN now() - interval '46 days' AND now() - interval '45 days'`,
      sql`NOT EXISTS (
        SELECT 1 FROM ritual_email_log
        WHERE ritual_email_log.order_id = ${ordersTable.id}
      )`
    ));

  for (const order of orders) {
    const token = generateEmailToken({
      orderId: order.id,
      customerHash: order.customerHash,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 30 * 86400 * 1000,
    });
    await sendEmailJ45({ to: order.customerEmail, firstName: order.firstName, token });
    await markEmailSent(order.id);
  }

  return NextResponse.json({ ok: true, sent: orders.length });
}
```

### 9.3 Vercel CRON config

`apps/web/vercel.json` :

```json
{
  "crons": [
    { "path": "/api/cron/rituals-refresh-aggregate", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/rituals-email-j45", "schedule": "0 9 * * *" },
    { "path": "/api/cron/rituals-faces-recheck-stale", "schedule": "0 * * * *" }
  ]
}
```

### 9.4 DoD

- ✓ 3 CRON déclenchables manuellement avec succès.
- ✓ Auth bearer respectée.

## 10. Phase B28 — Seed initial

### 10.1 Script

```ts
// apps/web/scripts/seed-rituals.ts
import { db } from '@/lib/db/client';
import { ritualTestimonials, ritualTestimonialPhotos } from '@/lib/db/schema';

const fixtures = [
  {
    publicSlug: 'amal-001',
    productKey: 'pack-femiglow',
    body: 'Trois mois et l’ongle a retrouvé sa nervure. J’ai cessé de le forcer. Je remarque que les cuticules ont apaisé.',
    wouldRecommend: 'oui',
    ritualTags: ['ongles-plus-lisses', 'plus-de-casse'],
    authorFirstName: 'Amal',
    authorCity: 'Rabat',
    initiatedSince: '2026-02',
    status: 'APPROVED',
    source: 'manual',
    featured: true,
    publishedAt: new Date(),
  },
  // 2 autres
];

async function main() {
  for (const f of fixtures) {
    await db.insert(ritualTestimonials).values(f);
  }
  console.log(`Seeded ${fixtures.length} rituals.`);
}

main().catch(console.error);
```

### 10.2 Run

```bash
pnpm --filter @femiglow/web tsx scripts/seed-rituals.ts
```

### 10.3 DoD

- ✓ 3 témoignages insérés.
- ✓ `GET /api/rituals/summary` retourne `totalCount: 3`.

## 11. Récapitulatif charge backend

| Phase | Charge |
| --- | --- |
| B1-B2 BDD migrations | 1 j |
| B3-B4 Schemas Drizzle + Zod | 0,5 j |
| B5 Queries | 1 j |
| B6 Sanitize + auto-flags | 0,5 j |
| B7 Customer hash + tokens | 0,5 j |
| B8 Vision ML | 1 j |
| B9 Photo pipeline | 0,5 j |
| B10 Moderation orchestrator | 0,5 j |
| B11 Aggregator | 0,5 j |
| B12-B17 API publique | 2 j |
| B18-B22 API admin | 2 j |
| B23-B25 CRON | 0,5 j |
| B26 Email templates | 0,5 j |
| B27 Vercel config | 0,1 j |
| B28 Seed | 0,1 j |
| **Total** | **~11 j** |

## 12. Module import — extension backend

Le système d'import ajoute les livrables backend suivants (détails dans `↗ 13-import-system-architecture.md` et `↗ 04-backend-plan-action.md`).

| Domaine | Livrable | Charge |
| --- | --- | --- |
| BDD | Migration `0018_rituals_import.sql` (3 tables + enums) | 0,5 j |
| Services | `lib/rituals/import/parser/{csv,json,jsonl,zip}.ts` | 1,5 j |
| Services | `mapper.ts`, `row-validator.ts`, `duplicate-detector.ts`, `media-extractor.ts` | 1 j |
| API admin | 9 endpoints `/api/admin/rituals/import/*` | 1,5 j |
| Templates | `template-generator.ts` (5 formats + ZIP sample) | 0,3 j |
| CRON | `/api/cron/rituals-import-cleanup` (horaire) | 0,1 j |
| Bulk | `lib/rituals/bulk.ts` + `POST /api/admin/rituals/bulk-action` | 0,5 j |
| Tests | Catalogue dédié (parsers, validator, queries, MSW, E2E) | 1,5 j |
| **Total** | | **~7 j** |

Le cumul backend (rituels lecture + soumission + import + bulk) = **~18 j**.

## 13. Synthèse — règles d'or backend

1. **Aucune logique dans `route.ts`.** Tout délègue à `lib/rituals/*`.
2. **Validation Zod sur toute entrée externe.**
3. **Sanitization avant insert.**
4. **Rate-limit sur toute mutation publique.**
5. **`require-admin()` sur toute route admin.**
6. **Bearer secret sur tout CRON.**
7. **Audit log écrit à chaque mutation admin** (incluant les bulk actions).
8. **Pas de SQL string concat, toujours paramétré via Drizzle.**
9. **Tests Vitest > 90 % de couverture sur `lib/rituals/**`** (incluant `lib/rituals/import/**`).
10. **EXIF strip + face detection async sur toute photo** (saisie wizard + import).
11. **Aucun témoignage importé n'est `APPROVED` directement** — passage obligatoire par modération.
12. **Bulk actions sont transactionnelles par chunks de 50** + audit double (per-ritual + global).
13. **Templates téléchargeables sans authentification supplémentaire** (déjà sous `require-admin()`).
14. **CRON cleanup purge `ritual_import_temp_media` expirés** et marque les batches abandonnés.

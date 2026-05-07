# 09 — Stratégie de tests

## Pyramide

```
        ┌────────────────────────────┐
        │   Playwright E2E (~10)     │   smoke flux complet
        │                            │
        ├────────────────────────────┤
        │   MSW intégration (~25)    │   API + fetch frontend
        │                            │
        ├────────────────────────────┤
        │                            │
        │   Vitest unit (~120)       │   logique pure, queries, pipeline
        │                            │
        └────────────────────────────┘
```

Chaque couche teste ce que la couche en-dessous **ne couvre pas**.

## Vitest unit

### Périmètre

- `src/lib/media/pipeline/*` — encodage image/vidéo/audio (mockable
  via `sharp` réel + buffers de fixtures).
- `src/lib/media/queries/*` — double-driver (Drizzle stub + memoryStore).
- `src/lib/media/storage/*` — adapter local en mémoire.
- `src/lib/media/queue/*` — claim, retry, backoff.
- `src/lib/media/components/utils` — `resolveConfig`, `pickVariants`,
  `buildSrcset`, `blurhashToSvgDataUrl`.
- `src/lib/media/hooks/*` — hooks isolés via `@testing-library/react-hooks`.

### Fixtures

```
apps/web/src/lib/media/__fixtures__/
  small-image.png         (32 × 32, 1.2 KB)
  hero-image.png          (1600 × 1067, 2.1 MB) — copie de docs/images/values
  short-video.mp4         (320 × 240, 2 s, 80 KB)
  short-audio.mp3         (3 s, 30 KB)
  invalid-mime.txt        (text mais nommé .png)
  too-large.bin           (30 MB pour tester la limite)
```

**Important** : copies réduites de `docs/images/values/` plutôt que
les originaux 2 MB qui ralentiraient les tests. Un script
`scripts/build-test-fixtures.ts` les génère depuis les sources.

### Exemples

#### `pipeline/image.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { optimizeImage } from '../pipeline/image';

const HERO_PNG = readFileSync('src/lib/media/__fixtures__/hero-image.png');

describe('optimizeImage', () => {
  it('produces all variants for hero profile', async () => {
    const { variants, metadata } = await optimizeImage(HERO_PNG, HERO_CONFIG);
    expect(variants).toHaveLength(18); // 6 breakpoints × 3 formats
    expect(metadata.blurhash).toMatch(/^[A-Za-z0-9#$%*+,\-.:;=?@\[\]^_{|}~]{6,}$/);
    expect(metadata.palette).toHaveLength(3);
  });

  it('emits AVIF smaller than JPEG at same breakpoint', async () => {
    const { variants } = await optimizeImage(HERO_PNG, HERO_CONFIG);
    const avifMd = variants.find(v => v.format === 'avif' && v.breakpoint === 'md');
    const jpegMd = variants.find(v => v.format === 'jpeg' && v.breakpoint === 'md');
    expect(avifMd!.buffer.byteLength).toBeLessThan(jpegMd!.buffer.byteLength * 0.7);
  });

  it('respects withoutEnlargement (no upscaling above source width)', async () => {
    const small = readFileSync('src/lib/media/__fixtures__/small-image.png'); // 32×32
    const { variants } = await optimizeImage(small, HERO_CONFIG);
    expect(variants.every(v => v.width! <= 32)).toBe(true);
  });

  it('computes stable phash for same input', async () => {
    const a = await optimizeImage(HERO_PNG, HERO_CONFIG);
    const b = await optimizeImage(HERO_PNG, HERO_CONFIG);
    expect(a.metadata.phash).toBe(b.metadata.phash);
  });
});
```

#### `queries/media.test.ts`

```ts
describe.each(['drizzle', 'memory'] as const)('media queries (%s driver)', (driver) => {
  beforeEach(async () => {
    await setupDriver(driver);
    if (driver === 'drizzle') await migrateAndSeed();
  });

  it('inserts and retrieves a media by slug', async () => {
    const id = await createMedia({ slug: 'test-1', kind: 'image', alt: 't', source: 'upload' });
    const found = await findMediaBySlug('test-1');
    expect(found?.id).toBe(id);
  });

  it('rejects duplicate slug when not deleted', async () => {
    await createMedia({ slug: 'dup', kind: 'image', alt: 'x', source: 'upload' });
    await expect(createMedia({ slug: 'dup', kind: 'image', alt: 'y', source: 'upload' }))
      .rejects.toThrow(/duplicate/i);
  });

  it('allows reusing slug after soft delete', async () => {
    const id1 = await createMedia({ slug: 'reuse', kind: 'image', alt: 'a', source: 'upload' });
    await softDeleteMedia(id1);
    const id2 = await createMedia({ slug: 'reuse', kind: 'image', alt: 'b', source: 'upload' });
    expect(id2).not.toBe(id1);
  });
});
```

#### `storage/local.test.ts`

```ts
describe('localStorageAdapter', () => {
  beforeEach(() => mkdirSync(MEDIA_LOCAL_ROOT, { recursive: true }));
  afterEach(() => rmSync(MEDIA_LOCAL_ROOT, { recursive: true }));

  it('puts and gets a buffer with correct checksum', async () => {
    const buf = Buffer.from('hello');
    const { url, checksum } = await localAdapter.put('test/foo.txt', buf, { contentType: 'text/plain' });
    expect(url).toBe('/_media/test/foo.txt');
    expect(checksum).toBe(createHash('sha256').update('hello').digest('hex'));
    expect(await localAdapter.get('test/foo.txt')).toEqual(buf);
  });
});
```

#### `components/resolve-config.test.ts`

(cf. `08-overrides.md` § "Testabilité")

#### `hooks/use-media-in-view.test.tsx`

```ts
import { renderHook } from '@testing-library/react';
import { mockIntersectionObserver } from '../__test-utils__/mockIO';

describe('useMediaInView', () => {
  it('reports inView=true when element intersects', () => {
    const io = mockIntersectionObserver();
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useMediaInView(ref));
    expect(result.current.inView).toBe(false);

    io.trigger(ref.current, true);
    expect(result.current.inView).toBe(true);
    expect(result.current.hasBeenInView).toBe(true);
  });

  it('disconnects after first hit when once=true', () => {
    const io = mockIntersectionObserver();
    const ref = { current: document.createElement('div') };
    renderHook(() => useMediaInView(ref, { once: true }));
    io.trigger(ref.current, true);
    expect(io.disconnects).toBe(1);
  });
});
```

### Configuration Vitest

`apps/web/vitest.config.ts` (existant, à étendre) :

```ts
export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    pool: 'forks', // sharp requiert un worker isolé
    poolOptions: { forks: { singleFork: false, isolate: true } },
    coverage: {
      include: ['src/lib/media/**/*.ts', 'src/components/media/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/__fixtures__/**'],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
```

`vitest.setup.ts` configure :

- `process.env.MEDIA_STORAGE_DRIVER = 'local'`
- mock global de `IntersectionObserver` si non présent
- mock de `navigator.connection`

## MSW intégration

### Périmètre

Tests qui couvrent le **flux complet** entre le frontend et l'API,
sans serveur réel, en interceptant `fetch` via Mock Service Worker.

### Setup

`apps/web/src/test-utils/msw/handlers/media.ts` :

```ts
import { http, HttpResponse } from 'msw';

export const mediaHandlers = [
  http.get('/api/media/:idOrSlug', ({ params }) => {
    const m = mockMediaStore.findByIdOrSlug(params.idOrSlug as string);
    if (!m) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    return HttpResponse.json(serializeMedia(m), {
      headers: { 'Cache-Control': 'public, s-maxage=86400' },
    });
  }),

  http.post('/api/admin/media/upload', async ({ request }) => {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const url = form.get('url') as string | null;
    if (!file && !url) return HttpResponse.json({ error: 'missing_source' }, { status: 400 });
    // … validation magic-bytes via file-type sur les premières octets
    const id = `me_${nanoid(8)}`;
    mockMediaStore.insert({ id, slug: form.get('slug') as string, kind: form.get('kind') as string, status: 'pending' });
    return HttpResponse.json({ id, status: 'pending', job_id: `mj_${nanoid(8)}` }, { status: 201 });
  }),

  http.patch('/api/admin/media/:id', async ({ params, request }) => {
    const body = await request.json();
    const m = mockMediaStore.update(params.id as string, body);
    return HttpResponse.json(m);
  }),

  http.post('/api/admin/media/:id/regenerate', ({ params }) => {
    return HttpResponse.json({ job_id: `mj_${nanoid(8)}`, already_pending: false });
  }),

  http.post('/api/cron/media-optimize', ({ request }) => {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const job = mockMediaStore.claimNextJob();
    if (!job) return HttpResponse.json({ status: 'idle' });
    // … simule l'optimisation
    return HttpResponse.json({ status: 'done', job_id: job.id });
  }),
];
```

### Tests

#### `media-public-api.integration.test.ts`

```ts
import { setupServer } from 'msw/node';
import { mediaHandlers } from '@/test-utils/msw/handlers/media';

const server = setupServer(...mediaHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GET /api/media/:idOrSlug', () => {
  it('returns 404 for unknown slug', async () => {
    const res = await fetch('/api/media/inexistant');
    expect(res.status).toBe(404);
  });

  it('returns media with variants and cache headers', async () => {
    mockMediaStore.seed({ id: 'me_1', slug: 'hero', status: 'ready', variants: [/*…*/] });
    const res = await fetch('/api/media/hero');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400');
    const body = await res.json();
    expect(body.variants.length).toBeGreaterThan(0);
  });

  it('hides soft-deleted media', async () => {
    mockMediaStore.seed({ id: 'me_2', slug: 'old', deleted_at: new Date(), variants: [] });
    const res = await fetch('/api/media/old');
    expect(res.status).toBe(404);
  });
});
```

#### `upload-flow.integration.test.tsx`

```ts
it('uploads a file and creates a pending media + job', async () => {
  const file = new File([heroPngBuffer], 'hero.png', { type: 'image/png' });
  const form = new FormData();
  form.append('file', file);
  form.append('kind', 'image');
  form.append('alt', 'test alt');

  const res = await fetch('/api/admin/media/upload', { method: 'POST', body: form });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.id).toMatch(/^me_/);
  expect(body.status).toBe('pending');
});

it('rejects file with mime spoof (txt named .png)', async () => {
  const file = new File(['hello world'], 'spoof.png', { type: 'image/png' });
  const form = new FormData();
  form.append('file', file);
  form.append('kind', 'image');
  form.append('alt', 'spoof');

  const res = await fetch('/api/admin/media/upload', { method: 'POST', body: form });
  expect(res.status).toBe(415);
});

it('detects duplicate phash and returns existing_id', async () => {
  mockMediaStore.seed({ id: 'me_existing', phash: 'abc123…', status: 'ready', variants: [] });
  // Simule un upload du même fichier
  const file = new File([heroPngBuffer], 'hero-dup.png', { type: 'image/png' });
  const form = new FormData();
  form.append('file', file);
  form.append('kind', 'image');
  form.append('alt', 'dup');

  const res = await fetch('/api/admin/media/upload', { method: 'POST', body: form });
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.duplicate).toBe(true);
  expect(body.existing_id).toBe('me_existing');
});
```

#### `cron-worker.integration.test.ts`

```ts
it('claims a pending job and marks it done', async () => {
  mockMediaStore.seed({ id: 'me_x', status: 'pending' });
  mockMediaStore.seedJob({ media_id: 'me_x', kind: 'optimize', status: 'pending' });

  const res = await fetch('/api/cron/media-optimize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('done');

  const updated = mockMediaStore.findByIdOrSlug('me_x');
  expect(updated.status).toBe('ready');
});

it('retries with exponential backoff on transient failure', async () => {
  // injecte une erreur sur le 1er appel à sharp
  // … vérifie que attempt_count = 1 et next_attempt_at = now() + 5s
});

it('marks failed after MAX_ATTEMPTS', async () => {
  // … vérifie status='failed' et alerte Sentry
});
```

## Playwright E2E

### Périmètre

Smoke tests **end-to-end** sur le flux complet, depuis le navigateur
jusqu'à la base de données et le storage. Pas de mock — exécutés
contre `pnpm dev` avec une DB de test.

### Configuration

`apps/web/playwright.config.ts` (existant, à étendre) :

```ts
projects: [
  {
    name: 'media-admin',
    testDir: './e2e/media',
    use: { baseURL: 'http://localhost:3000', storageState: 'auth-admin.json' },
  },
],
```

### Tests

#### `e2e/media/upload.spec.ts`

```ts
test('admin uploads an image and sees it ready after pipeline', async ({ page }) => {
  await page.goto('/admin/media/upload');
  await page.setInputFiles('input[type=file]', 'docs/images/values/kit/principal.png');
  await page.fill('input[name="alt"]', 'kit principal posé sur du linge');
  await page.click('button:has-text("Importer")');

  await expect(page.locator('text=1 média importé')).toBeVisible();
  await page.goto('/admin/media');

  // attend que le cron passe (CRON_FREQUENCY_E2E_MS=2000)
  await expect(page.locator('[data-testid="media-tile"]:has-text("kit-principal")'))
    .toHaveAttribute('data-status', 'ready', { timeout: 10_000 });
});
```

#### `e2e/media/library.spec.ts`

```ts
test('library shows badges and filters by status', async ({ page }) => {
  await page.goto('/admin/media');
  await expect(page.locator('[data-testid="media-tile"]')).toHaveCount(5); // seed
  await expect(page.locator('[data-testid="badge-optimized"]')).toHaveCount(5);

  await page.selectOption('select[name="status"]', 'failed');
  await expect(page.locator('[data-testid="media-tile"]')).toHaveCount(0);
  await expect(page.locator('text=Aucun média ne correspond')).toBeVisible();
});

test('drawer shows variants and audit log', async ({ page }) => {
  await page.goto('/admin/media');
  await page.click('[data-testid="media-tile"]:first-child');

  await expect(page.locator('[role=dialog][aria-modal=true]')).toBeVisible();
  await expect(page.locator('text=Variantes générées')).toBeVisible();
  await expect(page.locator('text=Journal')).toBeVisible();
});
```

#### `e2e/media/public-rendering.spec.ts`

```ts
test('home page renders hero with picture + srcset', async ({ page }) => {
  await page.goto('/');

  const picture = page.locator('main picture').first();
  await expect(picture).toBeVisible();

  const sources = picture.locator('source');
  await expect(sources).toHaveCount(2); // avif + webp
  await expect(sources.nth(0)).toHaveAttribute('type', 'image/avif');

  const img = picture.locator('img');
  await expect(img).toHaveAttribute('loading', 'eager');
  await expect(img).toHaveAttribute('fetchpriority', 'high');
  await expect(img).toHaveAttribute('width', /\d+/);
  await expect(img).toHaveAttribute('height', /\d+/);
});

test('lazy image only loads after viewport scroll', async ({ page }) => {
  await page.goto('/journal');
  const downImage = page.locator('[data-slug="far-down-image"] img');

  // Avant scroll : src est un transparent pixel
  await expect(downImage).toHaveAttribute('src', /^data:image\/gif/);

  await downImage.scrollIntoViewIfNeeded();
  await expect(downImage).toHaveAttribute('src', /\.(avif|webp|jpeg)$/, { timeout: 3000 });
});
```

#### `e2e/media/lcp.spec.ts`

```ts
test('home LCP under 2.5s on simulated 4G', async ({ browser }) => {
  const context = await browser.newContext({
    // simule un réseau lent et une CPU médiocre
    offline: false,
  });
  const cdp = await context.newCDPSession(context.pages()[0] ?? await context.newPage());
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, downloadThroughput: 1.5 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, latency: 40,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const page = await context.newPage();
  const start = Date.now();
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  const lcp = await page.evaluate(() => new Promise<number>((resolve) => {
    new PerformanceObserver((list) => {
      const last = list.getEntries().pop();
      if (last) resolve(last.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }));

  expect(lcp).toBeLessThan(2500);
});
```

## jest-axe (a11y)

Intégré dans Vitest via `vitest-axe`.

```ts
import { axe } from 'vitest-axe';

it('MediaImage has zero a11y violations', async () => {
  const { container } = render(<MediaImage slug="hero" alt="alt text" />);
  expect(await axe(container)).toHaveNoViolations();
});

it('admin library page has zero a11y violations', async () => {
  const { container } = render(<AdminMediaPage initialMedia={mockMedia} />);
  expect(await axe(container)).toHaveNoViolations();
});

it('drawer respects focus trap', async () => {
  // … vérifie que tab cycle reste dans le drawer
});
```

CI : 0 violation tolérée sur les pages `/admin/media`, `/admin/media/upload`,
`/admin/media/[id]`, et sur les pages publiques qui consomment
`<MediaImage>` (`/`, `/rituel`, `/journal`).

## Tests de charge k6

Phase 2 / staging uniquement (cohérent avec `apps/web/k6/README.md`).

`k6/media-pipeline.js` :

- 50 uploads/min pendant 5 min
- vérifier que la queue ne dépasse pas 100 jobs pending
- p95 du POST upload < 1.5 s

`k6/media-public-read.js` :

- 500 req/s sur `GET /api/media/:slug` pendant 60 s
- p95 < 200 ms (CDN HIT) / 600 ms (origin)
- error rate < 0.5 %

## Stratégie globale

### Critères d'acceptation par phase

| Phase | Vitest | MSW | Playwright | jest-axe |
|---|---|---|---|---|
| Phase 1 (data + pipeline) | ≥ 80 tests, coverage ≥ 85 % sur `lib/media` | 5 tests | 0 | n/a |
| Phase 2 (frontend RSC) | +20 tests | +10 tests | 3 smoke tests | 0 violation |
| Phase 3 (admin UI) | +20 tests | +10 tests | +5 tests | 0 violation |
| Phase 4 (advanced) | total ≥ 120 | total ≥ 25 | total ≥ 10 | 0 violation |

### CI

Tous les tests tournent dans GitHub Actions sur chaque PR. Échec = red
PR. Le seul test qui peut être flaky est l'E2E LCP (réseau simulé) : il
est marqué `test.fixme.fail.if(env.CI && env.SLOW_RUNNERS)`.

### Local

```bash
pnpm test            # vitest watch
pnpm test:msw        # vitest MSW intégration uniquement
pnpm test:e2e        # playwright (lance le serveur dev en parallèle)
pnpm test:a11y       # vitest-axe seul
pnpm test:cov        # coverage report HTML
```

### Données de test

`scripts/seed-media-test.ts` réutilise les images de
`docs/images/values/{home,journal,kit,maison,rituel}/*.png` et crée :

- 10 médias `image` avec status `ready` (variantes pré-générées)
- 2 médias `image` avec status `pending` (job en attente)
- 1 média `image` avec status `failed`
- 1 média `video` (court mp4 dans `__fixtures__/`)
- 1 média `audio` (court mp3 dans `__fixtures__/`)
- 1 média `external` (URL stable de placeholder.com)

Ce seed garantit la reproductibilité des tests E2E.

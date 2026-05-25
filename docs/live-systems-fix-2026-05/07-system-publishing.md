# 07 — Fiche système : Live publishing social

## Périmètre

Pipeline de publication des contenus FemiGlow sur les plateformes sociales :
- Instagram (carrousels + reels)
- TikTok (vidéos courtes)
- Facebook (multi-image + vidéo)
- (Futur : Twitter / Pinterest)

3 modes :
- **`now`** : publish immédiat
- **`schedule`** : publish à une date future (via cron Vercel)
- **`draft`** : stockage admin, validation manuelle

## Fichiers clés

| Path | Rôle |
|---|---|
| `lib/social-publishing/` | Logique métier publishing |
| `lib/social-publishing/job-router.ts` | Mode router (now/schedule/draft) |
| `lib/social-publishing/content-builder.ts` | Build payload par plateforme |
| `lib/social-publishing/adapters/postiz.ts` | Adapter principal (proxy SaaS) |
| `lib/social-publishing/adapters/dry-run.ts` | Adapter test (no-op + log) |
| `lib/social-publishing/retry-policy.ts` | ⭐ NOUVEAU helper retry + dead letter |
| `lib/content-studio/jobs.ts` | DB queries scheduled_jobs |
| `app/api/content-studio/jobs/route.ts` | POST job |
| `app/api/cron/content-studio/social-publish-scheduler/route.ts` | Cron handler |
| `app/admin/content-studio/health/page.tsx` | ⭐ NOUVEAU dashboard |
| `vercel.json` | ⭐ FIX déclaration cron (P0) |

## Risques actuels (audit)

| # | Risque | Sévérité | Phase fix |
|---|---|---|---|
| P-1 | Cron Vercel absent → schedule cassé prod | 🔴 P0 | QW1 |
| P-2 | Pas de cap `attemptCount` → boucle infinie possible | 🟡 P1 | QW4 |
| P-3 | `content-builder` ne prend que media[0] → Insta = 1 image | 🟡 P1 | S3 |
| P-4 | Pas de dashboard santé → diagnostic difficile | 🟢 P2 | S5 |
| P-5 | Adapter `meta_graph` déclaré null dans registry | 🟢 P3 | S3 cleanup |

## Architecture cible

```
┌────────────────────────────────────────────────────────────────┐
│  ADMIN — /admin/content-studio                                 │
└────────────────────────┬───────────────────────────────────────┘
                         │ POST /api/content-studio/jobs
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  Job router                                                    │
│  Mode router selon publishMode:                                │
│    'now'      → executeJob() immédiat                          │
│    'schedule' → INSERT scheduled_jobs + scheduledFor           │
│    'draft'    → INSERT draft (admin valide plus tard)          │
└────────────────────────┬───────────────────────────────────────┘
                         │
       ┌─────────────────┴────────────────┐
       │                                  │
       ▼                                  ▼
┌──────────────────┐         ┌───────────────────────────────────┐
│  executeJob()    │         │  ⭐ FIX : Cron Vercel             │
│                  │         │  vercel.json:                     │
│  1. content-     │         │    crons: [                       │
│     builder ⭐   │         │      { path: "/api/cron/         │
│     (multi-media)│         │        content-studio/           │
│  2. adapter      │         │        social-publish-scheduler",│
│     dispatch     │         │        schedule: "*/5 * * * *" } │
│  3. retry-policy │         │    ]                              │
│     ⭐ cap = 5  │         │                                   │
│  4. audit log   │         │  → run query                      │
│  5. status       │         │      WHERE status='scheduled'     │
│     update      │         │       AND scheduledFor <= NOW()  │
└──────────────────┘         │  → executeJob() pour chacun       │
                              └───────────────────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────────┐
                              │  Dead letter queue                │
                              │  status='dead' après 5 tentatives │
                              │  + audit_log alerte admin         │
                              └───────────────────────────────────┘
```

## Détails par phase

### QW1 — Cron Vercel (10 min) ⚡

**Fichier** : `apps/web/vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/content-studio/social-publish-scheduler",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Pourquoi `*/5` et pas `*/1`** :
- Vercel Hobby plan = max 2 crons/jour, Pro = max 40, Enterprise = unlimited
- Publishing n'a pas besoin de précision sous-minute (rdv editorial = 15min granularité)
- Réduit le coût Vercel function invocations

**Vérification post-deploy** :
1. Dashboard Vercel → Crons → voir le cron actif
2. Créer un post test schedulé T+10min
3. Logs cron Vercel → invocation à T+5min et T+10min
4. audit_log montre publish à T+10min

### QW4 — Cap attemptCount (1 h) ⚡

**Migration DB** : `drizzle/migrations/XXXX_publishing_attempt_cap.sql`

```sql
ALTER TABLE scheduled_jobs
  ADD CONSTRAINT scheduled_jobs_attempt_cap CHECK (attempt_count <= 10);

ALTER TABLE scheduled_jobs
  ADD COLUMN dead_letter_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX scheduled_jobs_dead_letter_idx
  ON scheduled_jobs(status, dead_letter_at)
  WHERE status = 'dead';
```

**Helper** : `lib/social-publishing/retry-policy.ts`

```ts
const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60, 360]; // 1min, 5min, 15min, 1h, 6h

export interface RetryDecision {
  shouldRetry: boolean;
  nextRetryAt: Date | null;
  isDeadLetter: boolean;
  reason: string;
}

export function decideRetry(attemptCount: number, lastError?: string): RetryDecision {
  if (attemptCount >= MAX_ATTEMPTS) {
    return {
      shouldRetry: false,
      nextRetryAt: null,
      isDeadLetter: true,
      reason: `Max attempts (${MAX_ATTEMPTS}) reached`,
    };
  }
  const minutes = BACKOFF_MINUTES[attemptCount] ?? 360;
  return {
    shouldRetry: true,
    nextRetryAt: new Date(Date.now() + minutes * 60 * 1000),
    isDeadLetter: false,
    reason: `Retry in ${minutes}min (attempt ${attemptCount + 1}/${MAX_ATTEMPTS})`,
  };
}
```

**Câblage** dans executeJob :

```ts
catch (err) {
  const decision = decideRetry(job.attemptCount + 1, err.message);
  if (decision.isDeadLetter) {
    await markJobDead(job.id, decision.reason);
    await auditLog('publish_dead_letter', { jobId: job.id, error: err.message });
    await alertAdmin('Publishing dead letter', { jobId: job.id });
  } else {
    await updateJob(job.id, {
      attemptCount: job.attemptCount + 1,
      nextRetryAt: decision.nextRetryAt,
      lastError: err.message,
    });
  }
}
```

### S3 — Carrousels Insta (1 j)

**Fichier** : `lib/social-publishing/content-builder.ts`

**Avant** :
```ts
function buildSocialContent(post): SocialContent {
  return {
    // ...
    media: post.media[0] ? [post.media[0]] : [], // ❌ 1 seule image
  };
}
```

**Après** :
```ts
interface MediaCaps {
  maxImages: number;
  maxVideos: number;
  acceptsCarousel: boolean;
}

const PLATFORM_CAPS: Record<Platform, MediaCaps> = {
  instagram: { maxImages: 10, maxVideos: 1, acceptsCarousel: true },
  facebook: { maxImages: 10, maxVideos: 1, acceptsCarousel: true },
  tiktok: { maxImages: 0, maxVideos: 1, acceptsCarousel: false },
  twitter: { maxImages: 4, maxVideos: 1, acceptsCarousel: false },
  linkedin: { maxImages: 9, maxVideos: 1, acceptsCarousel: false },
};

export function buildSocialContent(post: ContentPost, platform: Platform): SocialContent {
  const caps = PLATFORM_CAPS[platform];
  const images = post.media.filter((m) => m.kind === 'image').slice(0, caps.maxImages);
  const videos = post.media.filter((m) => m.kind === 'video').slice(0, caps.maxVideos);

  // Si une vidéo, elle remplace les images sur certaines plateformes
  const media = videos.length > 0 && !caps.acceptsCarousel ? videos : [...images, ...videos];

  return {
    text: post.captions[platform] ?? post.captions.default,
    media,
    platform,
  };
}
```

**Tests** : 12 tests (4 plateformes × 3 scénarios image/video/mixed).

### S5 — Dashboard publishing health (1 j)

**Fichier** : `apps/web/src/app/admin/content-studio/health/page.tsx`

Page Server Component qui affiche :

```tsx
export default async function PublishingHealthPage() {
  const stats = await getPublishingHealthStats();
  return (
    <div>
      <h1>Santé Publishing</h1>

      <KpiCards>
        <Kpi label="Jobs en cours" value={stats.inFlight} />
        <Kpi label="Dead letters (24h)" value={stats.deadLetters} variant={stats.deadLetters > 0 ? 'alert' : 'ok'} />
        <Kpi label="Success rate (24h)" value={`${stats.successRate * 100}%`} />
        <Kpi label="Latence P95" value={`${stats.latencyP95Ms}ms`} />
      </KpiCards>

      <RecentJobsTable jobs={stats.recentJobs} />
      <DeadLetterAlerts items={stats.deadLetterAlerts} />
    </div>
  );
}
```

Query helper :
```ts
async function getPublishingHealthStats() {
  return {
    inFlight: await countJobs({ status: 'processing' }),
    deadLetters: await countJobs({ status: 'dead', since: yesterday() }),
    successRate: await calcSuccessRate({ since: yesterday() }),
    latencyP95Ms: await calcLatencyP95({ since: yesterday() }),
    recentJobs: await listRecentJobs({ limit: 20 }),
    deadLetterAlerts: await listDeadLetters({ since: yesterday() }),
  };
}
```

## Tests existants — couverture & trous

Existant :
- `lib/social-publishing/__tests__/` (couverture adapters, content-builder)
- `e2e/content-studio-social-publishing.spec.ts`
- `e2e/content-studio-social-publishing-draft.spec.ts`

**Trous à combler** :
- ❌ Cron scheduler jamais testé E2E (parce que pas dans vercel.json !)
- ❌ Retry policy non testé (n'existe pas encore)
- ❌ Dead letter trigger non testé
- ❌ Carrousels multi-media non testé (parce que pas implémenté !)
- ❌ Dashboard santé non testé

## Top 3 améliorations recommandées (priorité)

1. **QW1 Cron Vercel** (10 min) — débloque P0, schedule prod fonctionnel
2. **QW4 Cap attemptCount** (1 h) — élimine boucle infinie
3. **S3 Carrousels Insta** (1 j) — débloque feature attendue (probable demande user)

# 30.4 — Vérification des liens

## Objectifs

1. Détecter les liens cassés dans le footer / cookie banner / checkout
2. Bloquer les déploiements avec liens cassés (CI)
3. Alerter l'admin en cas de panne
4. Fournir un dashboard santé

## Niveau 1 — Build-time check (CI)

Script `scripts/check-legal-links.ts` qui :
1. Liste tous les `legal_page_placements WHERE is_visible = true`
2. Pour chaque (zone, page_slug) :
   - Vérifie que `legal_pages.slug` existe en DB
   - Vérifie que `legal_pages.status = 'published'`
   - Si KO → erreur

Mode `--strict` : exit 1 si une anomalie, ce qui fait échouer le CI.

```typescript
// scripts/check-legal-links.ts
import { db } from '@/lib/db/client';

async function main() {
  const placements = await db.legalPagePlacements.find({ is_visible: true });
  const errors: Error[] = [];

  for (const p of placements) {
    const page = await db.legalPages.findBySlug(p.page_slug);

    if (!page) {
      errors.push(new Error(
        `Zone ${p.zone_key} → slug ${p.page_slug} : page introuvable en DB`
      ));
      continue;
    }

    if (page.status !== 'published') {
      errors.push(new Error(
        `Zone ${p.zone_key} → ${p.page_slug} : status='${page.status}' (attendu 'published')`
      ));
    }
  }

  if (errors.length > 0) {
    console.error('❌ Anomalies détectées :');
    errors.forEach((e) => console.error(`  - ${e.message}`));
    if (process.argv.includes('--strict')) {
      process.exit(1);
    }
  } else {
    console.log('✅ Tous les liens légaux sont OK');
  }
}

main().catch(console.error);
```

Intégration CI :
```yaml
- name: Check legal links
  run: pnpm tsx scripts/check-legal-links.ts --strict
```

## Niveau 2 — Cron HTTP ping (runtime)

Job background toutes les 30 min via `instrumentation.ts` Next.js OR un
cron job systemd OR Vercel cron.

```typescript
// lib/legal/link-checker.ts
export async function checkAllLinks(): Promise<LinkHealthReport> {
  const placements = await db.legalPagePlacements.find({ is_visible: true });
  const results: LinkCheckResult[] = [];

  for (const p of placements) {
    const result = await checkOneLink(p.zone_key, p.page_slug);
    results.push(result);

    // Snapshot en DB
    await db.legalLinkHealthSnapshot.insert({
      id: createId('llhs'),
      checked_at: new Date(),
      zone_key: p.zone_key,
      page_slug: p.page_slug,
      status: result.status,
      http_code: result.httpCode,
      latency_ms: result.latencyMs,
      notes: result.notes,
    });
  }

  return summarizeResults(results);
}

async function checkOneLink(
  zoneKey: string,
  slug: string,
): Promise<LinkCheckResult> {
  // 1. Verify DB
  const page = await db.legalPages.findBySlug(slug);
  if (!page) {
    return { status: 'page_missing', httpCode: null, latencyMs: null,
             notes: `Slug ${slug} not in DB` };
  }
  if (page.status !== 'published') {
    return { status: 'page_draft', httpCode: null, latencyMs: null,
             notes: `Status: ${page.status}` };
  }

  // 2. Ping HTTP route
  const start = Date.now();
  try {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL}/${slug}`;
    const res = await fetch(url, {
      method: 'HEAD',  // less bandwidth
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;

    if (res.status === 200) {
      return { status: 'ok', httpCode: 200, latencyMs, notes: null };
    }
    if (res.status >= 400 && res.status < 500) {
      return { status: 'http_4xx', httpCode: res.status, latencyMs, notes: null };
    }
    if (res.status >= 500) {
      return { status: 'http_5xx', httpCode: res.status, latencyMs, notes: null };
    }
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { status: 'timeout', httpCode: null, latencyMs: 5000, notes: 'HTTP timeout' };
    }
    return { status: 'http_5xx', httpCode: null, latencyMs: Date.now() - start, notes: err.message };
  }

  return { status: 'ok', httpCode: 200, latencyMs: Date.now() - start, notes: null };
}
```

### Schedule

Option A — Vercel cron :
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/admin/legal/health/run",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

Option B — systemd timer (self-hosted) :
```ini
# /etc/systemd/system/femiglow-legal-health.timer
[Timer]
OnCalendar=*:0/30
```

Option C — Next.js instrumentation (dev/test) :
```typescript
// instrumentation.ts
let interval: NodeJS.Timer | null = null;
export async function register() {
  if (process.env.NODE_ENV === 'production' && !interval) {
    interval = setInterval(async () => {
      try { await checkAllLinks(); } catch {}
    }, 30 * 60 * 1000);
  }
}
```

## Niveau 3 — Alerting

Si > 1 lien KO sur la même run :
```typescript
const broken = results.filter((r) => r.status !== 'ok');
if (broken.length > 0) {
  await sendEmail({
    to: 'admin@femiglow-maroc.com',
    subject: `⚠ ${broken.length} liens légaux cassés`,
    body: broken.map((b) => `${b.zone_key}/${b.page_slug}: ${b.status}`).join('\n'),
  });
}
```

## Niveau 4 — Dashboard

Route `/admin/legal/health` lit `legal_link_health_snapshot` :

```
╔══════════════════════════════════════════════════════════════════════╗
║  Santé des liens légaux              Dernière vérif : il y a 12 min   ║
║                                                                       ║
║  ┌─ Statut global ──────────────────────────────────────────────────┐║
║  │ ✅ 27 OK     ⚠ 1 warning     ❌ 0 broken     [↻ Re-vérifier]    │║
║  └─────────────────────────────────────────────────────────────────┘║
║                                                                       ║
║  Par zone                                                             ║
║  ┌─────────────────────────────────────────────────────────────────┐║
║  │ Zone                  Total   OK   Anomalies                     │║
║  ├─────────────────────────────────────────────────────────────────┤║
║  │ footer-main             9     9    —                              │║
║  │ footer-bottom-bar       2     2    —                              │║
║  │ cookie-banner-links     2     2    —                              │║
║  │ checkout-consent        3     3    —                              │║
║  │ signup-consent          1     0    ⚠ Page draft (confidentialité) │║
║  │ mobile-menu             1     1    —                              │║
║  │ chat-disclaimer         1     1    —                              │║
║  └─────────────────────────────────────────────────────────────────┘║
║                                                                       ║
║  Anomalies récentes                                                   ║
║  ┌─────────────────────────────────────────────────────────────────┐║
║  │ Zone          Page            Statut             Heure          │║
║  ├─────────────────────────────────────────────────────────────────┤║
║  │ signup-consent confidentialité ⚠ page_draft      12 min        │║
║  └─────────────────────────────────────────────────────────────────┘║
║                                                                       ║
╚══════════════════════════════════════════════════════════════════════╝
```

## Cleanup historique

```sql
-- Cron weekly : nettoie les snapshots > 30 jours
DELETE FROM legal_link_health_snapshot
WHERE checked_at < NOW() - INTERVAL '30 days';
```

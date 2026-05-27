# Alertes

## 1. Sentry rules

### Rule L1 — Erreur SSR `/legal/*`

```yaml
trigger: error
filter:
  url: '*/legal/*'
action: slack #admin-errors
severity: high
```

**Action si déclenchée** :
1. Lire stack trace
2. Si lié à var manquante → vérifier migration appliquée
3. Si lié à parse markdown → rollback page via history

### Rule L2 — Erreur endpoint legal

```yaml
trigger: event_name
filter:
  event: 'legal.vars.create.failed' OR
         'legal.cleanup.e2e.failed' OR
         'legal.publish.failed'
threshold: > 3 in 1h
action: slack #admin-errors
severity: medium
```

### Rule L3 — Publish bloqué massif

```yaml
trigger: custom_metric
metric: legal_publish_blocked_count
threshold: > 5 in 24h
action: slack #admin-errors
severity: medium
```

**Hypothèses** : drift réapparu, vars supprimées par erreur, schema corrompu.

### Rule L4 — Drift detected

```yaml
trigger: custom_metric (via cron audit)
metric: legal_drift_count
threshold: > 0
action: slack #data-quality
severity: low
```

**Cron weekly** : exécute query §3 audit et publish metric.

## 2. Custom metrics

### Métrique M1 — Drift count

```sql
WITH used AS (
  SELECT DISTINCT regexp_matches(body_md, '\{\{([A-Z][A-Z0-9_]*)\}\}', 'g') AS m
  FROM legal_pages WHERE slug NOT LIKE 'e2e%'
)
SELECT COUNT(*) FROM used
WHERE m[1] NOT IN ('LAST_UPDATED','CURRENT_YEAR','SITE_URL','VERSION')
  AND NOT EXISTS (SELECT 1 FROM legal_template_vars WHERE key = m[1]);
```

**Cible** : 0
**Alerte** : > 0

### Métrique M2 — E2E orphans count

```sql
SELECT COUNT(*) FROM legal_pages WHERE slug LIKE 'e2e-test-%';
```

**Cible** : < 5
**Alerte** : > 10

### Métrique M3 — Pages exposant vars sensibles

```sql
SELECT COUNT(*) FROM legal_pages
WHERE status = 'published'
  AND (body_md LIKE '%{{ICE}}%' OR body_md LIKE '%{{COMPANY_RC}}%');
```

**Cible** : 0 (post-refonte)
**Alerte** : > 0 — signifie que quelqu'un a réintroduit ces vars

### Métrique M4 — Marketing pages : prénom détecté

```bash
# CI test (invariant) — fail si trouvé
grep -ri "souheila\|souheïla" apps/web/src/app/\(marketing\)/ 2>&1 | wc -l
```

**Cible** : 0
**Alerte** : > 0 — régression d'anonymisation

## 3. Plausible event-based alerts

### P1 — 0 events admin_legal_view sur 7d

```yaml
trigger: no events
filter: admin_legal_view
period: 7 days
action: email Lead
severity: low
```

**Hypothèse** : admin n'utilise plus la page (peut indiquer bug UX).

### P2 — Volume publish anormal

```yaml
trigger: event rate
filter: admin_legal_publish
threshold: > 10 / day
action: slack #admin-events
```

**Hypothèse** : republish massif involontaire.

## 4. Email `legal@femiglow-maroc.com` monitoring

### Configuration

- Forward : vers Lead + Care
- Auto-reply : "Votre demande a été reçue. Nous répondons sous 5 jours ouvrés."
- Tag automatique : "LEGAL-DEMANDE" pour filtrage

### Alertes

- Email sans réponse > 4j ouvrés → notification Lead (avant SLA dépassé)
- > 10 emails / jour → alerte (volume anormal, possible spam)

### Tracking

Spreadsheet ou Notion DB avec colonnes :
- Date reçue
- Demandeur (email)
- Objet
- Date réponse
- Délai (jours ouvrés)

Audit mensuel : % réponses sous 5j ouvrés (cible 100%).

## 5. Configuration Sentry

### Via dashboard

1. Sentry → Project femiglow-prod → Alerts → Create Alert Rule
2. Type : "Issue Alert"
3. Conditions :
   - When a new issue is created
   - Filters : url contains '/legal/' OR event.type = 'error' AND tag.release = 'legal-v2'
4. Actions :
   - Send Slack to #admin-errors
   - Send email to lead@

### Tag releases

Dans `apps/web/sentry.client.config.ts` (si existe) :

```ts
Sentry.init({
  release: 'legal-v2',
  // ...
});
```

## 6. Cron de monitoring

`/api/cron/legal/audit-monitoring` (à créer) :

```ts
export async function GET() {
  const driftCount = await getDriftCount();  // query M1
  const e2eOrphans = await getE2EOrphans();  // query M2
  const sensitiveLeaks = await getSensitiveLeaks();  // query M3

  // Push to Plausible / Datadog / Vercel metrics
  await plausibleEvent('legal_health_check', {
    props: { drift_count: driftCount, e2e_orphans: e2eOrphans, leaks: sensitiveLeaks },
  });

  // Alert si valeurs > seuils
  if (driftCount > 0) {
    await sentryAlert('legal.drift.detected', { driftCount });
  }
  if (sensitiveLeaks > 0) {
    await sentryAlert('legal.sensitive.leak', { sensitiveLeaks });
  }

  return Response.json({ driftCount, e2eOrphans, sensitiveLeaks });
}
```

`vercel.json` :

```json
{
  "crons": [
    { "path": "/api/cron/legal/audit-monitoring", "schedule": "0 6 * * *" }
  ]
}
```

(Daily à 6h du matin.)

## 7. Documentation pour Care team

Ajouter dans `docs/runbooks/legal-alerts.md` (à créer) :

```markdown
## Que faire si alerte LEGAL-V2 ?

### Sentry "Erreur SSR /legal/*"
1. Vérifier sentry.io pour le stack trace
2. Si message contient "missing var" → vérifier migration 0075
3. Sinon → notifier Dev, créer ticket

### Drift count > 0
1. Run audit SQL §3
2. Identifier la var non définie
3. Décider : créer la var via admin OU corriger le template

### Email legal@ sans réponse > 4j
1. Vérifier inbox Lead
2. Répondre dans la journée
3. Mettre à jour spreadsheet tracking
```

## 8. Désactivation des alertes (post J+30)

Si après 30j d'observation stable, possible de :
- Garder L1, L3, L4 (critical paths)
- Désactiver L2 (rare et low-impact)
- Maintenir cron monitoring quotidien

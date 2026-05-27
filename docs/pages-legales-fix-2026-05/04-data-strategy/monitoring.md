# Monitoring post-deploy

## 1. KPIs primaires

| KPI | Cible | Mesure | Alerte si |
|---|---|---|---|
| Pages drafts bloquées (missing_vars) | 0 | `SELECT COUNT(*) WHERE status='draft' AND drift > 0` | > 0 |
| Pages E2E orphelines | 0 (post-cleanup) | `SELECT COUNT(*) WHERE slug LIKE 'e2e-test-%'` | > 5 |
| Drift vars utilisées sans DB | 0 | query §3 audit-queries.md | > 0 |
| Pages exposant ICE/RC en clair | 0 (post-refonte) | query §3 audit-queries.md | > 0 |
| Email `legal@femiglow-maroc.com` retard réponse | < 5j ouvrés | manuel | > 5j |
| Erreur SSR `/legal/*` | 0 | Sentry | > 0 |

## 2. Sentry alert rules

### Rule L1 — Erreur SSR /legal/*

```yaml
trigger: error
filter:
  url: '*/legal/*'
action: slack #admin-errors
severity: high
```

### Rule L2 — Endpoint legal failure

```yaml
trigger: event_name
filter:
  event: 'legal.vars.create.failed' OR 'legal.cleanup.e2e.failed'
action: slack #admin-events
```

### Rule L3 — Publish bloqué massif

```yaml
trigger: custom_metric
metric: legal_publish_blocked_count
threshold: > 3 in 1h
action: slack #admin-errors
```

## 3. Plausible custom events

```ts
// /admin/legal visit
plausible('admin_legal_view', {
  props: { pages_total: stats.total, drafts: stats.drafts }
});

// Var create
plausible('admin_legal_var_create', {
  props: { key }
});

// Cleanup executed
plausible('admin_legal_cleanup_executed', {
  props: { deleted: result.deleted }
});

// Publish success/fail
plausible('admin_legal_publish', {
  props: { slug, status: 'success' | 'missing_vars' }
});
```

## 4. Dashboard `/admin/legal/audit` (optionnel)

Vue temps-réel des stats DB :

```
┌───────────────────────────────────────────────────────────┐
│  Audit pages légales                                       │
│  ─────────────────────────────────────────────────────── │
│                                                             │
│  📊 État général                                            │
│  • 9 pages métier  (6 publiées + 3 drafts)                 │
│  • 0 pages E2E orphelines ✅                                │
│  • 24 vars définies                                         │
│  • 0 drift detected ✅                                      │
│                                                             │
│  🔴 Drafts bloqués (0)                                      │
│  • Aucun                                                    │
│                                                             │
│  🟡 Vars requises vides (X)                                 │
│  • DELIVERY_PARTNER                                         │
│  • COMPANY_FORM                                             │
│                                                             │
│  📧 Demandes "legal@" en attente                            │
│  • 2 demandes < 24h                                         │
│  • 0 demandes > 5j (SLA dépassé)                            │
│                                                             │
│  [Cleanup E2E] [Audit pollution] [Republish all]           │
└───────────────────────────────────────────────────────────┘
```

## 5. Cron weekly cleanup

`/api/cron/legal/cleanup-e2e` (à créer) :

```ts
export async function GET() {
  const result = await cleanupLegalE2E({ dryRun: false, olderThanDays: 7 });
  await logger.info('cron.legal.cleanup_e2e', { result });
  return Response.json(result);
}
```

`vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/legal/cleanup-e2e",
      "schedule": "0 3 * * 1"
    }
  ]
}
```

(Exécuté chaque lundi à 3h du matin.)

## 6. Checklist 48h post-deploy

### J+1

- [ ] Sentry : 0 erreur SSR `/legal/*`
- [ ] Sentry : 0 erreur `legal.vars.*`
- [ ] Pages publiées accessibles : `/legal/mentions-legales`, `/legal/cgv`, etc.
- [ ] Smoke staging : grep ICE / RC sur HTML publics → 0
- [ ] Fondatrice valide visite `/admin/legal/template-vars` : peut créer une var
- [ ] Fondatrice valide publish d'une page draft : succès

### J+2

- [ ] KPIs stables : conversion rate, page views légales
- [ ] Aucune régression sur les 6 pages déjà publiées
- [ ] Email `legal@femiglow-maroc.com` setup et reçoit
- [ ] Décision : maintenir flag ON ou rollback

## 7. Rollback si problème observé

Cf. [`06-plan-action/rollback.md`](../06-plan-action/rollback.md) :

- N1 : flag off → comportement legacy
- N2 : revert migration SQL (avec backup)
- N3 : restore pages depuis history

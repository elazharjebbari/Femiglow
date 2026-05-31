# Monitoring post-deploy

> Métriques à observer pendant 48h après le ship pour confirmer le fix.

## 1. KPIs à tracker

### 1.1 KPIs primaires (santé du fix)

| KPI | Cible | Mesure | Alerte si |
|---|---|---|---|
| Sessions visibles `/admin/chat/conversations` | Stable ou en baisse | SQL count | drop > 50% en 24h (suggère filtre trop strict) |
| Leads visibles `/admin/chat/leads` | Stable ou en baisse | SQL count | drop > 50% en 24h |
| Nouveaux ghosts wizard / heure | <50 | Logs `chat.session.create` kind=wizard_pivot | > 100/h (suggère bot abuse) |
| Cohérence kind ↔ source | 100% | SQL audit query mensuel | < 99% (incohérence) |
| Erreur 500 sur `/admin/chat/*` | 0 | Sentry events | > 0 |
| Latency p95 `/admin/chat/conversations` SSR | <500ms | Vercel analytics | > 1s |

### 1.2 KPIs secondaires (santé business)

| KPI | Cible | Mesure |
|---|---|---|
| Conversion rate chat | Stable ou ↑ vs pré-fix | `pure_chat_conversions / chat_sessions_with_msg` |
| Leads pending SLA | Stable | `chat_lead WHERE outcome=pending AND trigger=hot AND age > 4h` |
| Care actionability | ↑ vs pré-fix | Sondage manuel : "% leads /admin/chat à rappeler" |

## 2. Sources de données

### 2.1 Sentry

Configurer une nouvelle release tag `chat-leads-v2` et tracker les erreurs liées :

```ts
// apps/web/src/lib/sentry.ts (suggestion)
Sentry.init({
  release: 'chat-leads-v2',
  beforeSend(event) {
    // Tag les erreurs touchant chat_session.kind
    if (event.message?.includes('kind') || event.exception?.values?.[0]?.value?.includes('kind')) {
      event.tags = { ...event.tags, sprint: 'CHA-LEAD-V2' };
    }
    return event;
  },
});
```

### 2.2 Plausible (events)

Émettre des events custom pour tracker l'usage admin :

```ts
// Quand admin visite /admin/chat/conversations
window.plausible?.('admin_chat_conversations_view', {
  props: {
    debug_mode: searchParams.debug === 'ghosts',
    row_count: rows.length,
  },
});

// Quand admin clique cleanup
window.plausible?.('admin_chat_cleanup_executed', {
  props: { archived: result.archived },
});
```

### 2.3 Logs structurés (Vercel logs)

Filtrer les logs avec ces tags :

```
event: "chat.session.create"
  kind: "chat" | "wizard_pivot"
  
event: "chat.admin.cleanup_ghosts"
  candidates: N
  archived: N
  dryRun: boolean
```

Configuration grep :

```bash
vercel logs --follow | grep -E "chat\.(session\.create|admin\.cleanup)"
```

## 3. Dashboard `/admin/chat/audit`

Ajouter une carte "Santé pollution" qui affiche les counts en temps réel.

**Wireframe** :

```
┌─────────────────────────────────────────────────────────────────┐
│ Santé pollution chat                       Snapshot: il y a 5 min│
│                                                                  │
│  Sessions par kind         Leads par source                     │
│  ┌──────────────────┐     ┌─────────────────────┐              │
│  │ chat          124│     │ chat_widget     45  │              │
│  │ wizard_pivot   38│     │ inline           7  │              │
│  │ system          0│     │ wizard_kit      26  │              │
│  └──────────────────┘     │ wizard_commander 4  │              │
│                            │ newsletter       0  │              │
│                            │ admin            1  │              │
│                            └─────────────────────┘              │
│                                                                  │
│  Pollution rate         12% (wizard_pivot / total) ✅ OK         │
│  Vrais leads chat       52 / 83 (62%) ✅ OK                     │
│  Ghosts orphelins > 30j  3                                       │
│                                                                  │
│  [Cleanup ghosts orphelins] (3 candidates)                      │
└─────────────────────────────────────────────────────────────────┘
```

## 4. Alertes automatiques

### 4.1 Sentry alert rules

Créer 3 règles :

**Règle A : Erreur SSR /admin/chat/***

```yaml
trigger: error
filter:
  url: '*/admin/chat/*'
action: notify_slack
channel: '#admin-errors'
```

**Règle B : Cleanup endpoint erreur**

```yaml
trigger: error
filter:
  event_name: 'chat.admin.cleanup_ghosts.failed'
action: notify_slack
channel: '#admin-errors'
```

**Règle C : Pollution massive (>1000 ghosts en 24h)**

```yaml
trigger: custom_metric
metric: chat_pollution_count
threshold: > 1000
window: 24h
action: notify_lead
```

### 4.2 Plausible custom dashboards

Créer un dashboard "Chat Admin Health" :
- Bar chart : sessions par kind sur 30 derniers jours
- Pie chart : leads par source
- Line chart : pollution_rate (wizard_pivot / total) sur 7 jours

## 5. Métriques d'observabilité

### 5.1 Volume

```sql
-- Sessions créées par jour, par kind
SELECT
  DATE_TRUNC('day', opened_at) AS day,
  kind,
  COUNT(*) AS n
FROM chat_session
WHERE opened_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

### 5.2 Tendance pollution

```sql
-- Pollution rate hebdomadaire
SELECT
  DATE_TRUNC('week', opened_at) AS week,
  COUNT(*) FILTER (WHERE kind = 'wizard_pivot') AS wizard,
  COUNT(*) FILTER (WHERE kind = 'chat') AS chat,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE kind = 'wizard_pivot') /
    NULLIF(COUNT(*), 0),
    1
  ) AS pollution_pct
FROM chat_session
WHERE opened_at >= NOW() - INTERVAL '12 weeks'
GROUP BY 1
ORDER BY 1 DESC;
```

### 5.3 Cleanup history

```sql
-- Combien de cleanup ont eu lieu ?
-- (À tracker via une table `chat_admin_audit_log` si on l'ajoute)
SELECT
  date_trunc('week', occurred_at) AS week,
  COUNT(*) AS cleanup_count,
  SUM(metadata->>'archived')::int AS total_archived
FROM chat_admin_audit_log
WHERE event = 'cleanup_ghosts'
GROUP BY 1
ORDER BY 1 DESC;
```

> **Note** : la table `chat_admin_audit_log` n'existe pas encore. Pour ce sprint, on se contente des logs Sentry. À ajouter plus tard si besoin de traçabilité longue.

## 6. Checklist post-deploy 48h

### J+1 (24h après ship)

- [ ] Sentry : 0 erreur sur `/admin/chat/*`
- [ ] Vercel logs : confirmer `kind` présent dans tous les logs `chat.session.create`
- [ ] SQL : exécuter audit query §2 — distribution kind cohérente
- [ ] Plausible : event `admin_chat_conversations_view` reçu plusieurs fois
- [ ] Admin manuel : visite `/admin/chat/conversations` → liste propre (< 30 rows attendues)
- [ ] Admin manuel : visite `/admin/chat/leads` → 0 lead "wizard_kit" visible
- [ ] Admin manuel : visite `/admin/leads` → tous les leads présents (chat + wizard)

### J+2 (48h après ship)

- [ ] Trend pollution : pas d'accélération anormale
- [ ] KPIs business : conversion rate stable ou ↑
- [ ] Care manual sondage : "Les leads sont-ils plus pertinents ?" — réponse positive
- [ ] Décision : passer feature flag en default `true` (retirer le toggle) ou maintenir

## 7. Rollback monitoring

Si on doit rollback (CHAT_ADMIN_FILTERS_V2=false) :

- [ ] Logger l'action dans Sentry : `Sentry.captureMessage('CHAT_ADMIN_FILTERS_V2 rollback')`
- [ ] Notifier Slack `#admin-events`
- [ ] Documenter raison dans `docs/chat-conversations-leads-fix-2026-05/07-runbook/rollback.md`
- [ ] Re-tester `/admin/chat/conversations` → liste polluée à nouveau (confirme rollback)
- [ ] Planifier RCA (Root Cause Analysis) sur cause du rollback

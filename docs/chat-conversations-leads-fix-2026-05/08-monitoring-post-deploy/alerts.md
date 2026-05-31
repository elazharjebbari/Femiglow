# Règles d'alertes

## 1. Sentry alert rules

### Rule A1 — Erreur SSR `/admin/chat/*`

**Trigger** :
- Event type : `error`
- URL : `*/admin/chat/*`

**Action** : Slack notify `#admin-errors`

**Sévérité** : 🔴 High (l'admin peut être paralysé)

**Action si déclenchée** :
1. Lire le stack trace dans Sentry
2. Si lié à `kind` ou query SQL : possible rollback flag (cf. `06-plan-action/rollback.md` §2)
3. Sinon : créer Linear ticket

### Rule A2 — Erreur cleanup endpoint

**Trigger** :
- Event name : `chat.admin.cleanup_ghosts.failed`
- Frequency : > 1 in 1h

**Action** : Slack notify `#admin-errors`

**Sévérité** : 🟡 Medium (non-critique mais à investiguer)

**Action si déclenchée** :
1. Vérifier les logs Vercel pour le user qui a déclenché
2. Vérifier la DB (race condition ? FK manquante ?)
3. Désactiver le bouton cleanup en UI si répété

### Rule A3 — Erreur INSERT chat_session

**Trigger** :
- Message regex : `insert.*chat_session.*failed`
- Frequency : > 5 in 5min

**Action** : Slack notify `#critical`

**Sévérité** : 🔴 Critical (le chat ou le wizard cassent)

**Action si déclenchée** :
1. Rollback immédiat (flag off + revert si besoin)
2. Vérifier que la migration `chat_session.kind` a bien été appliquée
3. Si contrainte CHECK pose souci : DROP CONSTRAINT temporaire

### Rule A4 — Drizzle enum invalid

**Trigger** :
- Message regex : `kind.*invalid|kind.*not in enum`
- Frequency : any

**Action** : Slack notify `#admin-errors`

**Sévérité** : 🟠 High (cohérence DB compromise)

**Action si déclenchée** :
1. Identifier la valeur invalide qui a tenté l'INSERT
2. Vérifier que les enums Drizzle TS et DB CHECK constraint sont alignés
3. Si bug code : revert le commit responsable

## 2. Custom metric alerts (Vercel/CloudWatch équivalent)

### Métrique M1 — Pollution rate > 50%

**Définition** : `wizard_pivot / total chat_session opened in last 24h`

**Trigger** : > 50% pendant 24h consécutifs

**Action** : Slack `#data-quality`

**Sévérité** : 🟡 Medium (anomalie pattern)

**Hypothèses** :
- Bot abuse du wizard (création massive de ghosts)
- Bug widget chat qui ne crée plus les vraies sessions
- Trafic exceptionnel sur /kit

**Action si déclenchée** :
1. Audit logs `chat.session.create` pour détecter pattern
2. Si bot : ajouter rate limit `/api/checkout/lead`
3. Si bug widget : investigate `sessionService.getOrCreate()`

### Métrique M2 — Volume admin chat queries

**Définition** : Count of SSR requests to `/admin/chat/*` per hour

**Trigger** : Drop > 50% vs week average

**Action** : Slack `#admin-events`

**Sévérité** : 🟢 Low (informatif)

**Hypothèses** :
- Admin en vacances / weekend
- Fix annoncé bug d'UX → admin évite

## 3. Plausible alerts (events)

### Event-based alert P1

**Trigger** : Aucun event `admin_chat_conversations_view` sur 24h consécutifs

**Action** : Email Lead

**Sévérité** : 🟢 Low (peut être normal)

**Hypothèse** : Admin ne consulte plus la page (peut indiquer un problème de perception ou une régression observée)

### Event-based alert P2

**Trigger** : Event `admin_chat_cleanup_executed` avec `archived > 1000`

**Action** : Slack `#admin-events`

**Sévérité** : 🟡 Medium (cleanup massif)

**Action** : vérifier que c'est intentionnel, sinon audit

## 4. DB-level alerts (Neon ou pg_stat_*)

### Alert D1 — Index unused

**Trigger** : Index `chat_session_kind_status_idx` non utilisé pendant 7j

**Source** : `pg_stat_user_indexes`

**Action** : Slack `#data-quality`

**Sévérité** : 🟢 Low (optimisation post-mortem)

**Action si déclenchée** : revoir queries — soit l'index est mal défini, soit les queries ne l'utilisent pas comme prévu.

### Alert D2 — Migration drift

**Trigger** : `pnpm drizzle-kit check` retourne mismatch

**Source** : CI cron daily

**Action** : Slack `#deploys`

**Sévérité** : 🟡 Medium

**Action** : revoir si quelqu'un a modifié le schéma sans migration.

## 5. Configuration Sentry

### Étapes

1. Aller sur Sentry → Project femiglow-prod → Alerts → Create Alert Rule
2. Type : "Issue Alert"
3. Conditions : choisir trigger (filter par tag/URL/message)
4. Filters : add filter "event.type", "url", etc.
5. Actions : "Send a notification to Slack" → choisir channel
6. Frequency : "When an issue is first seen" ou "When an issue changes state to..."

### Templates suggérés

**Pour Rule A1** :
```
Name: SSR error on /admin/chat/*
Conditions: A new issue is created
Filters:
  - event.type equals error
  - url contains "/admin/chat/"
Actions:
  - Send Slack notification to #admin-errors
  - Send email to lead@femiglow.local
```

## 6. Test des alertes

Une fois configurées, déclencher manuellement pour validation :

```bash
# Trigger Rule A1 (faux 500 sur /admin/chat)
curl https://femiglow-maroc.com/admin/chat/conversations?broken=true
# Doit déclencher une alerte Sentry

# Trigger Rule A2 (cleanup avec olderThanDays trop bas)
curl -X POST -H "cookie: $admin" \
  -d '{"dryRun":true,"olderThanDays":0}' \
  https://femiglow-maroc.com/api/admin/chat/cleanup-ghosts
# Renvoie 400, devrait aussi être loggé
```

## 7. Documentation des alertes pour Care

Ajouter dans `docs/runbooks/chat-alerts.md` (à créer si absent) :

```markdown
## Que faire si alerte CHA-LEAD-V2 ?

### Sentry "SSR error on /admin/chat/*"
1. Vérifier sentry.io pour le stack trace
2. Si message contient "kind" → voir 06-plan-action/rollback.md §2
3. Sinon → notifier Dev, créer ticket
```

## 8. Dashboard alertes summary

Créer une page interne (Notion/Linear/wiki) avec :

| Rule | Severity | Last triggered | Action taken |
|---|---|---|---|
| A1 | High | 2026-05-26 | Investigated, fixed |
| A2 | Medium | - | - |
| A3 | Critical | - | - |
| ... | | | |

Mise à jour mensuelle par Lead.

## 9. Désactivation des alertes (post-shipping J+30)

Si après 30j d'observation tout est stable, possible de :
- Garder A1, A3 (critical paths)
- Désactiver A2, A4 (non-critique, on regardera les logs si besoin)
- Garder M1 (pollution rate trend)

Décision : Lead.

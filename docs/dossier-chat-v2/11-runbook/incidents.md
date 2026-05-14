# Incidents — Playbooks par type

> Un playbook = une procédure d'action pour un type d'incident précis. Pas de prose, pas de jargon, **action-oriented**. Quand l'incident arrive, on ouvre la bonne section et on suit les étapes.

## Classification sévérité

| Sévérité | Définition | Réponse cible |
|---|---|---|
| **P0** | Service indisponible. Chat down complet ou data corrompue. | < 15 min |
| **P1** | Feature majeure cassée. Streaming ne fonctionne pas. | < 1h |
| **P2** | UX dégradée. Bug visible mais workaround existant. | < 4h |
| **P3** | Cosmétique ou edge case. | Sprint courant |

## Détection — Sources d'alertes

- **Sentry** → Slack `#chat-launch` (P0/P1).
- **Budget watch cron** → Slack `#chat-launch` (alerts 80%/100%).
- **Frustration alert** → Slack `#chat-care`.
- **Care signaling** → Slack `#chat-launch` (manuel par Karim si bug user signalé).
- **Status page externe** (UptimeRobot) → Slack `#chat-launch` (downtime > 2 min).
- **Manual report** → mention `@dev_lead` dans `#chat-launch`.

---

## PLAYBOOK 1 — Chat down complet (P0)

### Symptômes
- 0 messages servis en 5 min
- Sentry alert "500 rate > 50%"
- Care signaling "personne ne peut chater"

### Étape 1 — Confirmer (1 min)

```bash
# Health endpoint
curl -s https://femiglow.com/api/chat/health
# Si timeout ou 5xx → confirmé

# Premier message test
curl -X POST https://femiglow.com/api/chat/session \
  -H 'Content-Type: application/json' \
  -d '{"audience":"b2c","language":"fr"}'
# Si 500 → confirmé
```

### Étape 2 — Identifier la cause (5 min max)

```bash
# Logs récents Vercel
vercel logs --since 10m --filter "ERROR" | head -50

# Sentry dernières erreurs
# Ouvrir https://sentry.io/organizations/femiglow/projects/chat-v2/
# Tag chat.area pour scope
```

**Causes probables** :
- A. Provider LLM massivement down → voir Playbook 4.
- B. DB connexion dead → voir Playbook 3.
- C. Deploy récent buggué → voir rollback.md Type A.
- D. Quota Vercel dépassé → contact ops Vercel.

### Étape 3 — Mitiger immédiatement

| Cause | Action |
|---|---|
| A. Provider | Service level switch manuel : `vercel env add SERVICE_LEVEL_MANUAL=4` puis `vercel --prod` |
| B. DB | Vérifier `DATABASE_URL` accessible. Restart connection pool. |
| C. Deploy | `rollback.md` Type A immédiat. |
| D. Quota | Contact ops Vercel, upgrade plan si nécessaire. |

### Étape 4 — Communication

```
Slack #chat-launch :
🔴 INCIDENT P0 — Chat down (HH:MM CET)
Cause probable : [...]
Mitigation : [...]
ETA résolution : [...]
Suivez ce thread.
```

```
Slack #chat-care (à Karim) :
"Karim, P0 en cours. Si users signalent, dis : 'Notre chat est temporairement indisponible, ça revient sous peu, merci de votre patience.' Pas plus."
```

### Étape 5 — Post-mortem

Voir template `escalation.md` section post-mortem. Délai : 48h.

---

## PLAYBOOK 2 — Streaming SSE casse mid-message (P1)

### Symptômes
- Message démarre, puis stop après quelques tokens
- Sentry alert "SSE stream aborted"
- Care signaling "le bot s'arrête de répondre"

### Étape 1 — Confirmer (1 min)

```bash
# Tester message LLM long
SESSION=$(curl -s -X POST https://femiglow.com/api/chat/session \
  -H 'Content-Type: application/json' -d '{"audience":"b2c","language":"fr"}')
SESSION_ID=$(echo $SESSION | jq -r '.sessionId')

curl -N -X POST https://femiglow.com/api/chat/message \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION_ID\",\"text\":\"Raconte-moi tout sur le pack FemiGlow en détail\"}"
# Compter les `delta` events reçus
```

### Étape 2 — Identifier cause

**Causes probables** :
- A. Edge function timeout Vercel (60s plan hobby, 300s plan pro).
- B. Provider lui-même coupe le stream (rate limit hit mid-stream).
- C. Network instability côté provider.
- D. Bug serialization SSE (event mal formé).

### Étape 3 — Mitiger

| Cause | Action |
|---|---|
| A. Timeout | Vérifier plan Vercel + augmenter `maxDuration` dans route handler |
| B. Rate limit | Switch provider via routing (cooldown manuel) |
| C. Network | Attendre, monitorer. Pas d'action immédiate. |
| D. Bug | Hot fix si on identifie la PR coupable, sinon rollback |

### Étape 4 — Communication

```
Slack #chat-launch :
⚠️ INCIDENT P1 — SSE streaming interrupted (HH:MM)
Cause : [...]
Mitigation : [...]
```

---

## PLAYBOOK 3 — DB connection saturée (P1)

### Symptômes
- Sentry "Connection pool exhausted"
- Latence soudaine > 3s p50
- Healthcheck DB fail

### Étape 1 — Confirmer

```bash
psql $DATABASE_URL_PROD -c "
  SELECT count(*) FILTER (WHERE state='active') AS active,
         count(*) FILTER (WHERE state='idle') AS idle,
         count(*) AS total
  FROM pg_stat_activity
  WHERE datname='femiglow_prod';
"
# Si total > 80% max → confirmé
```

### Étape 2 — Identifier cause

```sql
-- Long-running queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '10 seconds'
ORDER BY duration DESC;
```

**Causes probables** :
- A. Une query slow tient les connexions (manque d'index).
- B. PgBouncer mal configuré.
- C. Spike traffic légitime → besoin scaling.

### Étape 3 — Mitiger

| Cause | Action |
|---|---|
| A. Slow query | Kill la query coupable : `SELECT pg_cancel_backend(pid)` puis EXPLAIN ANALYZE puis index |
| B. PgBouncer | Vérifier `pool_mode=transaction` + `max_client_conn` |
| C. Scale | Upgrade DB plan ou ajouter read replicas |

### Étape 4 — Vérifier post-mitigation

```bash
psql $DATABASE_URL_PROD -c "SELECT NOW() - pg_postmaster_start_time();"
```

---

## PLAYBOOK 4 — Provider LLM massivement down (P0/P1)

### Symptômes
- Sentry "OpenAI 5xx > 10%" ou similar
- Service level switch automatique vers 2 ou 3
- Care signaling "le bot répond pas comme avant"

### Étape 1 — Confirmer

```bash
# Vérifier status providers
curl -s https://femiglow.com/api/chat/health | jq '.providers'
# Si openai: "down" → confirmé

# Sentry filter
# chat.area:provider AND timestamp:>15m
```

### Étape 2 — Vérifier breaker actif

Le `lib/chat/services/orchestrator/breaker.ts` doit avoir basculé automatiquement après 3 fails. Si non, c'est un bug.

```bash
curl -s https://femiglow.com/api/chat/health | jq '.providers.openai.breakerStatus'
# Doit être "open" si 3+ fails récents
```

### Étape 3 — Décision service level

| Situation | Service level cible | Action |
|---|---|---|
| 1 provider down, 3+ healthy | 1 (NOMINAL) | Continue. Breaker fait son job. |
| 2 providers down | 2 (FAILOVER) | Continue. Anthropic + Mistral. |
| 3+ providers down | 3 (RAG ONLY) | Force manual : `SERVICE_LEVEL_MANUAL=3` |
| Tous down | 4 (CANNED ONLY) | Force manual : `SERVICE_LEVEL_MANUAL=4` |

### Étape 4 — Forcer manuellement si nécessaire

```bash
vercel env rm SERVICE_LEVEL_MANUAL production
echo "3" | vercel env add SERVICE_LEVEL_MANUAL production
vercel --prod
```

### Étape 5 — Communication

```
Slack #chat-launch :
⚠️ Provider OpenAI dégradé. Système opère en service level 2 (Anthropic + Mistral).
UX impacté : aucun (failover transparent).
ETA OpenAI : voir status.openai.com.
```

### Étape 6 — Restore quand provider revient

```bash
vercel env rm SERVICE_LEVEL_MANUAL production
vercel --prod
# Service level auto repart
```

---

## PLAYBOOK 5 — Budget LLM dépassé (P1)

### Symptômes
- Slack `#chat-launch` "Budget 100% reached"
- `cron-budget-watch` a automatiquement switché service level

### Étape 1 — Confirmer

```bash
# Audit cost dashboard
# https://platform.openai.com/usage
# https://console.anthropic.com/usage
```

### Étape 2 — Identifier cause

- Spike trafic légitime (campagne marketing ?)
- Bug qui appelle LLM en boucle ?
- Provider qui a changé pricing ?

```sql
SELECT date_trunc('day', created_at) AS day,
       COUNT(*) AS messages,
       SUM(llm_cost_usd) AS cost
FROM chat_messages
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;
```

### Étape 3 — Décision PO Selma + dev_lead

| Décision | Action |
|---|---|
| Augmenter budget | `LLM_BUDGET_USD_MONTHLY` update env Vercel + redeploy |
| Optimiser | Investigation bug + scope ticket |
| Rester degraded | Continue en service level 3 jusqu'à reset mensuel |

### Étape 4 — Communication

```
Slack #chat-launch :
📊 Budget LLM 100% atteint (date X).
Décision : [...]
Service level : 3 (RAG ONLY) jusqu'à [date Y].
```

---

## PLAYBOOK 6 — Lead spam/abuse (P2)

### Symptômes
- Care signal > 20 leads/h avec mêmes patterns
- Sentry "Lead rate limit hit"
- Tableau leads admin inondé

### Étape 1 — Confirmer

```sql
SELECT phone, COUNT(*) AS attempts, MIN(created_at), MAX(created_at)
FROM chat_leads
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY phone
HAVING COUNT(*) > 3
ORDER BY attempts DESC;
```

### Étape 2 — Mitiger

```bash
# Rate limit déjà configuré
# Vérifier qu'il est actif :
grep LEAD_RATE_LIMIT vercel.json

# Si attaque organisée → blocage IP côté Cloudflare (si présent)
# Si phone shared → flag manual dans admin
```

### Étape 3 — Communiquer Care

```
Slack #chat-care :
"Karim, spike de spam détecté.
- Rate limit actif (3 leads/phone/h).
- Tu peux ignorer les leads avec phones :
  +212600000000, +212600000001
- On surveille."
```

---

## PLAYBOOK 7 — Webhook n8n perdu (P2)

### Symptômes
- Sentry "Webhook 4xx/5xx persisté après 3 retries"
- Care n'a pas reçu les notifications

### Étape 1 — Vérifier état n8n

```bash
curl -X POST https://n8n.femiglow.com/webhook/health
# Doit retourner 200
```

### Étape 2 — Lister webhooks failed dernière heure

```sql
SELECT id, phone, intent, retry_count, last_attempt_at, last_error
FROM chat_leads
WHERE webhook_status = 'failed' AND created_at > NOW() - INTERVAL '1 hour';
```

### Étape 3 — Retry manuel

```bash
# Script utilitaire
npm run cron:webhook-retry -- --only-failed --since=1h
```

### Étape 4 — Communiquer Care

```
Slack #chat-care :
"Karim, X webhooks failed dernière heure. Retry en cours.
Liste : [...]"
```

---

## PLAYBOOK 8 — Intent detection accuracy drop (P2)

### Symptômes
- Dashboard N3.1 sous 80%
- Audit manuel hebdo signale beaucoup de misroutings
- Care signal "le bot ne comprend rien"

### Étape 1 — Confirmer

```sql
-- Top intents misroutings (manual audit logs)
SELECT detected_intent, actual_intent, COUNT(*)
FROM intent_audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY detected_intent, actual_intent
ORDER BY COUNT(*) DESC
LIMIT 20;
```

### Étape 2 — Causes probables

- A. Données récentes (nouveaux types de questions) non couvertes par regex/embeddings.
- B. Centroïdes pas recomputés depuis longtemps.
- C. Provider LLM mini classifier changé son comportement.

### Étape 3 — Mitiger

| Cause | Action |
|---|---|
| A. Coverage | Ajouter examples par intent dans admin (Yasmine). Recompute centroïdes. |
| B. Stale | `npm run cron:intent-recompute --once` |
| C. Provider | Switch LLM mini provider via config |

### Étape 4 — Suivre métrique

Dashboard Editorial, panel "Intent accuracy weekly trend". Doit remonter sous 7 jours.

---

## PLAYBOOK 9 — Frustration alerts spike (P2)

### Symptômes
- Slack `#chat-care` "Frustration alert" > 5/h
- Care team débordée

### Étape 1 — Audit conversations

```sql
SELECT s.id, m.text, m.created_at, m.frustration_score
FROM chat_messages m
JOIN chat_sessions s ON s.id = m.session_id
WHERE m.frustration_score > 0.7
  AND m.created_at > NOW() - INTERVAL '2 hours'
ORDER BY m.created_at DESC
LIMIT 20;
```

### Étape 2 — Identifier pattern commun

- Tous les users essaient quoi ?
- Quelle question ne trouve pas réponse ?
- C'est un canned mal calibré ?

### Étape 3 — Mitiger

- Patcher canned ou FAQ dans admin (Yasmine).
- Pousser suggestion default plus pertinente.
- Si bug, fix code.

---

## PLAYBOOK 10 — Postgres data corruption (P0)

### Symptômes
- Données incohérentes (ex. chat_messages sans session_id valide)
- Constraint violations soudaines

### Étape 1 — Confirmer

```sql
-- Check FK violations
SELECT COUNT(*) FROM chat_messages m
LEFT JOIN chat_sessions s ON s.id = m.session_id
WHERE s.id IS NULL;
```

### Étape 2 — Stop writes immédiat

```bash
# Mettre prod en read-only mode (feature flag)
echo "true" | vercel env add READ_ONLY_MODE production
vercel --prod
```

### Étape 3 — Audit + restore from backup

⚠️ **Procédure catastrophique**. Voir `rollback.md` Type C.3.c.

---

## Post-mortem obligatoire pour P0 / P1

Voir template dans `10-plan-action/escalation.md`.

Délai : 48h après résolution.

Publication : Notion + Slack `#chat-build` (équipe interne).

## Anti-patterns incidents

- ❌ Communiquer trop tard (silence > 10 min = panique externe).
- ❌ Communiquer trop souvent (toutes les 30s = bruit, on perd la confiance).
- ❌ Investigation longue avant communication initiale (acknowledge < 5 min).
- ❌ Pas de post-mortem car "c'était mineur" — on perd les leçons.
- ❌ Pointer une personne dans le post-mortem — c'est toujours un système.
- ❌ Rollback sans annonce — confusion équipe.

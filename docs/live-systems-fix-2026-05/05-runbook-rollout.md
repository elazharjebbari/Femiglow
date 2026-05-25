# 05 — Runbook rollout

## Pré-requis avant Phase F1

- [ ] Sprint 1 (quick wins) + Sprint 2 (structurel) mergés sur `master`
- [ ] CI verte sur les 3 systèmes
- [ ] PR review humaine OK
- [ ] Redis Upstash provisionné en prod (env vars Vercel)
- [ ] Baseline SQL archivé
- [ ] Git tag `live-systems-baseline-2026-05-24` créé

## Feature flags par système

```bash
# Sprint 1
LIVE_CHAT_MODERATION=on         # Modération OpenAI (QW2)

# Sprint 2 — bascule progressive
LIVE_REDIS_STATE=true           # Dédup + breaker via Redis (S1)
LIVE_CAPI_BATCHING=on           # Batching Meta CAPI (S2)
LIVE_PUBLISHING_DASHBOARD=on    # Nouveau dashboard (S5)

# Sprint 3
LIVE_CHAT_FALLBACK=anthropic    # Multi-provider chat (R1)
LIVE_STREAM_MONITORING=on       # Streaming health (R2)
LIVE_IDEMPOTENCY=on             # Idempotency keys (R3)
```

Chacun activable indépendamment → rollback granulaire.

---

## Procédure rollout — 4 paliers

### Palier 1 — Internal (0% trafic)

**Durée** : 2 h
**Activation** : preview deployment Vercel + flags `on` sur env preview
**Vérifs équipe** :
- [ ] Smoke tests passent (3 scripts)
- [ ] Chat dry run : envoyer message offensant → modération bloque
- [ ] Publishing dry run : créer post mode now + schedule + draft → tous OK
- [ ] Tracking : `/admin/analytics` segmentation visible
- [ ] Sentry : 0 nouvelle erreur sur préview
- [ ] Redis Upstash dashboard : commandes visibles

**Gate** : ✅ équipe valide → palier 2.

### Palier 2 — Canary (10% trafic)

**Durée** : 24 h
**Activation** :
```bash
# Vercel env (prod)
LIVE_CHAT_MODERATION=on             # 100% des chats modérés (low risk)
LIVE_REDIS_STATE=true               # 100% (state externalisé, low risk)
LIVE_CAPI_BATCHING=on               # 10% via cookie split (peut affecter match rate)
```

**Métriques à surveiller** (toutes les 4h) :
- pct chat messages modérés ≥ 99%
- pct events Meta dispatched OK ≥ 95% (vs baseline)
- Latence `/api/track` P95 ≤ baseline + 50ms
- Latence `/api/chat/message` first chunk P95 ≤ baseline + 200ms
- Dead letters publishing = 0
- Sentry : 0 erreur 500 supplémentaire

**Gate** : ✅ Canary OK → palier 3. ❌ Sinon **rollback** immédiat.

### Palier 3 — Ramp (50% trafic)

**Durée** : 3 j
**Activation** : split edge middleware 50/50 sur `LIVE_CAPI_BATCHING`
**Mesure statistique** :
- Meta match rate : v2 ≥ v1 - 1% (acceptable légère dégradation à cause batching async)
- Conv rate stable (±5%)
- Aucune régression UX chat (sessions abandonnées)

**Gate** : ✅ → palier 4. ❌ → diagnostic + rollback partiel.

### Palier 4 — Full (100% trafic)

**Activation** :
```bash
# Tous les flags à 'true'/'on' pour 100% du trafic
LIVE_REDIS_STATE=true
LIVE_CHAT_MODERATION=on
LIVE_CAPI_BATCHING=on
LIVE_PUBLISHING_DASHBOARD=on
LIVE_CHAT_FALLBACK=anthropic
LIVE_STREAM_MONITORING=on
LIVE_IDEMPOTENCY=on
```

Suppression du split middleware. Toute la prod sur v2.

---

## Rollback procedures

### Rollback granulaire par flag (< 60 sec)

Le plus probable : un seul flag pose problème, les autres OK.

```bash
# Exemple : batching CAPI cause des problèmes
vercel env rm LIVE_CAPI_BATCHING --env production
vercel --prod
```

Les autres systèmes continuent en v2.

### Rollback global (< 60 sec)

```bash
vercel env rm LIVE_REDIS_STATE --env production
vercel env rm LIVE_CHAT_MODERATION --env production
vercel env rm LIVE_CAPI_BATCHING --env production
vercel env rm LIVE_PUBLISHING_DASHBOARD --env production
vercel env rm LIVE_CHAT_FALLBACK --env production
vercel env rm LIVE_STREAM_MONITORING --env production
vercel env rm LIVE_IDEMPOTENCY --env production
vercel --prod
```

Retour comportement v1 instantané. Le code v1 reste fonctionnel.

### Rollback profond (revert commits)

Si bug structurel détecté :

```bash
git revert <merge-commit>
git push origin master
# Vercel redeploy auto
```

---

## Monitoring continu

### Dashboard Sentry alertes

| Event | Threshold | Action |
|---|---|---|
| `chat.moderation.failed` | > 5% sur 1h | Page admin |
| `chat.provider.fallback.triggered` | > 10% sur 5min | Page admin |
| `tracking.dispatch.failed` | > 5% sur 15min | Page admin |
| `publishing.dead_letter.created` | > 0 | Slack #alerts |
| `redis.connection.failed` | > 1% sur 1min | Page admin (critical) |

### Plausible events à instrumenter

- `live_chat_session_started` / `live_chat_session_ended`
- `live_chat_moderation_triggered`
- `live_chat_provider_fallback`
- `live_publishing_published` (par adapter, par mode)
- `live_publishing_dead_letter`
- `live_tracking_batch_flushed` (par provider, count)
- `live_tracking_dedup_hit`

### Dashboard Vercel cron health

Surveiller les crons :
- `/api/cron/content-studio/social-publish-scheduler` → must run every 5 min
- `/api/cron/tracking/capi-flush` → must run every 1 min

Alerte si miss > 2 consecutive runs.

### Smoke tests cron

Cron horaire (Vercel ou Upstash QStash) qui lance `smoke-chat.ts`, `smoke-publishing.ts`, `smoke-tracking.ts`. Slack alert si exit code 1.

---

## Timeline cible

| Jour | Action |
|---|---|
| **J-1** | Audit baseline ré-exécuté (KPIs pre-deploy archivés) |
| **J+0 matin** | Merge PR `fix/live-systems-robustness` |
| **J+0 après-midi** | Internal 2h (équipe valide preview) |
| **J+0 soir** | Canary 10% (`LIVE_CHAT_MODERATION` + `LIVE_REDIS_STATE`) |
| **J+1** | Vérif Canary chat + Redis → ajout `LIVE_CAPI_BATCHING` 10% |
| **J+2** | Ramp 50% sur batching |
| **J+5** | Ramp passe à 100% si OK |
| **J+7** | Full 100% tous flags + activation Sprint 3 flags |
| **J+14** | Décision Go/No-Go ferme sur tous KPIs |
| **J+30** | Suppression flags + cleanup v1 code path |

---

## Post-mortem template (si rollback)

Doc `06-postmortem.md` à créer si applicable :

```markdown
# Post-mortem rollback live-systems

## Date
J+X

## Symptôme observé
[Description précise]

## Cause racine
[Pourquoi exactement]

## Métrique déclencheuse
[Quelle alerte / quel KPI dégradé]

## Décision
- [ ] Rollback granulaire flag XXX
- [ ] Rollback global
- [ ] Rollback profond commits

## Apprentissages
- [ ] Test manquant : ...
- [ ] Métrique non instrumentée : ...
- [ ] Itération v3 envisagée : ...

## Action items
- [ ] Fix XXX avant retry rollout
- [ ] Ajouter test YYY
- [ ] Ajuster threshold ZZZ
```

---

## Communication

### Annonce interne (start Canary)

```
🚀 Live-systems v2 — Canary 10%
- Chat : OpenAI Moderation activée (input + output)
- Tracking : state externalisé Redis (dédup multi-lambda OK)
- Publishing : dashboard santé visible /admin/content-studio/health
- Rollback < 60 sec par flag indépendant si besoin
- Dashboard : <lien Sentry + Plausible>
```

### Annonce externe (Full)

Aucune. Changements internes uniquement.

---

## Checklist Go/No-Go J+14

- [ ] pct chats modérés ≥ 99%
- [ ] Meta CAPI match rate stable (±1% vs baseline)
- [ ] 0 dead letter publishing sur 7 j
- [ ] Posts schedulés partent à l'heure (audit_log)
- [ ] `serverFire` events visibles en /admin/analytics (≥ 100/jour)
- [ ] Latence /api/chat/message first chunk P95 < 2s
- [ ] Latence /api/track P95 < 100ms
- [ ] 0 erreur Redis sur 24h
- [ ] Sentry : 0 erreur 500 supplémentaire vs baseline
- [ ] Conv rate kit stable ou amélioré

# Runbook — Procédures opérationnelles

> Un runbook n'est pas un manuel d'utilisation. C'est ce qu'on dégaine à 3h du matin quand un incident P0 réveille l'on-call. Il doit être : lisible sous pression, action-oriented, sans ambiguïté.

## Philosophie

Un runbook est écrit pour **quelqu'un qui n'a jamais vu le système et qui doit agir maintenant**. Il évite :
- Le jargon non défini.
- Les renvois en cascade ("voir ADR-007 puis section 4.2.1...").
- Les commandes incomplètes ("lance la commande de migration").

Il privilégie :
- **Commandes copy-paste exécutables**.
- **Préconditions explicites** ("avant d'exécuter, vérifie X").
- **Vérifications post-exécution** ("après, attends Y avant Z").
- **Rollback path** explicit pour chaque action irréversible.

## Fichiers de cette section

- [`README.md`](README.md) — ce fichier
- [`deploy.md`](deploy.md) — procédure deploy prod step-by-step
- [`rollback.md`](rollback.md) — procédure rollback fast + safe
- [`incidents.md`](incidents.md) — playbooks par type d'incident (P0/P1/P2/P3)
- [`observability.yaml`](observability.yaml) — configuration Sentry + alerts Slack + dashboards
- [`db-operations.md`](db-operations.md) — opérations DB (migrations, backups, recovery)
- [`secrets-rotation.md`](secrets-rotation.md) — rotation API keys (OpenAI, Anthropic, etc.)

## On-call

- **dev_lead** : on-call 24/7 V5 ship → V5 ship + 14 jours, puis rotation hebdomadaire dev_lead ↔ dev_intermediate après V6 stabilisé.
- **PO Selma** : on-call business hours (8h-20h CET) pour décisions communication.
- **Care Karim** : on-call business hours pour leads urgents.

**Outils on-call** :
- Sentry mobile app (push notifications P0/P1).
- Slack mobile `#chat-launch` (alerts).
- Vercel mobile app (déploiements + logs).
- Téléphone perso (numbers shared en cas P0 catastrophique).

## Service Level Agreements (SLA)

| Sévérité | Réponse | Mitigation | Résolution |
|---|---|---|---|
| **P0 prod down** | < 15 min | < 1h | < 4h |
| **P1 feature broken** | < 1h | < 4h | < 24h |
| **P2 UX degraded** | < 4h | < 24h | < 1 week |
| **P3 cosmétique** | Best effort | Sprint courant | Sprint suivant |

## Métriques opérationnelles (cf. observability.yaml)

- **Uptime cible** : 99.5% prod (≈ 3h40 downtime/mois autorisé).
- **Latence p50 first token** : < 600ms.
- **Latence p95 first token** : < 1500ms.
- **Error rate** : < 0.5% requests.
- **Provider success rate** : > 99% (cumulé multi-provider).

## Convention de naming Sentry tags

Tous les events Sentry portent ces tags :
- `chat.area` : `intent | retrieval | provider | ui | leadform | admin`
- `chat.service_level` : `1 | 2 | 3 | 4 | 5`
- `chat.language` : `fr | ar | ar-MA`
- `chat.audience` : `b2c | b2b`
- `chat.session_id` : UUID (PII redaction appliquée si email/phone)

## Convention de naming Slack alerts

Channel `#chat-launch` :
- 🚨 P0 incidents (red)
- ⚠️ P1 incidents (orange)
- 📊 Budget alerts 80%/100% (yellow)
- 🟢 Deploys (green)

Channel `#chat-care` :
- 🔥 Hot leads
- 😞 Frustration alerts

Channel `#chat-build` :
- Async standup
- Questions dev
- CI failures

## Outils d'investigation type

1. **Sentry** : `chat.area:retrieval AND chat.service_level:>=3 AND timestamp:>1h`
2. **Vercel logs** : `vercel logs --since 1h --filter "POST /api/chat/message"`
3. **Postgres** : `psql $DATABASE_URL` puis queries SQL prêtes (cf. `db-operations.md`)
4. **Grafana** : dashboards Health / Business / Editorial / Care
5. **Linear** : recherche tickets par tag P0/P1

## Quand suivre quel runbook

| Situation | Runbook |
|---|---|
| "On veut déployer V5 vendredi soir" | [`deploy.md`](deploy.md) |
| "Le chat est down depuis 5 min" | [`incidents.md`](incidents.md) puis [`rollback.md`](rollback.md) |
| "Le provider OpenAI répond bizarre" | [`incidents.md`](incidents.md) provider section |
| "On doit appliquer migration 0028" | [`db-operations.md`](db-operations.md) |
| "L'API key OpenAI est compromise" | [`secrets-rotation.md`](secrets-rotation.md) |
| "Sentry est trop bruyant" | [`observability.yaml`](observability.yaml) sampling config |

## Documents externes référencés

- [`docs/dossier-chat-v2/09-plan-developpement/definition-of-done.md`](../09-plan-developpement/definition-of-done.md) — DoD Release/Ship
- [`docs/dossier-chat-v2/10-plan-action/escalation.md`](../10-plan-action/escalation.md) — escalation paths
- [`docs/dossier-chat-v2/01-architecture/c4-context.puml`](../01-architecture/c4-context.puml) — vue système

## Anti-patterns runbook

- ❌ Runbook écrit en prose sans commandes : illisible à 3h du matin.
- ❌ Runbook qui suppose une connaissance préalable du système.
- ❌ Runbook sans rollback path : on n'ose pas exécuter.
- ❌ Runbook copié-collé d'un projet précédent sans adaptation.
- ❌ Runbook qu'on n'a jamais répété en simulation (chaos engineering manuel).

# Module 11 — Infra & monitoring (INF-*)

> Réf. inventaire : **F-110..F-115**.
> Couvre les timers systemd des crons email, le healthcheck bout-en-bout,
> l'alerting DLQ, l'auth cron timing-safe, l'observabilité, et le cron rituals-j45.

---

## 1. Périmètre

| Réf | Fonctionnalité | Surface | Acteur |
|---|---|---|---|
| F-110 | Timers systemd des 6 crons email | infra | Système |
| F-111 | Webhook Stalwart configuré (URL+secret) | infra | Système |
| F-112 | Config bounces Listmonk | infra | Système |
| F-113 | Healthcheck bout-en-bout (cron mort / Listmonk down / fraîcheur) | backend+UI | Opérateur |
| F-114 | Observabilité (logs structurés + compteurs DLQ) | backend | Système |
| F-115 | Cron rituals-email-j45 | backend cron | Système |

### Fichiers sources concernés

- `/etc/systemd/system/femiglow-cron-*.{service,timer}` — unités systemd (5/6 absentes).
- Routes cron : `src/app/api/cron/email-outbox`, `email-automation`, `email-campaign-sync`,
  `email-listmonk-cleanup`, `email-audience-purge`, `rituals-email-j45`.
- `src/lib/admin/emails/health.ts` — `checkEmailingHealth()` (à étendre).
- `src/app/api/admin/emails/health/route.ts` — exposition du rapport.
- `src/lib/rituals/email-provider.ts` + `src/app/api/cron/rituals-email-j45/route.ts` — stub TODO.
- Config Stalwart (`/etc/stalwart-mail`) et Listmonk (`bounce.*`) — hors repo, vérifiées par probe/script.

---

## 2. Fonctionnement OPTIMAL (état cible)

### 2.1 Les 6 timers systemd — F-110

**État actuel** : seul `femiglow-cron-email-outbox.timer` existe ; **5 sur 6 absents** ⇒
automation, campaign-sync, listmonk-cleanup, audience-purge, rituals-j45 **ne tournent jamais**.

**État cible** : 6 timers présents, activés (`enabled`), avec une cadence cohérente et un bearer
`CRON_SECRET`. La source de vérité est **`timers-attendus.yaml`** (fourni dans ce module) ; un
**script de vérification idempotent** (`specs/check-timers.sh`) compare l'état serveur au manifeste
et **échoue** en CI/serveur si un timer manque, est désactivé, ou a une cadence divergente.

| Cron | Route | Cadence cible | Bearer | Justification |
|---|---|---|---|---|
| email-outbox | `/api/cron/email-outbox` | 60 s | CRON_SECRET | drain de la file d'envoi |
| email-automation | `/api/cron/email-automation` | 60 s | CRON_SECRET | tick runner + sweep wait_for_event |
| email-campaign-sync | `/api/cron/email-campaign-sync` | 5 min | CRON_SECRET | poll métriques Listmonk (pas de webhook campagne) |
| email-listmonk-cleanup | `/api/cron/email-listmonk-cleanup` | quotidien (03:10) | CRON_SECRET | suppr listes éphémères AVANT purge |
| email-audience-purge | `/api/cron/email-audience-purge` | quotidien (03:30) | CRON_SECRET | purge snapshots APRÈS cleanup (ordre §module 10) |
| rituals-email-j45 | `/api/cron/rituals-email-j45` | quotidien (09:00) | CRON_SECRET | invitation J+45 |

> L'ordre cleanup (03:10) **avant** purge (03:30) matérialise la garde anti-fuite du module 10.

### 2.2 Healthcheck étendu — F-113

**État actuel** : `checkEmailingHealth()` est **aveugle** à : cron mort, Listmonk down,
« dernier delivered : jamais ». Ces conditions ne dégradent pas le niveau.

**État cible** — ajouter ces probes (et faire dégrader le niveau) :
1. **Fraîcheur par cron** : chaque cron persiste son `last_tick_at` (table `cron_heartbeat` ou
   `admin_email_view`-like). Si un cron n'a pas tické depuis > 3× sa cadence ⇒ `degraded`/`incident`.
2. **Outbox pending vieillissant** : une ligne `pending` depuis > 10 min (au lieu du seul comptage > 50)
   ⇒ `degraded` (signe que le cron outbox est mort — exactement le symptôme prod).
3. **Probe Listmonk** : `listmonk.meta.serverInfo()` ; échec/timeout ⇒ `degraded`.
4. **Probe SMTP verify** : `transporter.verify()` ; échec ⇒ `incident`.
5. **Dernier delivered** : `lastDeliveredAt === null` **alors que** des envois récents existent ⇒
   `incident` (c'est le symptôme du webhook Stalwart cassé — W-URL).
6. Niveau global = pire des sous-checks (déjà le cas).

### 2.3 Alerting DLQ — F-114

**État actuel** : DLQ **sans alerte** (les lignes `dlq` s'accumulent en silence).

**État cible** : quand `count(dlq, 24h)` franchit un seuil, émettre une **alerte** (Slack via
`sendChatAlert` / log `error` structuré `mail.dlq.alert`), pas seulement un compteur passif.
Observabilité : events logger attendus normalisés (`cron.<name>.completed`, `mail.dlq.alert`,
`mail.send.suppressed`, `listmonk.cleanup.completed`) — testés présents.

### 2.4 Auth cron timing-safe — F-114

**État actuel** : plusieurs routes cron font `provided.length !== expected.length` puis
`timingSafeEqual` — l'**early-return sur la longueur** fuit l'info de longueur du secret (pas
strictement timing-safe). D'autres routes comparent directement `auth !== \`Bearer ${secret}\``
(carrément non timing-safe).

**État cible** : un helper unique `authorizeCron(req)` qui hashe (SHA-256) le token fourni **et**
attendu vers des buffers de **longueur fixe** puis `timingSafeEqual` — aucune fuite de longueur,
aucun early-return observable. Toutes les routes cron l'utilisent.

### 2.5 Rituals-j45 — F-115

**État actuel** : `listOrdersForJ45()` retourne `[]` (stub TODO) ; `consoleEmailProvider` log
silencieusement (fallback console). La feature **ne fait rien** en prod.

**État cible** : `listOrdersForJ45` interroge vraiment `orders` (J+45, payées) ; le provider est le
transactionnel réel (`sendTransactional`) et non un `console.warn`. Test : détecter le stub
(`INF-UNIT-J45-STUB`) et le fallback console silencieux.

---

## 3. Diagramme

`monitoring-cible.puml` — vue cible : timers → routes cron → heartbeat DB → healthcheck étendu →
badge admin + alerte DLQ/Slack.

---

## 4. Écarts audit ciblés

| Code | Constat prod | Garantie de test |
|---|---|---|
| I-TIMERS | 5/6 timers absents | `check-timers.sh` compare au manifeste, échoue si manquant/désactivé. |
| I-HEALTH-BLIND | healthcheck aveugle (cron mort, Listmonk down, « jamais delivered ») | `health-extended.test.ts` : chaque condition dégrade le niveau. |
| I-DLQ | DLQ sans alerte | `INF-UNIT-DLQ-ALERT` : franchissement de seuil émet une alerte. |
| I-RITUALS | rituals-j45 stub + fallback console | `INF-UNIT-J45-STUB` détecte le no-op. |
| I-AUTH | auth cron early-return non timing-safe sur la longueur | `INF-UNIT-CRON-AUTH` : helper hash+timingSafe, pas d'early-return. |
| I-WEBHOOK-URL | webhook Stalwart vers domaine inexistant | `INF-PROBE-WEBHOOK` (script) : l'URL configurée résout + reçoit 401 sur token vide (vivante). |
| I-LM-BOUNCE | `bounce.enabled=false` côté Listmonk | `INF-PROBE-LM-BOUNCE` (script) : settings Listmonk `bounce.enabled=true`. |

---

## 5. Stratégie de test (couches)

- **Shell/CI (couche infra)** : `specs/check-timers.sh` — idempotent, exécutable en CI **et** sur le
  serveur ; liste `systemctl`, compare à `timers-attendus.yaml`, exit≠0 si écart.
- **Unit/intégration (couche 1/3)** : `specs/health-extended.test.ts` — chaque probe étendue dégrade
  le niveau ; auth cron timing-safe ; alerte DLQ ; détection stub j45.
- **Observabilité** : assertions sur les events logger attendus.

Voir `test-matrix.csv` (≥ 30 lignes), `scenarios-metier.md`, `test-plan.yaml`, `timers-attendus.yaml`.

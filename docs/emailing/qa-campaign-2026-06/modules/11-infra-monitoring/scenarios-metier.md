# Scénarios métier — Infra & monitoring

Personas :
- **Réda**, SRE/ops : déploie, vérifie les timers, surveille les alertes.
- **Imane**, opératrice care : se fie au badge santé du dashboard `/admin/emails`.

---

## S-INF-1 — « Le déploiement vérifie ses 6 timers » (F-110)

1. Réda déploie une nouvelle version. Le pipeline CI exécute `check-timers.sh` **après** le
   `systemctl daemon-reload`.
2. Le script liste `systemctl list-timers` + `is-enabled` et compare à `timers-attendus.yaml`.
3. **Bug prod** : 5/6 timers absents ⇒ le script **échoue** en listant nommément
   `email-automation`, `email-campaign-sync`, `email-listmonk-cleanup`, `email-audience-purge`,
   `rituals-email-j45` comme manquants. Le déploiement est bloqué tant que ce n'est pas corrigé.
4. **Oracle** : exit 0 uniquement quand les 6 timers sont présents, `enabled`, à la bonne cadence.
   Idempotent : relancer le script donne le même verdict (`INF-TIMER-007`).

---

## S-INF-2 — « Le cron outbox est mort, le badge le dit » (healthcheck étendu, F-113)

1. Le timer `email-outbox` plante (ou n'existe pas). Des emails s'accumulent en `pending`.
2. **Bug actuel** : `checkEmailingHealth` ne regarde que `pending > 50` (comptage), pas l'**âge**.
   Un backlog de 10 mails `pending` depuis 30 min passe inaperçu ⇒ badge **vert** mensonger.
3. **État cible** : la probe « pending vieillissant > 10 min » + « fraîcheur cron (last_tick) » fait
   passer le niveau à `degraded` ⇒ badge orange. Imane voit le problème **avant** que le client se plaigne.
4. **Oracle** : `INF-HEALTH-005` (pending vieillissant), `INF-HEALTH-006` (cron pas tické).

---

## S-INF-3 — « Jamais livré : le webhook est mort » (F-113 / lien W-URL)

1. Le webhook Stalwart pointe un domaine inexistant (prod) ⇒ **aucun** `delivered` n'arrive jamais.
2. `lastDeliveredAt` reste `null` alors que des centaines d'emails sont `sent`.
3. **État cible** : la probe « `lastDeliveredAt === null` **malgré** des envois récents » ⇒ `incident`.
   Le badge devient rouge, signalant la rupture invisible du pipeline d'événements.
4. **Oracle** : `INF-HEALTH-009`. + probe infra `INF-PROBE-WEBHOOK` : l'URL configurée **résout**
   (pas de NXDOMAIN) et répond `401` sur token vide (donc vivante).

---

## S-INF-4 — « La DLQ se remplit, quelqu'un est prévenu » (F-114)

1. Une série d'emails échoue définitivement (template cassé) → ils tombent en DLQ.
2. **Bug actuel** : la DLQ s'accumule **sans alerte**. Personne ne le sait.
3. **État cible** : au franchissement du seuil (ex. 5/24h), `mail.dlq.alert` est émis (log error
   structuré + `sendChatAlert` Slack). Réda reçoit le ping.
4. **Oracle** : `INF-DLQ-001` (alerte au seuil), `INF-DLQ-002` (pas d'alerte sous le seuil).

---

## S-INF-5 — « Un attaquant teste le secret cron » (auth timing-safe, F-114)

1. Un attaquant POST `/api/cron/email-audience-purge` avec des bearers de longueurs variées pour
   inférer la longueur du secret via le timing.
2. **Bug actuel** : `provided.length !== expected.length` ⇒ early-return ⇒ **fuite de longueur**.
   Pire, certaines routes comparent en clair (`auth !== \`Bearer ${secret}\``), non timing-safe.
3. **État cible** : `authorizeCron` hashe (SHA-256) fourni **et** attendu vers des buffers de
   longueur fixe puis `timingSafeEqual` ⇒ aucune fuite, aucun early-return observable.
4. **Oracle** : `INF-UNIT-CRON-AUTH-003` (longueur différente, pas d'early-return),
   `INF-UNIT-CRON-AUTH-005` (secret absent ⇒ refus, jamais d'accès ouvert).

---

## S-INF-6 — « Rituals J+45 : la fausse promesse » (F-115)

1. Le cron `rituals-email-j45` est censé inviter les initiées 45 jours après commande.
2. **Bug actuel** : `listOrdersForJ45()` retourne `[]` (stub TODO) et le provider par défaut est
   `consoleEmailProvider` (log silencieux). La feature **n'envoie rien**.
3. **Oracle** : `INF-UNIT-J45-STUB` échoue tant que la query est un stub ; `INF-UNIT-J45-CONSOLE`
   échoue si le provider de prod retombe sur `console`. La fausse promesse est rendue visible.

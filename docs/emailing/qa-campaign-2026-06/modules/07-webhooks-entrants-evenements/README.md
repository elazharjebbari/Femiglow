# Module 07 — Webhooks entrants & flux d'événements (WHK-*)

> Réf. inventaire : **F-070, F-071, F-072, F-073, F-074**.
> Couvre la réception des événements Stalwart (SMTP outbound) et Listmonk
> (broadcast), leur dispatch vers les tables `email_*`, la chaîne de bounce
> complète, et la page opérateur `/admin/emails/events`.

---

## 1. Périmètre

| Réf | Fonctionnalité | Surface | Acteur |
|---|---|---|---|
| F-070 | Webhook Stalwart (`delivered`/`bounce`/`complaint`/`queued`/`rescheduled`) | API entrante | Système |
| F-071 | Webhook Listmonk (`bounce`/`complaint`/`unsub`/`campaign.*`) | API entrante | Système |
| F-072 | Chaîne `bounce → suppression → outbox → subscriber_link → blocklist Listmonk` | backend | Système |
| F-073 | Page `/admin/emails/events` (flux, filtres, temps réel) | UI admin | Opérateur |
| F-074 | Bridge événements → `user_event` | backend | Système |

### Fichiers sources concernés

- `src/app/api/mail/webhook/stalwart/route.ts` — récepteur Stalwart (Bearer header `x-fg-webhook-token`, timing-safe).
- `src/app/api/mail/webhook/listmonk/route.ts` — récepteur Listmonk (HMAC-SHA256 sur le body brut, header `x-listmonk-signature`).
- `src/lib/mail/webhooks/stalwart-parser.ts` — schémas Zod + `isHardBounce()` + `isKnownEvent()` + `mapStalwartEventToInternal()`.
- `src/lib/mail/webhooks/listmonk-parser.ts` — schémas Zod Listmonk + `isKnownListmonkEvent()`.
- `src/lib/mail/webhooks/listmonk-dispatcher.ts` — `dispatchListmonkEvent()` (campaign.* + subscriber.*).
- `src/lib/user-events/bridges/email-webhooks.ts` — `bridgeStalwartToUserEvent()` / `bridgeListmonkToUserEvent()`.
- `src/app/admin/emails/events/page.tsx` — dashboard debug `user_event`.
- `src/lib/db/schema-emails.ts` — `email_outbox`, `email_event`, `email_suppression`, `email_subscriber_link`, `email_campaign_link`.
- Tests existants (style à suivre) : `src/app/api/mail/webhook/{stalwart,listmonk}/__tests__/route.test.ts`,
  helper `src/lib/mail/__tests__/_helpers/fake-drizzle.ts`.

---

## 2. Fonctionnement OPTIMAL (état cible)

### 2.1 Récepteur Stalwart — contrat d'entrée

1. **Rate-limit** d'abord (`enforceMailRateLimit('webhook-stalwart')`) pour absorber un retry-storm Stalwart.
2. **Secret configuré** : sinon `503` (pas `200` silencieux — l'absence de secret est un incident d'exploitation visible).
3. **Auth timing-safe** : comparaison `timingSafeEqual` du header `x-fg-webhook-token` contre `FEMIGLOW_STALWART_WEBHOOK_SECRET`. Longueurs différentes → `false` **sans** court-circuit observable en timing (on compare quand même un buffer de longueur fixe, voir §4 écart W-SIG).
4. **JSON invalide** → `400`. **Payload tronqué / non conforme au schéma** → persistance d'un `email_event` orphelin `type='malformed'` puis `400` (cible : voir §4 W-ORPH) ; jamais de `500`.
5. **Discriminated union** : `event` pilote le parsing. `auth.failed` → log sécurité, `200`, aucune écriture outbox. Events inconnus (`acme.*`, `dns.*`, `imap.*`) → `200 {ignored:'unhandled-event'}`.
6. **Corrélation par `smtpMessageId`** : lookup `email_outbox WHERE smtp_message_id = ?`. **État cible** : index **UNIQUE** sur `smtp_message_id` (aujourd'hui non-unique → ambiguïté). Si 0 ligne → l'événement n'est **pas perdu** : il est persisté dans `email_event` avec `outboxId=NULL` + `correlation='orphan'` pour reconciliation ultérieure (au lieu du `200 {ignored:'unknown-message-id'}` qui jette l'info).
7. **Anti-rejeu** : `(source, smtpMessageId, type, ts)` dédupliqué via index unique + `ON CONFLICT DO NOTHING` ; un même DSN rejoué 3× ne produit qu'**un** `email_event` et ne ré-applique pas la suppression.
8. **Transitions outbox gardées** : `delivered` n'écrase pas un état terminal `bounced_permanent` (et inversement) — la transition suit une machine à états (voir `sequence-bounce-chain.puml`).

### 2.2 Chaîne de bounce COMPLÈTE (cible — F-072)

Pour un **hard bounce** (Stalwart `delivery.failed` avec `errorCode ∈ [500,600[`, ou Listmonk `subscriber.bounced bounce_type='hard'`), la transaction unique applique **les 5 effets** :

1. `email_outbox.status = 'bounced_permanent'`, `bouncedAt`, `bounceReason`, `bounceType='hard'`.
2. `email_event(type='bounced_hard', source, ts, rawJson)`.
3. `email_suppression(email, reason='hard_bounce')` `ON CONFLICT DO NOTHING`.
4. `email_subscriber_link.status='blocklisted'` (si la ligne existe).
5. **Blocklist côté Listmonk** : `listmonk.subscribers.blocklist([email])` — pour qu'une campagne Listmonk future ne ré-essaie pas l'adresse (best-effort, loggé, ne bloque pas la transaction DB).

Pour un **soft bounce** (`errorCode ∈ [400,500[` / `bounce_type='soft'`) : **PAS de suppression à vie**. On enregistre `bounced_soft` + `email_event`, on incrémente un compteur, et seul un **seuil** (N soft consécutifs) escalade en suppression. La distinction hard/soft est la garantie n°1 de ce module (audit : « soft → suppression à vie »).

### 2.3 Récepteur Listmonk — transitions campagne gardées

- `campaign.started` → `email_campaign_link.status='sending'` **uniquement si** status courant ∈ `{draft, scheduled}`. Un `started` reçu après `completed` est **ignoré** (idempotence + garde anti-désordre ; audit : « started après completed »).
- `campaign.completed` → `status='sent'` + `sentCount/openCount/clickCount/bounceCount`. Idempotent.
- `subscriber.unsubscribed` / `.bounced` / `.complained` : même chaîne de suppression que §2.2.
- Payload malformé → **pas** de `400` qui ferait retry-storm côté Listmonk : on persiste un `email_event` orphelin et on renvoie `200` (Listmonk ne re-livre pas). La signature HMAC invalide reste `401`.

### 2.4 Page `/admin/emails/events` (cible — F-073)

- Affiche total 24h, top events `(event_name, source)`, 100 derniers events.
- **Filtres** : par `source` (web/email/server/admin/import) — déjà présent ; cible : ajouter filtre par `event_name` et par fenêtre temporelle.
- **Temps réel** : cible = rafraîchissement (polling léger 10 s ou SSE) pour qu'un opérateur voie arriver un `delivered` de test sans recharger.
- **Oracle opérateur** : après un webhook `delivered` de test, la ligne apparaît avec `source=email` et le badge vert ; le compteur 24h s'incrémente de 1.

---

## 3. Diagramme

`sequence-bounce-chain.puml` — séquence complète Stalwart `delivery.failed (5xx)` → 5 effets + bridge user_event, avec les gardes de transition et le chemin orphelin.

---

## 4. Écarts audit ciblés (defauts → garantie de test)

| Code | Constat prod (audit 2026-06-03) | Garantie exigée par ce module |
|---|---|---|
| W-URL | Webhook prod pointe `https://admin.femiglow-maroc.com` (domaine inexistant) → 0 `delivered` jamais reçu, outbox bloqué à `sent` | Test infra (module 11, INF) + contract test prouvant qu'un `delivered` reçu **fait** transitionner l'outbox. |
| W-CORR | Corrélation `smtp_message_id` fragile ; index non-unique ; orphelins perdus avec `200` silencieux | `smtp_message_id` UNIQUE ; orphelin **persisté** (`outboxId=NULL`) au lieu d'être jeté. WHK-INT-ORPH. |
| W-SOFT | Listmonk bounce : hard/soft non distingués → soft = suppression à vie | Table-driven hard≠soft ; soft ne crée **aucune** suppression sous le seuil. WHK-UNIT-BOUNCE-*. |
| W-BLK | Pas de blocklist côté Listmonk après hard bounce | `bounce-chain.integration.test.ts` vérifie l'appel `listmonk.subscribers.blocklist`. |
| W-OUT | Outbox non mise à jour par le webhook Listmonk bounce | La chaîne met à jour outbox **et** subscriber_link **et** suppression. |
| W-TRANS | Transitions campagne non gardées (`started` après `completed`) | WHK-INT-CMP-GUARD : `started` post-`completed` n'écrase pas. |
| W-REPLAY | Pas d'anti-rejeu | WHK-INT-REPLAY : DSN rejoué 3× = 1 event, 1 suppression. |
| W-MALF | Payload malformé → `400` (retry-storm Listmonk) | WHK-CT-MALFORMED : orphelin persisté + `200` côté Listmonk. |
| W-SIG | Signature invalide non timing-safe sur la longueur | WHK-UNIT-SIG : comparaison à temps constant, longueur incluse. |
| W-BRIDGE | Bridge user_event fire-and-forget non monitoré | WHK-INT-BRIDGE : `delivered` crée bien un `user_event(email.delivered, source=email)`. |

---

## 5. Stratégie de test (couches)

- **Contract (couche 5)** : `specs/stalwart-contract.test.ts` rejoue les fixtures `fixtures/stalwart/*.json` (delivered, bounce hard/soft, complaint, message-id absent, tronqué, signature KO, rejeu, lot, event inconnu) contre la route réelle via `fake-drizzle`.
- **Intégration (couche 3)** : `specs/bounce-chain.integration.test.ts` contre Postgres de test — vérifie les 5 effets de la chaîne bounce + l'appel blocklist Listmonk (MSW).
- **Composant (couche 2)** : rendu de `/admin/emails/events` + filtres + grille d'échecs sur la requête de comptage.
- **Unit (couche 1)** : `stalwart-parser` / `listmonk-parser` table-driven (`isHardBounce`, `isKnownEvent`, mapping).

Voir `test-matrix.csv` (≥ 50 lignes), `scenarios-metier.md`, `test-plan.yaml`.

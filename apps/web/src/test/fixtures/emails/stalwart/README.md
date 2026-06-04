# Fixtures webhook Stalwart — corpus contract tests (phase 5)

Payloads webhook Stalwart Mail (v0.16) destinés aux **contract tests** du
récepteur `POST /api/mail/webhook/stalwart`
(`src/app/api/mail/webhook/stalwart/route.ts`).

Chaque fichier `.json` est le **corps HTTP brut** tel qu'il arrive sur le
endpoint. Le récepteur lit le payload via `stalwartWebhookSchema`
(`src/lib/mail/webhooks/stalwart-parser.ts`).

## Contrat de nommage

```
NNN-<type>.json
```

- `NNN` : index ordinal stable (zéro-padé sur 3), ordre de lecture.
- `<type>` : libellé kebab-case du cas métier (delivered, bounce-hard…),
  PAS le nom d'event Stalwart (qui est dans le champ `event`).
- Un fichier = un cas de contrat (un oracle). Ne jamais en muter le sens :
  pour un nouveau cas, ajouter un nouveau `NNN`.

## Shape du payload — note de contrat IMPORTANTE

Le parser du repo lit une enveloppe **PLATE** :
`{ event, queueId?, messageId?, rcpt?, errorCode?, reason?, nextRetry?, ts?, … }`
(`event` = enum `EventType` canonique de Stalwart, ex. `delivery.delivered`).
Tous les schemas sont `.passthrough()` → champs additionnels tolérés et
stockés dans `email_event.raw_json`.

⚠️ Le webhook **natif** Stalwart v0.16 envoie en réalité une enveloppe
**BATCH** : `{ "events": [ { id, createdAt, type, data } ] }`
(`type` au lieu de `event`, payload imbriqué dans `data`, lot multi-events).
Le parser actuel ne gère PAS cette forme native (cf. fixture `008`, qui est
volontairement REJETÉE par `stalwartWebhookSchema`). C'est un écart de
contrat documenté ici pour que le contract test l'épingle (et non un bug de
fixture). Source : https://stalw.art/docs/telemetry/webhooks (enveloppe
`WebhookEvents { events: [WebhookEvent { id, createdAt, type, data }] }`).

## Provenance

Constat audit 2026-06 + logs prod (`/etc/stalwart-mail/logs/stalwart.2026-*`) :
le webhook Stalwart prod **n'a jamais livré** — l'URL configurée
(`https://admin.femiglow-maroc.com/api/mail/webhook/stalwart`) est morte
(host inexistant), des milliers de lignes
`WARN Webhook collector error (telemetry.webhook-error) … failed`. Aucun
corps de webhook capturable. Les fixtures sont donc **synthétiques-doc**,
construites à partir (a) des champs réellement émis par les events de
télémétrie Stalwart observés dans les logs prod (`queueId` snowflake
numérique, `queueName`, `from`, `to[]`, `size`, `total`, `hostname`, `code`,
`details`, `reason`, `nextRetry`, `nextDsn`, `expires`, `elapsed`) et (b) de
ce que `stalwart-parser.ts` consomme.

| Fichier | Cas | event | Provenance |
|---|---|---|---|
| `001-delivered.json` | Livraison OK | `delivery.delivered` | synthétique-doc (champs réels logs prod `delivery.delivered` du 2026-05-13) |
| `002-bounce-hard.json` | Bounce permanent 5xx → suppression `hard_bounce` | `delivery.failed` | synthétique-doc (errorCode 550, parser `isHardBounce`) |
| `003-bounce-soft.json` | Bounce temporaire 4xx (pas de suppression) | `delivery.failed` | synthétique-doc (errorCode 451) |
| `004-complaint-abuse.json` | Plainte/abuse (ARF), traité 5xx → suppression | `delivery.failed` | synthétique-doc (code 554, `feedbackType:abuse`) |
| `005-deferred.json` | Différé / reprogrammé → `retried` | `queue.rescheduled` | synthétique-doc (champs réels logs prod `queue.rescheduled`/`nextRetry`/`expires`) |
| `006-rejected.json` | Rejet policy / message expiré | `delivery.failed` | synthétique-doc (motif réel logs prod "Message expired…") |
| `007-queued-authenticated.json` | Soumission app→Stalwart 587 acceptée → `queued` | `queue.authenticated-message-queued` | synthétique-doc (champs réels logs prod `queue.authenticated-message-queued`, port 587) |
| `008-batch-multi-events.json` | **Lot multi-événements, enveloppe NATIVE Stalwart** `{events:[…]}` | `type` par event | synthétique-doc (https://stalw.art/docs/telemetry/webhooks) — REJETÉ par le parser actuel (écart de contrat épinglé) |
| `009-missing-message-id.json` | Champ requis manquant (`messageId` absent) → ignoré `no-message-id` | `delivery.delivered` | synthétique-doc |
| `010-unexpected-type.json` | Type d'event inattendu (acme.*) → 200 `unhandled-event` | `acme.order-completed` | synthétique-doc (events hors-mail captés par `eventsPolicy=exclude`) |
| `011-auth-failed.json` | Signal sécurité (échec auth SMTP), pas d'écriture DB | `auth.failed` | synthétique-doc (champs réels logs prod auth) |
| `012-large-payload.json` | Gros payload (50 rcpt, headers volumineux, perRecipient) | `delivery.failed` | synthétique-doc (stress parsing/passthrough, ~12 Ko) |

## Anonymisation

- Emails → `userN@exemple.test` ; noms → prénoms génériques MA (Salma, Imane…).
- IPs → plage documentaire `192.0.2.0/24` (RFC 5737).
- Domaines tiers → `exemple.test`. `femiglow-maroc.com` conservé (domaine
  expéditeur, non sensible).
- `queueId` / `messageId` : structure préservée (snowflake numérique /
  `<uuid@domain>`), valeurs ré-générées.

## Validation

```bash
# zéro JSON malformé
node -e 'require("fs").readdirSync(".").filter(f=>f.endsWith(".json")).forEach(f=>JSON.parse(require("fs").readFileSync(f)))'
```
Conformité au parser vérifiée via `stalwartWebhookSchema.safeParse` (voir le
rapport de la phase 0.4). 001–007, 009–012 PARSED ; 008 REJECTED (attendu).

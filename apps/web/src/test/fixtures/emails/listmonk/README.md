# Fixtures webhook Listmonk — corpus contract tests (phase 5)

Payloads webhook Listmonk destinés aux **contract tests** du récepteur
`POST /api/mail/webhook/listmonk`
(`src/app/api/mail/webhook/listmonk/route.ts`).

Chaque fichier `.json` est le **corps HTTP brut** signé HMAC-SHA256
(`X-Listmonk-Signature`) qui arrive sur le endpoint. Le récepteur lit le
payload via `listmonkWebhookSchema` (`src/lib/mail/webhooks/listmonk-parser.ts`)
puis le dispatche via `dispatchListmonkEvent`
(`src/lib/mail/webhooks/listmonk-dispatcher.ts`).

> Note contract test : la **signature HMAC** n'est PAS incluse dans le
> fixture (elle dépend du secret + du corps exact). Le test la calcule sur
> le `JSON.stringify` du fixture avec le secret de test, comme dans
> `src/app/api/mail/webhook/listmonk/__tests__/route.test.ts`.

## Contrat de nommage

```
NNN-<type>.json
```

- `NNN` : index ordinal stable (zéro-padé sur 3).
- `<type>` : libellé kebab-case du cas métier (bounce-hard, subscriber-optin…).
- Un fichier = un cas de contrat (un oracle). Pour un nouveau cas, nouveau `NNN`.

## Shape du payload — note de contrat

Le parser du repo attend l'enveloppe **custom FemiGlow** (configurée côté
Listmonk via un transformer/messenger sortant) :
`{ event, source: "listmonk", ts: <unix>, data: { … } }`.

`event` ∈ { `subscriber.created`, `subscriber.updated`,
`subscriber.unsubscribed`, `subscriber.bounced`, `subscriber.complained`,
`campaign.started`, `campaign.completed` }. Schemas `.passthrough()`.

Le dispatcher extrait défensivement (`pickString`/`pickNumber`) :
- subscriber.* : email via `data.subscriber.email` **ou** `data.email` ;
  `data.bounce_type` / `data.type` pour le type de bounce.
- campaign.* : `data.id` / `data.campaign_id`, puis `sent`, `views`/`opens`,
  `clicks`, `bounces`.

⚠️ La forme **native** de l'API bounce Listmonk est différente :
`{ id, type, source, email, subscriber_uuid, subscriber_id, campaign{id,name},
meta, created_at }` (cf. https://listmonk.app/docs/apis/bounces/). Les
fixtures imbriquent ces champs réels DANS `data` pour le réalisme, mais
l'enveloppe `{event, source, ts, data}` reste celle que le parser consomme.

## Provenance

La prod n'a **aucun event webhook Listmonk capturé** en base
(`email_event` prod : 17 lignes, toutes `source='app'`, zéro `listmonk` —
le wiring DB est en place mais aucune campagne broadcast n'a encore tourné).
Fixtures **synthétiques-doc**, champs internes calés sur la doc Listmonk
officielle.

| Fichier | Cas | event | Provenance |
|---|---|---|---|
| `001-bounce-hard.json` | Bounce dur → suppression `hard_bounce` + subscriber `blocklisted` | `subscriber.bounced` | synthétique-doc (champs bounce API : type/source/meta/subscriber_uuid, https://listmonk.app/docs/apis/bounces/) |
| `002-bounce-soft.json` | Bounce mou (`bounce_type:soft`) | `subscriber.bounced` | synthétique-doc |
| `003-complaint.json` | Plainte → suppression `complaint` | `subscriber.complained` | synthétique-doc (feedback-loop/abuse) |
| `004-subscriber-optin.json` | Opt-in confirmé → INSERT `email_subscriber_link` | `subscriber.created` | synthétique-doc (champs subscriber API : uuid/attribs/lists.subscription_status) |
| `005-subscriber-optout.json` | Désinscription → suppression `unsubscribe` + subscriber `disabled` | `subscriber.unsubscribed` | synthétique-doc (email imbriqué `data.subscriber.email`) |
| `006-campaign-started.json` | Démarrage campagne → `email_campaign_link.status=sending` | `campaign.started` | synthétique-doc (id/campaign_id) |
| `007-campaign-completed.json` | Fin campagne → métriques sent/views/clicks/bounces | `campaign.completed` | synthétique-doc (champs métriques lus par le dispatcher) |
| `008-unknown-event.json` | Event non consommé → 200 `unknown-event` (passthrough) | `subscriber.deleted` | synthétique-doc |

## Anonymisation

- Emails → `userN@exemple.test` ; noms → prénoms génériques MA.
- `subscriber_uuid` / campaign `uuid` : format UUID préservé, valeurs
  ré-générées (non corrélées à la prod).
- IPs (le cas échéant) → `192.0.2.0/24` (RFC 5737).

## Validation

```bash
node -e 'require("fs").readdirSync(".").filter(f=>f.endsWith(".json")).forEach(f=>JSON.parse(require("fs").readFileSync(f)))'
```
Conformité vérifiée via `listmonkWebhookSchema.safeParse` : 001–007
PARSED+KNOWN ; 008 PARSED+passthrough (ignoré, attendu).

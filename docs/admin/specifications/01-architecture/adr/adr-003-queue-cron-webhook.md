# ADR-003 — Queue webhook persistée en DB + Vercel Cron

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-03 |

## Contexte

Chaque lead reçu doit être transmis à un serveur partenaire. Les
contraintes :

- Aucun lead silencieusement perdu (retry sur 24h+).
- Latence checkout indépendante du partenaire.
- Souveraineté des données (pas de tiers PII).
- Coût récurrent minimal.
- UI 100 % in-brand.

Trois options évaluées dans
[`../../../04-faisabilite-webhook.md`](../../../04-faisabilite-webhook.md) :
inline synchrone, queue DB+Cron, service managé (Inngest/Trigger.dev).

## Décision

Adopter **queue persistée en DB Postgres + Vercel Cron `* * * * *`** :

- Tables : `webhook_endpoints` (configuration), `webhook_deliveries`
  (instances).
- Sélection : `SELECT … FOR UPDATE SKIP LOCKED LIMIT 50`.
- Backoff : `1m, 2m, 5m, 15m, 1h, 6h, 24h` (7 tentatives, ~36 h).
- Idempotence : header `Idempotency-Key: <lead.id>`.
- Signature : HMAC-SHA256 sur le body, header
  `X-FemiGlow-Signature: sha256=<hex>`.
- Auth cron : header `Authorization: Bearer ${CRON_SECRET}`.

## Conséquences

### Positives

- Découplage complet du checkout (latence stable < 500 ms p95).
- Retry automatique 36 h → aucune perte sur panne courte du partenaire.
- Multi-endpoints natif (N rows par lead).
- Replay one-click (insert d'un nouveau pending).
- Observabilité native (`webhook_deliveries` requêtable en SQL).
- Aucun service tiers, aucun DPA supplémentaire.
- Coût additionnel : 0 € (le Cron Vercel est inclus dans le plan Pro déjà
  requis pour la prod).

### Négatives

- Latence d'envoi : jusqu'à 60 s avant le premier tick (acceptable, le
  partenaire n'est pas l'utilisateur final).
- Vercel Hobby limité à 2 cron/jour → plan Pro requis.
- Code à maintenir : ~150 lignes (sélection, fetch, retry, update).

## Alternatives rejetées

| Alternative | Raison |
|---|---|
| **Webhook inline synchrone** | Couplage temporel ; perte silencieuse en cas de panne réseau ; pas de retry |
| **Inngest** | DPA supplémentaire (PII passent par leur cloud) ; UI hors marque ; surdimensionné pour le volume FemiGlow |
| **Trigger.dev** | idem Inngest |
| **QStash (Upstash)** | Free tier 500 msg/jour limitatif ; PII transitent par Redis Upstash |
| **AWS SQS + Lambda** | Hors écosystème Vercel ; complexité IAM ; coût AWS |

## Sécurité

- Secrets endpoints chiffrés at-rest via `pgcrypto.pgp_sym_encrypt(secret, master_key)`.
- `CRON_SECRET` injecté par Vercel (header automatique sur leurs invocations).
- Validation stricte de l'URL endpoint (Zod : `https://` obligatoire).

## Critères d'acceptation

- [ ] Une livraison failed est rejouée selon le backoff exact.
- [ ] Header `Idempotency-Key` est présent et stable entre retries.
- [ ] Signature HMAC vérifiable côté receveur avec le secret partagé.
- [ ] `FOR UPDATE SKIP LOCKED` empêche les doubles traitements en cas
      d'invocations cron concurrentes.
- [ ] Replay manuel insère bien une nouvelle delivery `pending`.
- [ ] Cron sans `Authorization` valide retourne 401.

## Évolution future

Si le volume dépasse ~10 000 leads/mois ou si des workflows complexes
(fan-out, agrégations) émergent, migration vers Inngest ou un service
similaire reste possible **sans casser l'API publique** (la table
`webhook_deliveries` peut être conservée comme shadow log).

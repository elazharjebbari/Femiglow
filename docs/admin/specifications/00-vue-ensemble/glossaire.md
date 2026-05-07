# Glossaire

> Vocabulaire partagé entre design, frontend, backend, data et opérations.
> Toute ambiguïté résolue ici fait foi.

---

## A

**Administrateur (admin)**
La fondatrice ou un opérateur unique mandaté. Identité unique stockée en
variables d'environnement (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`).

**ADR (Architecture Decision Record)**
Note courte décrivant une décision technique structurante : contexte,
options, choix retenu, conséquences. Versionnée dans
[`../01-architecture/adr/`](../01-architecture/adr/).

**Argon2id**
Algorithme de hachage de mot de passe résistant aux attaques GPU et
side-channel. Variant retenu : `argon2id`, paramètres OWASP 2024
(`memoryCost: 19456 KiB`, `timeCost: 2`, `parallelism: 1`).

**Audit trail**
Journal immuable de toute action effectuée sur un lead (changement de
statut, ajout de note, suppression, replay webhook). Implémenté par la
table `lead_events` (cf. [`../06-data/schema.sql`](../06-data/schema.sql)).

## B

**Backoff exponentiel**
Stratégie de retry où l'intervalle entre tentatives croît
exponentiellement. Échéancier retenu : `1m, 2m, 5m, 15m, 1h, 6h, 24h`
(7 tentatives sur ~36 h).

**Brand voice**
Voix de marque FemiGlow : sobre, précise, féminine, slow-beauty.
S'applique aussi aux libellés admin (cf.
[`../02-design-system/voix-redactionnelle.md`](../02-design-system/voix-redactionnelle.md)).

## C

**CSP (Content Security Policy)**
Directive HTTP qui restreint les sources de scripts, styles, images,
connexions XHR. Renforcée pour `/admin/*` (cf.
[`../07-securite/headers-csp.md`](../07-securite/headers-csp.md)).

**Cron tick**
Endpoint privé `POST /api/admin/cron/webhook-tick` invoqué par Vercel
Cron toutes les minutes pour traiter le batch de livraisons webhook
en attente.

## D

**Delivery (livraison)**
Une tentative de POST vers un endpoint partenaire pour un couple
`(lead, endpoint)`. Tracée par une ligne dans `webhook_deliveries`.

**Drizzle**
ORM TypeScript-first pour Postgres/SQLite. Utilisé pour le schéma, les
migrations et les requêtes (préféré à Prisma pour la légèreté serverless).

## E

**Endpoint (webhook)**
Configuration d'une cible HTTP : URL, secret HMAC, filtre, état
(actif/inactif). Stocké dans `webhook_endpoints`.

## F

**Filter (webhook)**
Expression jsonb sur un endpoint qui restreint les leads transmis.
Exemple : `{ "type": ["order"] }` envoie uniquement les leads checkout.

## H

**HMAC-SHA256**
Code d'authentification de message basé sur SHA-256. Signature du body
JSON avec un secret partagé entre FemiGlow et le partenaire. Header
émis : `X-FemiGlow-Signature: sha256=<hex>`.

## I

**Idempotency-Key**
Header HTTP transportant `lead.id` permettant au partenaire de
dédupliquer les retries.

**iron-session**
Bibliothèque qui chiffre la session en cookie (AES-256-GCM) sans serveur
de session. Adoptée pour l'auth admin (cf. ADR-001).

## L

**Lead**
Entité métier représentant un contact qualifié. Quatre origines :
`contact`, `order` (checkout), `newsletter`, `b2b`. Stocké dans la table
`leads`.

**Lead status**
Statut métier d'un lead. Énumération : `new`, `in_progress`, `converted`,
`closed`, `duplicate`.

**Lead event**
Audit log d'une action sur un lead : `status_changed`, `note_added`,
`viewed`, `webhook_replayed`. Table `lead_events`.

## M

**Middleware**
`apps/web/src/middleware.ts` qui intercepte les requêtes vers
`/admin/(?!login)` et `/api/admin/*`, valide la session, et redirige ou
renvoie 401 sinon.

**MSW (Mock Service Worker)**
Bibliothèque interceptant les requêtes HTTP en test (Node ou navigateur)
sans modifier le code applicatif. Source unique des fixtures pour les
tests d'intégration.

## N

**Neon**
Service Postgres managé serverless, séparant compute et stockage,
plan free tier suffisant pour le démarrage. Région retenue :
`eu-central-1` (Francfort).

## P

**Payload (webhook)**
Corps JSON envoyé au partenaire, projeté depuis un `lead` via la fonction
pure `mapLeadToWebhookPayload`. Format imposé par le partenaire (cf.
`docs/admin/04-faisabilite-webhook.md` § 1.1).

**PII (Personally Identifiable Information)**
Donnée à caractère personnel : email, téléphone, nom, adresse, IP. Sujet
au RGPD et à la loi 09-08 marocaine.

## R

**Rate limit**
Limitation du nombre de tentatives de login par IP (5 / 10 min).
Implémentée en mémoire process (acceptable serverless, dégradé connu).

**Replay**
Action manuelle de re-déclencher une livraison webhook depuis l'admin :
insert d'une nouvelle ligne `webhook_deliveries` avec `attempt = 1`.

**Route group**
Pattern Next.js 14 App Router pour grouper des routes sous un layout
sans modifier l'URL. Utilisé : `(marketing)`, `(commerce)`, `(admin)`.

## S

**Server Component**
Composant React Next.js exécuté côté serveur, rendu en HTML, capable de
lire la DB directement via Drizzle. Utilisé pour toutes les pages
`/admin/*` sauf formulaires.

**Session**
Tuple `{ user: { email }, createdAt, expiresAt }` chiffré dans le cookie
`fg_admin_session` (durée 7 jours rolling).

## T

**Tâche atomique**
Unité d'implémentation < 4 h, testable indépendamment, identifiée
`ADM-NN`. Référencée dans
[`../10-plan-action/taches-atomiques.csv`](../10-plan-action/taches-atomiques.csv).

**Tick**
Voir *Cron tick*.

## V

**Vercel Cron**
Mécanisme natif Vercel d'invocation périodique d'un endpoint HTTP. Auth
par header `Authorization: Bearer ${CRON_SECRET}`.

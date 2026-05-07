# Recommandation finale — Interface d'administration FemiGlow

> **Statut.** Synthèse des trois études de faisabilité conduites en amont
> (audit + 3 services). Document de **décision**, pas de plan d'action :
> il fixe les choix techniques structurants, les justifications, les
> invariants à respecter et les risques résiduels. Le plan d'action
> détaillé sera produit ultérieurement.

---

## 0. Périmètre couvert

| Service | Document source |
|---|---|
| Audit de l'existant | [`01-audit-application.md`](./01-audit-application.md) |
| Authentification administrateur | [`02-faisabilite-authentification.md`](./02-faisabilite-authentification.md) |
| Gestion des leads (UI + stockage) | [`03-faisabilite-gestion-leads.md`](./03-faisabilite-gestion-leads.md) |
| Webhook sortant vers serveur tiers | [`04-faisabilite-webhook.md`](./04-faisabilite-webhook.md) |

---

## 1. Vue d'ensemble — la recommandation en une phrase

> Une admin **`/admin/*`** sobre, isolée dans un route group, protégée par
> **iron-session + argon2** (un seul administrateur en variables
> d'environnement), adossée à **Postgres managé (Neon ou Vercel Postgres)
> + Drizzle ORM**, avec une **queue de webhooks persistée en DB déclenchée
> par Vercel Cron** pour pousser chaque lead vers le serveur partenaire,
> tout réutilisant les primitives UI, la palette et la voix de marque
> déjà en place.

---

## 2. Décisions actées

### 2.1 Authentification → **iron-session + argon2 + admin unique en env**

| Aspect | Décision |
|---|---|
| Bibliothèque | `iron-session` (cookies chiffrés AES-256-GCM, sans serveur de session) |
| Algorithme de hash | `@node-rs/argon2` (argon2id, paramètres OWASP) |
| Stockage des credentials | `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (env vars Vercel) |
| Multi-utilisateur | non (un seul admin, voix "fondatrice") |
| Page de login | `/admin/login`, react-hook-form + Zod, primitives UI existantes |
| Middleware | `apps/web/src/middleware.ts` matchant `/admin/(?!login)` et `/api/admin/*` |
| Durée de session | 7 jours rolling, regénération à chaque requête authentifiée |
| Logout | `POST /api/admin/logout` qui détruit le cookie |
| Rate limit login | en mémoire process (5 tentatives / 10 min / IP), dégradé acceptable serverless |
| Rotation du secret | `IRON_SESSION_PASSWORD` rotatable sans casser les sessions actives (multi-secret accepté par iron-session) |

**Pourquoi.** Approche minimale, souveraine, aucun service tiers, aucune
DB nécessaire pour l'auth, cohérente avec une admin à un seul utilisateur.
NextAuth.js (B) sur-équipé pour ce besoin. Clerk (C) impose un vendor
US et un coût récurrent injustifié pour un seul utilisateur.

### 2.2 Gestion des leads → **Postgres managé + Drizzle + Server Components**

| Aspect | Décision |
|---|---|
| Provider Postgres | **Neon** (région EU `eu-central-1`) en priorité, **Vercel Postgres** acceptable |
| ORM | **Drizzle** (typage strict, migrations SQL, runtime léger Edge-compatible) |
| Schéma de base | `leads` + `lead_events` (audit trail) + `admin_users` (préparé pour futur multi-user) |
| Rendu | Server Components Next.js, pagination cursor-based, recherche full-text Postgres `tsvector` |
| Capture côté formulaires | mutation des routes `/api/contact` et `/api/checkout` pour insérer en DB en plus du `console.warn` actuel |
| Filtres | type, statut, période, ville, source, recherche multi-champs |
| Détail lead | timeline d'événements, notes internes, changement de statut, rejouer webhook |
| Export | CSV serveur via streaming response |
| Sauvegardes | snapshots quotidiens automatiques (couverts par Neon free tier) |

**Pourquoi.** Postgres = lingua franca, requêtes SQL ad-hoc trivial,
backups managés, EU-hosted (RGPD + loi 09-08), free tier suffisant à 12
mois. Drizzle = TypeScript natif, zéro magie, migrations versionnées
git-friendly. Server Components = pas d'API REST à concevoir pour l'admin
(les pages lisent directement la DB via Drizzle), réduit la surface.
Turso (B alternatif) écarté par maturité de l'écosystème SQLite côté
Server Components et richesse SQL plus faible. Airtable / Notion (C)
écarté pour rupture de marque, latence et conformité.

### 2.3 Webhook sortant → **Queue persistée en DB + Vercel Cron + worker idempotent**

| Aspect | Décision |
|---|---|
| Stockage | tables `webhook_endpoints` + `webhook_deliveries` dans la même DB que `leads` |
| Déclencheur | Vercel Cron `* * * * *` → `POST /api/admin/cron/webhook-tick` (Bearer `CRON_SECRET`) |
| Concurrence | `SELECT … FOR UPDATE SKIP LOCKED LIMIT 50` |
| Retry | backoff exponentiel : 1m, 2m, 5m, 15m, 1h, 6h, 24h → 7 tentatives, ~36 h |
| Idempotence | header `Idempotency-Key: <lead.id>` |
| Signature | HMAC-SHA256, header `X-FemiGlow-Signature: sha256=<hex>` |
| Mapper payload | fonction pure `mapLeadToWebhookPayload(lead) → WebhookPayload` testée unitairement |
| Multi-endpoints | oui (N rows possibles, un endpoint par défaut au démarrage) |
| Filtre | jsonb `{ "type": ["order", "contact"] }` par endpoint |
| UI admin | `/admin/webhooks` (CRUD), `/admin/webhooks/[id]/deliveries` (logs), section dans `/admin/leads/[id]` |
| Replay | bouton "rejouer" → insert `pending` avec `attempt = 1`, `scheduled_for = NOW()` |
| Secret endpoint | chiffré at-rest via `pgcrypto.pgp_sym_encrypt` (clé maître en env) |

**Pourquoi.** Découplage du checkout (latence stable), retry automatique
sur 36 h (aucune perte silencieuse), souveraineté (pas de tiers qui voit
les PII), UI 100 % in-brand, coût marginal (Vercel Cron gratuit dans le
plan Pro qui sera de toute façon nécessaire pour les env vars
production). Inngest / Trigger.dev (C) écartés : volume FemiGlow trop
faible pour justifier un service externe + DPA + dashboard hors marque.

---

## 3. Architecture cible (vue d'ensemble)

```text
                    ┌──────────────────────────────┐
                    │      VISITEUR PUBLIC         │
                    └────────────────┬─────────────┘
                                     │
                  POST contact/checkout/newsletter
                                     ▼
   ┌─────────────────────────────────────────────────────────┐
   │              apps/web (Next.js 14 App Router)           │
   │                                                         │
   │   (marketing) ─┬─ /api/contact      INSERT leads        │
   │   (commerce)  ─┼─ /api/checkout     INSERT lead_events  │
   │                ├─ /api/newsletter   INSERT webhook_     │
   │                │                     deliveries(pending)│
   │                │                                        │
   │   (admin) ────┬─ /admin/login       iron-session        │
   │   middleware  ├─ /admin/dashboard   server components   │
   │   /admin/*    ├─ /admin/leads       lecture Drizzle     │
   │   /api/admin/*├─ /admin/leads/[id]  timeline + actions  │
   │                ├─ /admin/webhooks    CRUD endpoints     │
   │                └─ /admin/webhooks/[id]/deliveries       │
   │                                                         │
   │   /api/admin/cron/webhook-tick    (Vercel Cron, * * * * *)
   │     └── batch SELECT … SKIP LOCKED → fetch → UPDATE     │
   └────────────────┬────────────────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
  ┌──────────┐            ┌────────────────────┐
  │ Postgres │            │ Serveur partenaire │
  │ (Neon EU)│            │ (URL configurée)   │
  └──────────┘            └────────────────────┘
```

---

## 4. Surface fichier prévisible (non-exhaustive)

```text
apps/web/
├── src/
│   ├── middleware.ts                      ← garde /admin et /api/admin
│   ├── env.ts                             ← + IRON_SESSION_PASSWORD,
│   │                                        ADMIN_EMAIL,
│   │                                        ADMIN_PASSWORD_HASH,
│   │                                        DATABASE_URL,
│   │                                        CRON_SECRET,
│   │                                        WEBHOOK_MASTER_KEY
│   ├── app/
│   │   ├── (admin)/
│   │   │   ├── layout.tsx                 ← layout sobre Cormorant + Inter
│   │   │   ├── login/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── leads/
│   │   │   │   ├── page.tsx               ← liste filtrable
│   │   │   │   └── [id]/page.tsx          ← détail + timeline
│   │   │   └── webhooks/
│   │   │       ├── page.tsx               ← CRUD endpoints
│   │   │       └── [id]/deliveries/page.tsx
│   │   └── api/
│   │       └── admin/
│   │           ├── login/route.ts
│   │           ├── logout/route.ts
│   │           ├── leads/[id]/notes/route.ts
│   │           ├── leads/[id]/status/route.ts
│   │           ├── webhooks/route.ts
│   │           ├── webhooks/[id]/route.ts
│   │           ├── webhooks/[id]/replay/route.ts
│   │           └── cron/webhook-tick/route.ts
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts                  ← Drizzle client
│   │   │   ├── schema.ts                  ← tables + relations
│   │   │   └── migrations/                ← drizzle-kit
│   │   ├── auth/
│   │   │   ├── session.ts                 ← iron-session config
│   │   │   ├── password.ts                ← argon2 hash/verify
│   │   │   └── rate-limit.ts
│   │   ├── webhooks/
│   │   │   ├── mapper.ts                  ← mapLeadToWebhookPayload
│   │   │   ├── signer.ts                  ← HMAC-SHA256
│   │   │   └── deliver.ts                 ← logique retry + tick
│   │   └── schemas/
│   │       ├── admin-lead.ts              ← filtres, statut, notes
│   │       └── admin-webhook.ts           ← URL, secret, filtre
│   └── components/admin/
│       ├── LeadTable.tsx
│       ├── LeadFilters.tsx
│       ├── LeadDetail.tsx
│       ├── DeliveryTable.tsx
│       └── WebhookForm.tsx
└── vercel.json                             ← schedule du cron
```

---

## 5. Invariants à respecter (non négociables)

Repris de l'audit § 14 et des trois études :

1. **Cohabitation marketing** : le route group `(admin)` n'altère ni les
   layouts (marketing), (commerce), ni les routes publiques.
2. **Réutilisation existante** : Zod, react-hook-form, primitives UI
   (`Button`, `Field`, `Toast`, `ConfirmationModal`, `Container`,
   `Heading`, `Text`, `Stack`), palette `creme/encre/sauge/petale/ciel/
   champagne`, fonts Cormorant + Inter. Pas de stack parallèle.
3. **Voix de marque** : même privée, l'admin garde la typographie
   Cormorant pour les titres, Inter pour les tableaux, espaces généreux,
   accents `petale` ou `sauge` pour les states actifs. Pas de Material UI,
   pas de shadcn, pas de Tailwind UI templates.
4. **Sécurité par défaut** : tout `/admin/*` (sauf `/admin/login`) et
   `/api/admin/*` refuse en 401 toute requête sans session valide. Aucun
   fallback, aucune route admin "publique".
5. **Compatibilité Vercel serverless** : pas de processus permanent, pas
   d'état mémoire entre requêtes. Le worker webhook tourne dans un cron,
   pas dans un thread.
6. **Souveraineté des données** : aucun PII (email, téléphone, nom,
   adresse, IP) ne quitte le périmètre Vercel + Neon (DPA standards UE)
   sauf vers le partenaire explicitement configuré.
7. **Aucun lead silencieusement perdu** : tout lead entrant DOIT être
   persisté avant que `/api/contact` ou `/api/checkout` ne renvoie 200.
   Le webhook est asynchrone ; sa défaillance ne bloque pas la réponse.

---

## 6. Variables d'environnement à ajouter

| Variable | Type | Origine | Usage |
|---|---|---|---|
| `DATABASE_URL` | secret | Neon / Vercel Postgres | connexion Drizzle |
| `IRON_SESSION_PASSWORD` | secret 32+ chars | générée localement | chiffrement cookie session |
| `ADMIN_EMAIL` | public-ish | configurée par l'opérateur | identifiant unique |
| `ADMIN_PASSWORD_HASH` | secret | `argon2.hash()` localement | vérification login |
| `CRON_SECRET` | secret | injecté par Vercel | auth de l'endpoint cron |
| `WEBHOOK_MASTER_KEY` | secret | générée localement | chiffrement at-rest des secrets endpoints |

À documenter dans `.env.example` et validés à runtime via
`apps/web/src/env.ts` (Zod).

---

## 7. Ce qui est explicitement **hors périmètre** de cette recommandation

- **Multi-utilisateur admin** : un seul administrateur, conformément à la
  voix de marque. Ajout futur via la table `admin_users` (préparée mais
  non utilisée à v1).
- **Email transactionnel** : le câblage de Resend (déjà en env) sort du
  périmètre admin v1. Sera ajouté quand un événement nécessitera
  notification (ex. nouveau lead urgent).
- **Stripe** : déjà en env, non câblé, hors périmètre admin.
- **Analytics admin** (entonnoir, conversion par source) : v2 ; v1 se
  contente de compteurs simples.
- **Tests E2E Playwright de l'admin** : le projet déclare Playwright
  sans config ; un setup E2E dédié sortira d'un effort transverse.
- **Internationalisation de l'admin** : français uniquement.

---

## 8. Conformité & RGPD / loi 09-08

| Sujet | Position |
|---|---|
| Base légale collecte | exécution du contrat (commande), intérêt légitime (contact), consentement (newsletter) |
| Localisation des données | Neon `eu-central-1` (Francfort) ou Vercel EU |
| DPA | DPA standards Vercel + Neon suffisent (aucun tiers ajouté) |
| Droits d'accès | export CSV depuis admin, suppression possible (soft-delete + tombstone après 30 j) |
| Rétention | 12 mois leads non convertis, 5 ans leads convertis (obligation comptable Maroc) |
| Sortie vers partenaire (webhook) | base légale = exécution du contrat ; mention dans politique de confidentialité requise |
| Logs IP | nécessaires (anti-spam, audit) ; rétention 6 mois max |
| Notification CNDP (Maroc) | déclaration simplifiée ; à effectuer avant mise en prod |

---

## 9. Risques résiduels & mitigations

| Risque | Sévérité | Probabilité | Mitigation |
|---|---|---|---|
| Mot de passe admin compromis | élevée | faible | argon2id + rotation possible via `pnpm admin:rehash` |
| Cookie de session volé (XSS) | élevée | faible | cookies `httpOnly`, `sameSite=strict`, CSP renforcée à ajouter |
| Vercel Cron en panne | moyenne | très faible | commande CLI `pnpm webhook:tick` pour exécution manuelle |
| Backlog webhook > batch size | faible | faible | tunable (batch 50 → 200), monitoring sur `pending` count |
| Perte du `IRON_SESSION_PASSWORD` | moyenne | très faible | rotation supportée nativement par iron-session (multi-secret) |
| Migration Postgres ratée | moyenne | faible | drizzle-kit dry-run, backups Neon automatiques |
| Lead non persisté pour cause de DB down | élevée | très faible | retry inline 3×100 ms à l'INSERT, sinon 503 explicite (le visiteur retentera) |

---

## 10. Coût total estimé (12 mois, prod)

| Poste | Coût annuel |
|---|---|
| Vercel Pro | 240 $ |
| Neon (free tier ou Launch 19 $/mois) | 0–228 $ |
| Domaine | déjà en place |
| Service tiers webhook | 0 $ |
| Auth managé | 0 $ |
| **Total estimé** | **240 $ – 470 $** |

À comparer aux variantes écartées : Clerk (≥ 25 $/mois auth) + Inngest
(≥ 20 $/mois webhook) + Postgres = **300–500 $/an supplémentaires** sans
gain fonctionnel.

---

## 11. Livrables attendus à l'issue du plan d'action (futur)

À titre indicatif, le plan d'action devra produire :

- Migrations Drizzle (`leads`, `lead_events`, `admin_users`,
  `webhook_endpoints`, `webhook_deliveries`).
- Middleware `apps/web/src/middleware.ts`.
- Layout `(admin)` + pages login, dashboard, leads, webhooks.
- API admin (`login`, `logout`, leads notes/status, webhooks CRUD,
  cron tick, replay).
- Mapper `mapLeadToWebhookPayload` + tests.
- Branchement des routes `/api/contact`, `/api/checkout`,
  `/api/newsletter` → INSERT leads + INSERT webhook_deliveries.
- Documentation opérateur (`docs/admin/operations.md`) :
  comment générer un hash, faire tourner un seed, rejouer un webhook.
- Mise à jour `.env.example` et `apps/web/src/env.ts`.
- Tests (unitaires sur mapper, signer, password ; intégration sur
  middleware + routes admin).
- `vercel.json` pour le schedule cron.

---

## 12. Conclusion

Les trois services s'articulent autour d'un unique socle Postgres + Drizzle
hébergé en Europe. L'authentification reste minimale et souveraine. Le
webhook hérite naturellement de la même base sans nouveau service à
provisionner. L'UI vit entièrement dans la marque, sans dashboard tiers.
La pile reste serverless-friendly, sans dette technique externe, et
évolutive : si demain un volume 100× supérieur ou un workflow complexe
émerge, la migration vers une queue managée ou une auth multi-utilisateur
se fait sans casser le contrat existant.

**Cette recommandation est prête à servir de base au plan d'action
détaillé.**

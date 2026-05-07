# Décisions techniques transversales

> Décisions structurantes qui ne justifient pas d'ADR dédié (trop
> évidentes ou trop multi-aspects), mais qui sont actées et tracées
> ici.

---

## 1. Convention de nommage

| Catégorie | Convention | Exemple |
|---|---|---|
| Tables DB | `snake_case`, pluriel | `leads`, `webhook_endpoints` |
| Colonnes DB | `snake_case` | `created_at`, `endpoint_id` |
| Types TypeScript | `PascalCase` | `LeadStatus`, `WebhookPayload` |
| Variables | `camelCase` | `leadId`, `webhookSecret` |
| Constantes | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_ATTEMPTS` |
| Fichiers | `kebab-case` | `webhook-mapper.ts`, `lead-detail.tsx` |
| Routes admin | sous `(admin)/` | `(admin)/leads/[id]/page.tsx` |
| API admin | sous `/api/admin/` | `/api/admin/leads/[id]/status` |
| Tests | `*.test.ts` | `webhook-mapper.test.ts` |
| Tests MSW handlers | `handlers/*.ts` | `handlers/leads.ts` |
| Tests E2E | `*.spec.ts` Playwright | `e2e/login.spec.ts` |

## 2. Identifiants et clés primaires

- Tous les IDs métier sont des **CUIDs** (`@paralleldrive/cuid2`,
  collision-resistant, sortables-ish, URL-safe).
- Pas d'UUID v4 (moins lisibles dans les URLs et logs).
- Format : `cmokk1o9v08cer3tvasgohtw6` (compatible avec le format
  partenaire imposé).
- Préfixage par type interdit (pas de `lead_xxx`, `wh_xxx`) pour rester
  alignés avec le format webhook qui transporte un id "nu".

## 3. Format de date

- Stockage : `timestamptz` (Postgres), toujours en UTC.
- API : ISO 8601 (`2026-05-03T14:32:11.000Z`).
- Affichage admin : `Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Casablanca' })`.
- Format affiché : `3 mai 2026, 15:32` (heure locale Casablanca, GMT+1).

## 4. Replay manuel d'une livraison

```
Admin → bouton "Rejouer" sur /admin/leads/[id]
     → POST /api/admin/webhooks/deliveries/[id]/replay
     → server :
         - lit la delivery existante
         - vérifie qu'elle est en status 'failed' ou 'aborted'
         - INSERT new delivery {
             endpoint_id: original.endpoint_id,
             lead_id: original.lead_id,
             attempt: 1,                  // recompte à partir de 1
             status: 'pending',
             scheduled_for: NOW()
           }
         - INSERT lead_event {
             action: 'webhook_replayed',
             actor: session.email,
             metadata: { original_delivery_id, new_delivery_id }
           }
     → Réponse 200, le prochain cron tick traitera la nouvelle delivery
```

## 5. Stratégie de pagination

- **Cursor-based** sur `(created_at DESC, id DESC)` pour stabilité face
  aux INSERT concurrents.
- Taille de page par défaut : 25.
- Maximum : 100.
- Cursor = base64 d'un objet `{ createdAt, id }`.
- Pas de `OFFSET` (incohérences sur tables très actives).

## 6. Stratégie de filtrage

| Filtre | Source UI | SQL |
|---|---|---|
| Type | select | `WHERE type = $1` |
| Statut | multi-select (chips) | `WHERE status = ANY($1)` |
| Période | date range picker | `WHERE created_at BETWEEN $1 AND $2` |
| Ville | autocomplete (énum) | `WHERE city = $1` |
| Source | select | `WHERE source = $1` |
| Recherche | input texte | `WHERE search_tsv @@ plainto_tsquery('french', $1)` |

Index dédié `search_tsv` (généré via trigger) couvre `email`, `phone`,
`full_name`, `note`.

## 7. Logs structurés

Format : JSON line via `pino`.

```json
{
  "level": "info",
  "time": "2026-05-03T14:32:11.000Z",
  "service": "femiglow-admin",
  "actor": "elazhar@femiglow.ma",
  "action": "lead.status.changed",
  "leadId": "cmokk...",
  "from": "new",
  "to": "in_progress",
  "ip": "41.251.52.100",
  "duration_ms": 43
}
```

Niveaux : `debug`, `info`, `warn`, `error`. En prod, niveau minimum = `info`.

Sentry capture `error` automatiquement, plus les exceptions non-attrapées.

## 8. Variables d'environnement — règles

- Validées à runtime via Zod dans `apps/web/src/env.ts`.
- Aucune env var sensible exposée côté client (préfixe `NEXT_PUBLIC_`
  uniquement pour les vraiment publiques).
- Rotation possible sans casser les sessions actives :
  - `IRON_SESSION_PASSWORD` accepte un tableau de secrets (le premier
    sert à signer, les autres à déchiffrer les sessions existantes).
- `.env.example` est versionné, jamais `.env.local`.

## 9. Gestion des migrations

- `drizzle-kit generate` produit des SQL migrations dans
  `apps/web/src/lib/db/migrations/`.
- Numéro auto-incrémenté : `0000_initial.sql`, `0001_add_lead_events.sql`.
- Application en local : `pnpm db:migrate`.
- Application en prod : étape automatique du build Vercel
  (`postinstall` ou job dédié, configurable).
- Rollback : pas de DOWN migration (philosophie "forward-only"). Un
  rollback consiste à écrire une nouvelle migration qui inverse les
  changements.

## 10. Performance — budgets

| Indicateur | Budget |
|---|---|
| Latence p95 routes publiques | inchangée (≤ 800 ms TTFB) |
| Latence p95 GET /admin/leads | < 1.2 s TTFB |
| Latence p95 POST /api/admin/leads/[id]/status | < 300 ms |
| Latence p95 cron tick (batch 50) | < 30 s |
| Bundle JS admin (login + dashboard) | < 80 kB gzip |
| LCP /admin/dashboard | < 2 s |
| Score Lighthouse admin | ≥ 90 perf, ≥ 95 a11y |

## 11. Aspects rejetés explicitement

| Idée | Raison du rejet |
|---|---|
| WebSockets pour live updates admin | sur-ingénierie ; refresh manuel suffit pour ce volume |
| Service worker côté admin | aucune utilité offline |
| Internationalisation admin | un seul utilisateur francophone |
| Multi-tenant | fondatrice unique |
| GraphQL | route handlers REST simples + Server Components suffisent |
| tRPC | ajouterait une couche sans gain (Server Components couvrent les reads) |
| Redux / Recoil | Zustand déjà en place, suffit |
| Sessions DB-backed | iron-session sans backing DB suffit pour 1 user |
| Cookies session côté DB | overkill, attaque de surface accrue |

# Phases d'exécution

6 phases séquentielles, chacune avec objectif, scope, livrables, gates
de sortie.

---

## Phase 1 — Fondations (Sem. 1-2)

**Objectif** : poser le socle technique exécutable, sans feature métier.

### Scope
- Initialisation monorepo `apps/web` (Next.js 14 + TypeScript strict)
- Configuration ESLint, Prettier, Vitest, Playwright
- Setup Drizzle + Neon (compte créé, branche main, branche e2e)
- Déploiement Vercel initial (page placeholder)
- Pipeline CI GitHub Actions (lint + typecheck + vitest)
- Schéma DB v1 généré et appliqué sur Neon prod
- Sentry et logs structurés câblés
- Variables Vercel renseignées (production + preview)

### Livrables
- Repo public `femiglow-admin` avec README
- `https://femiglow.ma` répond 200 sur une page placeholder
- CI verte sur `main` après chaque push
- Tables DB visibles via `psql` Neon

### Tâches
ADM-001 à ADM-020 (cf. `taches-atomiques.csv`)

### Gate de sortie
- [ ] M1 atteint (CI verte)
- [ ] M2 atteint (schéma DB appliqué)
- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm lint` exit 0

---

## Phase 2 — Authentification + console leads (Sem. 3-6)

**Objectif** : fournir une console interne fonctionnelle pour la gestion
des leads.

### Scope
- Authentification admin (argon2id + iron-session 8h)
- Login form + page `/admin/login` + redirection
- Logout + révocation session
- Brute-force protection (5 tentatives / 15 min IP+email)
- Schéma `leads`, `orders`, `order_items`, `lead_events`
- Listing `/admin/leads` (filtres, pagination, tri)
- Détail `/admin/leads/[id]` (timeline, deliveries placeholders)
- Transitions de statut (Server Actions)
- Notes admin (création depuis détail)
- Audit trail sur toutes actions admin

### Livrables
- Login fonctionnel sur prod
- 1 admin réel (fondatrice) capable de consulter tous les leads
- Transitions de statut tracées dans `lead_events`
- Toutes les pages admin sont SSR (`force-dynamic`)

### Tâches
ADM-021 à ADM-060

### Gate de sortie
- [ ] M3 + M4 atteints
- [ ] Couverture vitest sur `lib/auth/*` ≥ 80 %
- [ ] E2E `e2e/auth-login.spec.ts` vert
- [ ] E2E `e2e/leads-detail.spec.ts` vert
- [ ] Audit DB : login admin → 1 ligne dans `audit_events`

---

## Phase 3 — Webhooks (Sem. 7-10)

**Objectif** : permettre à des systèmes tiers de recevoir des
notifications fiables sur les événements métier.

### Scope
- Schéma `webhook_endpoints`, `webhook_deliveries`
- CRUD endpoint dans `/admin/webhooks`
- HMAC SHA-256 signature + idempotency-key
- Stockage secret chiffré (`pgp_sym_encrypt`)
- Affichage du secret en clair une seule fois
- Bouton rotation secret
- Engine `enqueueDelivery` + `attemptDelivery`
- Vercel Cron `* * * * *` → `/api/cron/tick`
- Concurrency `FOR UPDATE SKIP LOCKED`
- Retry exponentiel `[60s, 5m, 30m, 3h, 12h]` avec jitter ±20 %
- Page deliveries `/admin/webhooks/[id]/deliveries` (liste + drawer)
- Bouton "Retry now"
- Anti-SSRF : URL https obligatoire, IP privées bloquées
- Mécanisme manuel d'enqueue (pas d'événement métier auto v1, sauf
  `lead.created` si déjà nécessaire)

### Livrables
- Endpoint webhook configurable depuis l'UI
- Cron tick exécuté chaque minute en prod (logs visibles)
- Test concret : un endpoint test (https://webhook.site/...) reçoit
  les payloads signés à chaque création de lead

### Tâches
ADM-061 à ADM-095

### Gate de sortie
- [ ] M5 atteint
- [ ] E2E `e2e/webhook-flow.spec.ts` vert
- [ ] 1 livraison réussie + 1 livraison `permanent` documentées
- [ ] Aucun crash cron sur 24h consécutives en preview

---

## Phase 4 — Tests + accessibilité (Sem. 11-13)

**Objectif** : verrouiller la qualité par la suite de tests cible.

### Scope
- Compléter MSW scenarios (45 fichiers)
- Compléter unit tests (~80 fichiers, viser 80 % coverage)
- Compléter E2E specs (~28 fichiers)
- Audit a11y manuel (clavier + lecteur d'écran)
- Intégration jest-axe sur tous composants critiques
- Intégration `@axe-core/playwright` sur les flows clés
- Lighthouse CI (perf > 80, a11y = 100)
- Documentation dans `docs/admin/specifications/08-tests/`

### Livrables
- Coverage report ≥ 80 % sur `lib/**`
- Tous les E2E verts en CI
- Zéro violation `@axe-core` sur les pages critiques

### Tâches
ADM-096 à ADM-125

### Gate de sortie
- [ ] M6 atteint
- [ ] `pnpm test:coverage` ≥ 80 % global
- [ ] `pnpm test:e2e` 0 fail
- [ ] Lighthouse a11y = 100

---

## Phase 5 — Hardening sécurité (Sem. 14-15)

**Objectif** : durcir l'application avant exposition publique.

### Scope
- Audit OWASP top 10 (manuel + outillé)
- Headers CSP avec nonce, HSTS, frame-ancestors none
- Rate-limiting par scope (login: 5/15m, api global: 60/min)
- Scan dépendances (`pnpm audit` + Snyk)
- Scan secrets (gitleaks pre-commit + CI)
- Pen test léger interne (Burp Suite, ZAP)
- Revue threat-model + status des contrôles
- Documentation incident-response + runbook
- Test de rotation des secrets en preview

### Livrables
- Rapport OWASP top 10 (PDF, 0 critique, ≤ 3 high)
- Toutes les dépendances à jour, aucun CVE high non corrigé
- Tous les contrôles `controles.csv` à `done` ou justifiés

### Tâches
ADM-126 à ADM-140

### Gate de sortie
- [ ] M7 atteint
- [ ] CSP en mode `enforce` (pas report-only)
- [ ] Scan gitleaks 0 fuite
- [ ] `pnpm audit --prod` 0 high

---

## Phase 6 — Go-live (Sem. 16)

**Objectif** : passer en production publique.

### Scope
- Tests de charge légers (200 req/s sur 5 min)
- Vérification PITR Neon (restauration test)
- Rotation initiale des secrets
- Migration finale prod
- Bascule DNS `femiglow.ma` (déjà en place — vérification)
- Monitoring complet activé (Sentry, UptimeRobot, alertes)
- Documentation utilisateur (manuel fondatrice)
- Formation fondatrice (1h démo + Q&A)

### Livrables
- Site public stable
- Fondatrice autonome sur la console
- Suivi 7 jours post-launch (oncall fondatrice + dev)

### Tâches
ADM-141 à ADM-150

### Gate de sortie (= go-live)
- [ ] M8 atteint
- [ ] Checklist `checklist-go-live.md` 100 % cochée
- [ ] Runbook `runbook-incident.md` validé en exercice
- [ ] PITR Neon testé (restauration < 30 min)
- [ ] Plan de rollback signé

---

## Boucle de feedback continue

Après go-live (M8 → M9), pas de nouveau scope. Focus :
- Surveillance KPI (uptime, latence, taux erreur)
- Bug fixes prioritaires
- Petites itérations basées sur retours fondatrice
- Préparation backlog v2 (export CSV, notifications email, multi-admin)

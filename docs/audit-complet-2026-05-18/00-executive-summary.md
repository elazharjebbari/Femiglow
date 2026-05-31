# 00 — Synthèse exécutive

**Projet** : Femiglow — site e-commerce marocain (gaine ventre / rituels), paiement à la livraison, multilingue partiel (FR + AR partiel).
**Date de l'audit** : 2026-05-18
**Périmètre** : monorepo `/var/www/femiglow` (apps/web Next.js 14 + Drizzle + Postgres + Stalwart/Listmonk + LLM Chat).
**Méthode** : lecture exhaustive du code (apps/web/src ≈ 263 k LOC), des 280+ documents `docs/`, des 304 commits sur 11 jours, et exécution de 5 audits parallèles spécialisés (architecture/back, front/UI/UX, data/sécurité, docs/conception, commits/process).

---

## 1. Verdict global

> **Codebase de qualité professionnelle, tier 1**, posée sur une stack moderne et bien tenue, avec une documentation interne d'un niveau exceptionnel rarement vu sur un projet privé. Trois familles de risques bloquent encore l'industrialisation : (1) PII en clair en base, (2) observabilité production presque inexistante, (3) deux chantiers récents (webhooks leads, infra email Stalwart) en mode "merge sans validation prod complète".

**Conformité aux exigences déclarées par le propriétaire :**

| Exigence | État | Commentaire |
|---|---|---|
| **Robuste** | 🟢 Bon | Idempotence webhooks, CAS stock, transactions Drizzle, retry exponentiel |
| **Fiable** | 🟡 Moyen | Tests sur les chemins critiques OK, mais analytics admin et mail non testés, pas de monitoring |
| **Pertinent** | 🟢 Bon | Choix techno cohérents avec l'objectif (Next.js, Drizzle, iron-session, LLM multi-provider) |
| **Haute qualité** | 🟢 Bon | TS strict, Zod systématique, ESLint+Prettier+husky, 95 % de scopes commits |
| **Maintenable** | 🟡 Moyen | Excellente sur lib/, fragile sur quelques composants > 600 LOC (CheckoutFlow, RitualsWizard, DeliveryCitiesEditor) |
| **Non régressif** | 🟡 Moyen | 394 tests unitaires + 59 e2e Playwright, mais CI sans gating obligatoire visible (pas de branch protection) |
| **Modulaire** | 🟢 Bon | Séparation `app/`, `lib/`, `components/` propre ; domaines (`lib/webhooks`, `lib/tracking`, `lib/chat`, `lib/checkout`) bien isolés |
| **Sécurisé** | 🟡 Moyen | Bonnes briques (Argon2id, CSP, HMAC, gitleaks) mais PII en clair, rate-limit partiel, pas de MFA |
| **Fonctionnel** | 🟢 Bon | Le funnel checkout, le chat, le tracking, l'admin tournent — bugs récents (webhooks step1, race Snap pixel) corrigés |

**Score global de maturité produit : 7,4 / 10.** Trois axes d'investissement permettent un passage rapide à 9 / 10 (cf. §5 + doc `09-roadmap-recommandations.md`).

---

## 2. Scores détaillés (résumé)

Détail dans chaque document spécialisé (`02` à `08`).

| Dimension | Score | Source |
|---|---|---|
| Typage & validation (TS strict + Zod) | 9 / 10 | `02-backend-api.md` |
| Architecture applicative & modularité | 8 / 10 | `01-architecture-stack.md` |
| Sécurité applicative (auth, CSP, CSRF, HMAC) | 8,5 / 10 | `05-securite-conformite.md` |
| Conformité RGPD (consent, droit oubli, PII) | 6 / 10 | `05-securite-conformite.md` |
| Tests automatisés (unit + e2e) | 6,5 / 10 | `07-tests-qualite-cicd.md` |
| CI/CD & process git | 7,5 / 10 | `07-tests-qualite-cicd.md` + `08-docs-process-dev.md` |
| Observabilité prod (logs, monitoring, alertes) | 3 / 10 | `05-securite-conformite.md` |
| DB & transactions | 9 / 10 | `04-data-modele.md` |
| Frontend / Design System | 8 / 10 | `03-frontend-ui-ux.md` |
| Accessibilité (a11y) | 8 / 10 | `03-frontend-ui-ux.md` |
| Performance front (LCP, cache, images) | 7,5 / 10 | `03-frontend-ui-ux.md` |
| Tracking & attribution | 8,5 / 10 | `06-tracking-conversion.md` |
| Documentation interne (`/docs`) | 9 / 10 | `08-docs-process-dev.md` |

**Tendance** : tout ce qui touche au cœur métier (commerce, tracking, chat) est solide. Tout ce qui touche à l'opérationnel prod (obs, backups testés, MFA, droit à l'oubli) est sous-investi.

---

## 3. Top 5 forces structurelles

1. **Stack moderne maîtrisée**. Next.js 14 App Router, TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`), Drizzle ORM typé, Zod systématique sur les payloads. Aucun `any` détecté sur les routes critiques.
2. **Idempotence et atomicité au cœur du commerce**. Middleware `withIdempotency` sur `lead_create / order_create / address_update / payment_update`, réservation de stock CAS (compare-and-swap), webhook deliveries dédupliquées via index `UNIQUE(endpoint_id, idempotency_key)`. C'est *le* signe d'un backend conçu par quelqu'un qui sait ce qu'il fait.
3. **Documentation hors-norme** (≈ 280 fichiers `.md`, 80 k lignes). Gabarit reproductible *cahier → architecture → data → backend → frontend → tests → runbook* appliqué sur les modules majeurs (chat, gtm, tracking, checkout, emailing, media…). Trois audits frais (lead webhook, Stalwart email, chat v2) très précis, datés, actionnables.
4. **Discipline git remarquable**. 304 commits en 11 jours, 97,8 % conformes Conventional Commits, 95,2 % avec scope (`feat(tracking)`, `fix(webhooks)`…). Pre-commit hooks gitleaks + migration validator + lint-staged. Pipeline CI : lint + typecheck + Vitest + Lighthouse (a11y exigé à 1.0).
5. **Tracking et conformité avancés**. Consent Mode v2 Google (defaults `denied`), HMAC sur webhooks entrants ET sortants, CAPI Meta v2.15 + Snap v3 alignés, déduplication par `eventId`, plans tracking versionnés en base. Crawlers IA bloqués par `robots.txt` (GPTBot, CCBot, ClaudeBot).

---

## 4. Top 5 risques / faiblesses

| # | Risque | Sévérité | Doc détaillé |
|---|---|---|---|
| **R1** | **PII en clair** dans `leads.email/phone/name`, `chat_lead`, adresses livraison. Si Postgres compromis → fuite directe. | 🔴 P0 | `05-securite-conformite.md` |
| **R2** | **Observabilité quasi nulle** : pas de Sentry actif, pas de métriques, `instrumentation.ts` vide. Incidents détectés post-mortem (cf. audit webhooks 2026-05-16). | 🔴 P0 | `05-securite-conformite.md` |
| **R3** | **Rate-limiting partiel**. Mail et chat couverts (dual session+IP), mais `/api/checkout/lead`, `/api/contact`, `/api/newsletter` exposés au spam. | 🟠 P1 | `02-backend-api.md` + `05-securite-conformite.md` |
| **R4** | **Pas de branch protection visible** sur `master`. 304 commits, 33 merges, mais aucune trace de PR review obligatoire. Hook `commit-msg` absent → Conventional Commits non *enforced*. | 🟠 P1 | `07-tests-qualite-cicd.md` + `08-docs-process-dev.md` |
| **R5** | **Composants godzilla**. `CheckoutFlow` (625), `RitualsWizard` (1017), `DeliveryCitiesEditor` (1117), `LeadFormBubble` (451) : 14 `useState` + handlers + JSX dans un seul fichier. Fragilise le refactor et la testabilité du tunnel commerce. | 🟠 P1 | `03-frontend-ui-ux.md` |

**Risques secondaires** : `dangerouslyAllowSVG: true` (XSS résiduel), CSP `'unsafe-inline'` sur scripts (Next.js 14 RSC limitation), absence de droit à l'oubli RGPD effectif, `.env.bak.*` non vérifiés, pas de MFA admin, soft-delete absent sur leads/orders, 47 `console.log` résiduels en prod.

---

## 5. Roadmap consolidée (résumé)

Plan en 3 phases, ≈ 8 semaines plein-temps ou 12 sem à 0,7 ETP.

### Phase 1 — *Sécurisation & observabilité* (S1–S2, ~80 h)
- Intégrer Sentry + health checks externes (UptimeRobot ou équivalent).
- Chiffrer PII (`leads.phone`, `leads.email`, adresses) via AES-256-GCM, même mécanisme que `webhook_endpoints.encryptedSecret`.
- Rate-limit middleware global sur `/api/*` publics critiques.
- Vérifier que `.env.bak.*` ne sont pas trackés ; ajouter `.env*` à `.gitignore` strict.
- Activer branch protection sur `master` (PR review obligatoire, CI required), ajouter hook `commit-msg` (commitlint).

### Phase 2 — *Modularité & conformité* (S3–S5, ~120 h)
- Refactor `CheckoutFlow`, `RitualsWizard`, `DeliveryCitiesEditor`, `LeadFormBubble` (extraction hooks + sous-composants + `useReducedMotion` Framer Motion).
- Soft-delete sur `leads`, `orders`, `chat_lead`. Endpoint `/api/admin/data-subject/delete` (cascade + pseudonymisation).
- MFA TOTP sur `/admin/login` + IP binding optionnel sur session iron-session.
- Compléter tests : crypto, mail transactional, analytics admin (~40 routes non testées).
- Indexer `user_event` (`(email, ts DESC)`, `(event_name, ts DESC)`, GIN sur `properties`).
- Finaliser **trois chantiers en flottement** identifiés dans `/docs` :
  - webhooks leads (config `OUTBOUND_WEBHOOK_URL` prod, inline-contact dispatch),
  - Stalwart email (SPF correct, Redis password, compte `noreply@`),
  - geo-promo header (route `/api/promo/location` + tests staging).

### Phase 3 — *Industrialisation* (S6–S8, ~80 h)
- Migrer rate-limit en mémoire → Redis/DB (multi-instance).
- Upgrade Next.js 15 + CSP `strict-dynamic` (supprimer `'unsafe-inline'` sur scripts).
- CHANGELOG automatique (semantic-release), tags versionnés.
- Tests E2E Playwright étendus : checkout complet wizard + chat lead capture + admin flow.
- Backup quotidien Neon PITR + dry-run restore mensuel sur staging.
- Index racine `/docs/README.md` + statuts 🟢🟡🔴 sur tous les docs majeurs + archivage des dossiers vides (`kolenda/`, `videos/`).

---

## 6. Documents de cet audit

| Doc | Sujet |
|---|---|
| [`00-executive-summary.md`](./00-executive-summary.md) | (ce document) |
| [`01-architecture-stack.md`](./01-architecture-stack.md) | Stack, monorepo, configs, organisation `src/` |
| [`02-backend-api.md`](./02-backend-api.md) | 279 routes API, patterns, validation, idempotence |
| [`03-frontend-ui-ux.md`](./03-frontend-ui-ux.md) | Composants, design system, a11y, perf, i18n |
| [`04-data-modele.md`](./04-data-modele.md) | 92 tables, migrations, indexes, flux de données |
| [`05-securite-conformite.md`](./05-securite-conformite.md) | Auth, CSP, secrets, PII, RGPD, observabilité |
| [`06-tracking-conversion.md`](./06-tracking-conversion.md) | CAPI, Snap, GTM, consent, attribution |
| [`07-tests-qualite-cicd.md`](./07-tests-qualite-cicd.md) | Tests, CI, hooks, Lighthouse, monitoring |
| [`08-docs-process-dev.md`](./08-docs-process-dev.md) | Audit du `/docs` existant + process commits/PR |
| [`09-roadmap-recommandations.md`](./09-roadmap-recommandations.md) | Roadmap P0/P1/P2 + estimations + KPIs |
| [`README.md`](./README.md) | Index de navigation |

---

## 7. Comment lire cet audit

- **Décideur / propriétaire** : lis ce document `00`, puis `09-roadmap-recommandations.md`. ≈ 20 min.
- **Lead dev / architecte** : `00` → `01` → `02` → `04` → `05` → `09`. ≈ 1 h.
- **Dev front / designer** : `00` → `03` → `06`. ≈ 30 min.
- **DPO / RSSI** : `00` → `05` → `06` (consent) → `08` (process). ≈ 45 min.
- **QA / SRE** : `00` → `07` → `09`. ≈ 30 min.

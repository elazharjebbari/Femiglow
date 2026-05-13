# 80.7 — Runbook améliorations 2026-05

> Plan d'action post-livraison M0–M4 pour corriger les bloquants production
> et les manques fonctionnels identifiés par audit.

## Pourquoi

L'audit a relevé 22 gaps. Ce runbook se concentre sur **8 phases** ordonnées
par criticité réelle (bloquants prod d'abord, UX ensuite). Hors scope ici :
i18n AR-MA, PDF export, git sync, Sentry hooks (V1.1).

## Phases

| # | Titre | Estimation | Tests ajoutés |
|---|---|---|---|
| P1 | ETag / optimistic locking | 1h | unit publish + integration PATCH + RTL conflict modal |
| P2 | Cache invalidation tags | 45min | integration : revalidateTag appelé sur publish/PUT |
| P3 | Rate limiting | 45min | integration : burst → 429 + Retry-After header |
| P4 | CSRF via Origin check | 30min | integration : 403 sans Origin / Origin mismatch |
| P5 | 4-eyes workflow | 30min | publish.test.ts : refuse si publisher == submitter |
| P6 | Wizard 5-steps create page | 1h30 | RTL component + Playwright e2e end-to-end |
| P7 | History drawer + diff | 1h | API /diff + drawer RTL + Playwright |
| P8 | Slug redirects + robots | 1h | migration + unit redirects + Playwright 301 |

Total ≈ 7h. Chaque phase = 1 commit atomique.

## Conventions tests

- **Vitest unit** : `src/lib/legal/*.test.ts` — fonctions pures.
- **Vitest intégration** : `src/test/integration/legal-*.test.ts` — route
  handlers avec mocks repo. Pattern : 1 fichier par groupe de routes.
- **RTL composant** : `src/components/admin/legal/__tests__/*.test.tsx` —
  MSW handlers depuis `legal-handlers.ts` (déjà partagé).
- **Playwright e2e** : `e2e/legal-*.spec.ts` — skip propre si DB vide /
  auth absente, comme les specs existants.

## P1 — ETag / optimistic locking

### Diagnostic
PATCH `/api/admin/legal/[slug]` accepte n'importe quel payload sans
contrôler la version. Deux admins ouvrent l'éditeur, l'un sauve, l'autre
sauve → 2nd écrase le 1er sans warning. L'auto-save 30s aggrave.

### Solution
- GET admin renvoie `ETag: W/"<version>"`.
- PATCH lit `If-Match`, compare à la version courante, renvoie **409
  `version_conflict`** si mismatch.
- LegalEditor : intercepte 409, ouvre modal "page modifiée par X, recharger ?".

### Tests
- `publish.test.ts` ou nouveau `repository-conflict.test.ts` : updateLegalPage
  refuse update si version != expected (helper conditionalUpdate).
- `legal-api-admin.test.ts` ajouts :
  - GET retourne header ETag.
  - PATCH 409 si If-Match obsolète.
  - PATCH 200 si If-Match correct.
- `LegalEditor.test.tsx` ajout : 409 ⇒ dialog "conflict" visible.

## P2 — Cache invalidation tags

### Diagnostic
`revalidatePath('/legal/cgv')` invalide la page rendue mais pas la route
API `/api/legal/[slug]` (force-static, revalidate=300). Le footer (qui
consomme `/api/legal/placements/footer-main`) peut afficher la vieille
liste jusqu'à 5 min.

### Solution
- Wrapper `cachedFetchPublishedLegalPage(slug)` via `unstable_cache` avec
  tag `legal-page:<slug>`.
- Wrapper `cachedListPlacementsForZone(zone)` avec tag `legal-zone:<zone>`.
- `revalidateTag('legal-page:cgv')` sur publish + patch.
- `revalidateTag('legal-zone:footer-main')` sur placements PUT.

### Tests
- `legal-api-admin.test.ts` : mock `revalidateTag` (déjà fait pour
  `revalidatePath`), vérifier appels avec les bons tags.

## P3 — Rate limiting

### Diagnostic
Endpoints publics non rate-limités. Un loop POST publish peut épuiser
les writes (publish = INSERT history + UPDATE page + insertion audit).

### Solution
- `/api/legal/[slug]` : 60 req/min/IP (X-Forwarded-For).
- `/api/legal/placements/[zone]` : 120 req/min/IP.
- `/api/admin/legal/[slug]/publish` : 5 req/min/admin.
- `/api/admin/legal/health/recheck` : 1 req/min/admin (HTTP fan-out lourd).

Réutiliser `checkRateLimit` (memory store déjà en place).

### Tests
- `legal-api-rate-limit.test.ts` : N+1 requêtes consécutives → la N+1
  renvoie 429 + Retry-After + X-RateLimit-Remaining.

## P4 — CSRF Origin check

### Diagnostic
Pas de protection explicite sur les mutations admin. SameSite=Lax bloque
la majorité des CSRF cross-site, mais :
- iframes / forms html sans JS peuvent contourner Lax sur POST top-level.
- Defense-in-depth standard recommandé.

### Solution
- Helper `requireSameOrigin(request)` lisant `Origin` ou `Referer`,
  comparant à `NEXT_PUBLIC_SITE_URL`. 403 si mismatch.
- Appliqué sur toutes les routes admin avec method != GET/HEAD/OPTIONS.

### Tests
- `legal-api-admin.test.ts` ajouts : POST/PATCH/DELETE/PUT avec Origin
  étranger → 403 ; Origin matchant → 200.

## P5 — 4-eyes workflow

### Diagnostic
Aujourd'hui un seul admin peut faire submit-review puis publish, le
review humain est cosmétique.

### Solution
- `publishLegalPage` : si `page.status === 'review'` et `page.submittedBy ===
  actorId`, refuser avec code `same_actor`. Sauf si
  `require_legal_review === false` (livraison, FAQ).
- Réponse 422 `error: { code: 'same_actor', message: '...' }`.
- UI : modal publish désactivée + tooltip si current admin est le
  submitter.

### Tests
- `publish.test.ts` : new file ; cas same_actor refusé, different actor OK.
- `legal-api-admin.test.ts` : publish renvoie 422 same_actor.

## P6 — Wizard create page

### Diagnostic
Pas d'UI pour créer une nouvelle page. POST /api/admin/legal direct only.

### Solution
- `/admin/legal/new` route + composant `LegalWizard` (5 steps):
  1. Slug + Title + Description
  2. Body MD (textarea + variables hint)
  3. Zones (placements initiaux)
  4. Variables (vérification des `{{X}}` utilisées dans body)
  5. Preview + submit
- Validation step-par-step, navigation back/forward.
- Submit final → POST + redirect vers `/admin/legal/[slug]/edit`.

### Tests
- `LegalWizard.test.tsx` : navigation entre steps, validation slug,
  detect vars dans body, submit final.
- `e2e/admin-legal-wizard.spec.ts` : Playwright happy path.

## P7 — History drawer + diff

### Diagnostic
API history/restore existent, sans UI. Pas de diff.

### Solution
- API `GET /api/admin/legal/[slug]/diff/[v1]/[v2]` :
  - Récupère snapshots v1, v2 de l'historique.
  - Diff `body_md` avec `jsdiff` (déjà transitive via remark) → renvoie
    array de hunks JSON.
- Composant `LegalHistoryDrawer` (client) :
  - Trigger button dans LegalEditor "Historique".
  - Liste les versions, sélection ⇒ affiche diff + restore button.

### Tests
- `legal-api-admin.test.ts` : GET diff renvoie hunks, 404 si version
  inconnue.
- `LegalHistoryDrawer.test.tsx` : liste versions, sélection, restore.

## P8 — Slug redirects + robots

### Diagnostic
Renommer une page perd le SEO (et casse les anciens liens externes).
Robots.txt n'empêche pas le crawl des noindex.

### Solution
- Migration 0033 : table `legal_slug_redirects(old_slug PK, new_slug,
  created_at)`.
- Hook dans `updateLegalPage` : si slug change, INSERT redirect (mais
  notre schéma a slug en UNIQUE, pas en PK ; ID séparé → on peut
  changer le slug). Pour V1 : pas de rename UI, mais helper côté
  middleware + table prête pour V2.
- Middleware Next.js : si `/legal/<old>` matche la table → 301 vers
  `/legal/<new>`.
- `robots.ts` mis à jour : Disallow `/admin/legal/*` (déjà couvert par
  CSP/header, mais explicite côté robots).

### Tests
- Migration applicable.
- `legal-redirects.test.ts` : helper lookupRedirect retourne new_slug.
- `e2e/legal-redirects.spec.ts` : visite `/legal/<old>` → 301 + Location.

## Ordre d'exécution

P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8. Indépendants techniquement, mais
ordre par criticité (P1–P4 = prod blockers).

Chaque phase : un commit `feat(legal-pages): P<N> — <titre>` avec les
tests ajoutés. Pas de squash entre phases (audit trail).

## Statut d'exécution (2026-05-13)

| Phase | Commit | Tests ajoutés | Statut |
|---|---|---|---|
| P1 | `e84f5ff` | 16 (5 unit + 4 int + 2 RTL + 5 MSW scenario) | ✅ |
| P2 | `75d5a46` | 3 (assertions revalidateTag) | ✅ |
| P3 | `c04cbba` | 7 integration (burst, isolation, Retry-After) | ✅ |
| P4 | `0eca189` | 37 (10 unit + 27 integration paramétrés) | ✅ |
| P5 | `6e8ff1a` | 9 (8 unit publish + 1 integration) | ✅ |
| P6 | `745a3a4` | 8 RTL (navigation + soumission complète) | ✅ |
| P7 | `e1598ca` | 19 (10 unit diff + 3 int + 6 RTL drawer) | ✅ |
| P8 | `eda3f30` | 5 (4 unit redirects + 1 int 301) | ✅ |

**Total tests legal après runbook : 207 (vs 111 avant) — +96 tests.**

## Validation finale

- ✅ `vitest run src/lib/legal/ src/components/admin/legal/ src/test/integration/legal-api-*` :
  207/207 verts en ~34s (19 fichiers).
- ✅ Pas de régression sur les 111 tests pré-runbook.
- ✅ `tsc --noEmit` 0 erreur sur les fichiers legal.
- ⏳ Playwright e2e : les specs existantes (`legal-public`, `admin-legal`,
  `legal-a11y`) restent compatibles. Nouveaux specs e2e pour P6/P7 à
  ajouter en V1.1.

## Migration à appliquer

Migration 0033_legal_slug_redirects.sql à exécuter en pre-deploy :

```bash
pnpm drizzle-kit migrate
```

Idempotent (CREATE IF NOT EXISTS). Pas de seed nécessaire — table vide
au démarrage.

## P9 — Cohérence ecosystème admin (2026-05-13)

Phase d'alignement avec les patterns admin existants après audit
"toutes les interfaces sont-elles accessibles ?".

| Sous-phase | Commit | Statut |
|---|---|---|
| P9.1 nav defaults inclut 'legal' | `e2ea65b` | ✅ |
| P9.6 RBAC inclut 'legal' | `e2ea65b` (couplé P9.1) | ✅ |
| P9.2 audit UI onglet legalPage | `39be852` | ✅ |
| P9.3 dashboard card "Pages légales" | `2a964f6` | ✅ |
| P9.4 styling alignment (pattern SEO) | `3f34afa` | ✅ |
| P9.5 slug redirects UI | `555f3b0` | ✅ |

**Résultats P9 :**
- `admin-config/defaults.ts` : nav inclut 'legal' (pos 4 entre media et
  tracking), matrice RBAC inclut 'legal' pour les 4 rôles (superadmin /
  admin / editor / viewer).
- `/admin/audit?resource=legalPage` : onglet dédié, labels FR pour les 9
  actions legal.*, lien direct vers `/admin/legal/<slug>/edit` depuis la
  colonne Cible.
- `/admin` dashboard : card "Pages légales" avec 4 KPIs (Total / Publiées
  / En revue / Brouillons) + warning orphelines + lien "Voir tout".
- Styling : boutons + inputs respectent le pattern SEO (rounded-md,
  hover stone-50/700, font-medium, bg-white).
- `/admin/legal/redirects` : UI CRUD complète pour `legal_slug_redirects`
  (formulaire ajout, table avec suppression, gestion erreurs 400/409/500).

**Tests P9 : +60 tests.**

## V1.1 — Pistes restantes

Non couvertes par ce runbook (hors scope) :
- i18n AR-MA (RTL, routing /ar/legal/).
- PDF export pour le juriste.
- Git sync sur branche orpheline.
- Sentry + PostHog hooks legal.
- Search / filter sur la liste admin.
- Autocomplete `{{VARS}}` dans l'éditeur.
- Variable usage warning ("touche {{X}} → 5 pages publiées à republier").
- Bulk republish après changement de variable.
- RBAC enforcement runtime : les permissions sont déclarées dans
  `defaults.ts` mais non enforced côté routes (requireAdmin actuel = toute
  admin OK). Brancher un middleware permissions par route admin pour
  activer la matrice viewer/editor/admin/superadmin.

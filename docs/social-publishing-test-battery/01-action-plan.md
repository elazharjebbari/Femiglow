# Plan d'action — Social Publishing Test Battery

> **Lecture** : ce document décrit **quoi** et **pourquoi** par phase. Pour le **comment**, voir `implementation/phase-*.md`. Pour l'**exécution**, voir `00-runbook.md`.

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1 — Foundations  (1 j-p)                              │
│   • Catalogue MSW handlers (14 routes × variants)           │
│   • Fixtures (accounts, jobs, posts, postiz responses)      │
│   • Helpers Playwright partagés                             │
├─────────────────────────────────────────────────────────────┤
│ Phase 2 — Component tests  (2 j-p)                          │
│   • PublishActionGroup, JobQueue, QuickEditDrawer,          │
│     Calendar, CalendarCard, AccountHealthCard,              │
│     LibraryClient                                           │
├─────────────────────────────────────────────────────────────┤
│ Phase 3 — Contract tests  (1 j-p)                           │
│   • 9 routes × 6 cas chacune (200/400/401/404/409/500)      │
├─────────────────────────────────────────────────────────────┤
│ Phase 4 — Unit tests  (1 j-p)                               │
│   • state-machine, retry, errors, idempotency               │
│   • postiz adapter, dry-run adapter                         │
├─────────────────────────────────────────────────────────────┤
│ Phase 5 — E2E mocked  (2 j-p)                               │
│   • 12 specs Playwright avec MSW page.route                 │
├─────────────────────────────────────────────────────────────┤
│ Phase 6 — Cross-cutting  (0.5 j-p)                          │
│   • a11y axe, dark mode, responsive, keyboard               │
├─────────────────────────────────────────────────────────────┤
│ Phase 7 — Live Instagram AlFenna Beauty  (1 j-p)            │
│   • Opt-in strict E2E_LIVE_POSTIZ=1                         │
│   • 1 post test + cleanup + 4 vérifications                 │
├─────────────────────────────────────────────────────────────┤
│ Phase 8 — Correction loop + coverage  (0.5 j-p)             │
│   • 3 runs anti-flake                                       │
│   • Coverage targets atteints                               │
└─────────────────────────────────────────────────────────────┘
```

## Dépendances entre phases

```
Phase 1 (foundations) ────► Phase 2 ────► Phase 5 ────►┐
                       ────► Phase 3 ────►              ├─► Phase 8
                       ────► Phase 4 ────►              │
                                                        │
                            Phase 6 (transverse) ───────┤
                            Phase 7 (live) ─────────────┘
```

Phase 1 fonde le reste (mocks + fixtures + helpers). Phases 2/3/4 sont parallélisables. Phase 5 dépend de 2 (composants prêts) et 1 (handlers). Phase 6 transverse à 2/5. Phase 7 dépend de tout (la chaîne doit marcher avant de la pousser en réel). Phase 8 consolide.

---

## Phase 1 — Foundations

### Pourquoi
Sans une source de vérité unique des mocks et fixtures, les phases suivantes dériveront. Phase 1 = socle commun.

### Quoi
1. **MSW catalog enrichi** `src/test/msw/social-publishing-handlers.ts`
   - 14 routes principales × variants (200, 4xx, 5xx, idempotent replay)
   - Réutilisable Vitest + Playwright (via shared exports)
2. **Fixtures versionnées** `src/test/fixtures/social-publishing/`
   - 5 comptes (4 statuts × 2 plateformes)
   - 8 jobs (chaque statut + retries + cancellations)
   - 3 posts (approved, scheduled, published)
   - Postiz responses (upload, posts/now, posts/schedule, posts/draft, analytics, errors)
3. **Playwright helpers** `e2e/social-publishing/helpers.ts`
   - `registerPublishMocks(page)` — pose tous les `page.route(...)` en une fonction
   - `driveToPublishEnabled(page)` — automate jusqu'au moment où le dropdown Publier est actif
   - `assertJobAppears(page, jobId, status)` — attente structurée d'une row JobQueue

### Risques
- Si les fixtures ne reflètent pas la vraie shape API → tests cassent au merge. Mitigation : valider contre les schemas Zod réels.

### Validation
- Snapshot des fixtures contre les types TypeScript
- Tests de smoke sur 2-3 handlers (sanity)

---

## Phase 2 — Component tests

### Pourquoi
Le code UI est ce que l'opérateur touche. Les bugs visibles sont là. Couvrir chaque composant à ≥ 85% identifie 80% des régressions avant E2E.

### Quoi
Pour chaque composant, couvrir :
- **Rendu initial** (états vide, chargé, erreur)
- **Interactions clavier + souris** (clic, hover, focus, tab)
- **Props edge cases** (null, undefined, listes vides, très longues)
- **Callbacks** (vérifier les arguments)
- **Accessibilité** (rôles, aria-labels, focus visible)
- **Comportement async** (loading → success / error)

### Composants ciblés
| Composant | Fichier | Tests estimés | Statut |
|-----------|---------|---------------|--------|
| PublishActionGroup | `create/PublishActionGroup.test.tsx` | 18 | étendre |
| JobQueue | `plan/JobQueue.test.tsx` | 16 | créer |
| QuickEditDrawer | `plan/QuickEditDrawer.test.tsx` | 12 | créer |
| Calendar | `plan/Calendar.test.tsx` | 14 | créer |
| CalendarCard | `plan/CalendarCard.test.tsx` | 10 | créer |
| AccountHealthCard | `home/AccountHealthCard.test.tsx` | 8 | créer |
| LibraryClient | `library/LibraryClient.test.tsx` | 12 | créer/étendre |
| MockModeBadge | `create/MockModeBadge.test.tsx` | 4 | existant |
| **Total** | | **~94 tests** | |

### Validation
- 0 fail
- Coverage ≥ 85% lignes par composant

---

## Phase 3 — Contract tests

### Pourquoi
Les routes API sont le contrat entre UI et services. Si la shape dérive, l'UI casse en silence.

### Quoi
Pour chaque route, valider :
- 200 / 201 success path
- 400 sur chaque champ requis manquant + chaque enum invalide
- 401 sans auth
- 404 ressource introuvable
- 409 état métier invalide (déjà publié, déjà annulé, etc.)
- 429 rate-limit
- 500 service down

### Routes ciblées
| Route | Tests estimés |
|-------|---------------|
| `POST /posts/:id/publish-now` | 8 |
| `POST /posts/:id/schedule` | 9 (dont validation date) |
| `POST /posts/:id/draft-on-provider` | 7 |
| `POST /posts/:id/cancel` | 6 |
| `PATCH /posts/:id/reschedule` | 7 |
| `GET /publish-jobs` | 6 |
| `POST /publish-jobs/:id/retry` | 6 |
| `POST /publish-jobs/:id/cancel` | 6 |
| `POST /postiz/integrations/sync` | 5 |
| **Total** | **~60 tests** |

### Validation
- 100% des routes ont ≥ 6 cas couverts
- 0 fail

---

## Phase 4 — Unit tests

### Pourquoi
Les services pure-function (state-machine, retry, errors, idempotency) doivent être à 100% blindés — c'est la couche la plus critique.

### Quoi
| Module | Tests estimés |
|--------|---------------|
| `state-machine.ts` | 22 (8 statuts × transitions valides + invalides) |
| `retry.ts` | 10 (backoff exact, max attempts, transient codes) |
| `errors.ts` | 14 (table HTTP → code) |
| `idempotency` | 6 (cache hit, race, TTL, key collision) |
| `adapters/postiz.ts` | 18 |
| `adapters/dry-run.ts` | 8 |
| `worker.ts` | 10 (lock acquire, scheduled due, max per run) |
| **Total** | **~88 tests** |

### Validation
- Couverture services ≥ 80%
- 0 fail

---

## Phase 5 — E2E mocked

### Pourquoi
Les E2E avec mocks reproduisent fidèlement le parcours opérateur, sans dépendance externe → déterministes + rapides + reproductibles en CI.

### Quoi
12 specs Playwright (cf liste dans `00-runbook.md` Phase 5). Chaque spec couvre un scénario `S01..S12` du dossier `scenarios/`.

### Validation
- 100% des 12 specs passent
- < 60 secondes total run
- 0 flake sur 3 runs

---

## Phase 6 — Cross-cutting

### Pourquoi
A11y, dark mode, responsive, keyboard sont régulièrement oubliés. Un spec dédié par axe.

### Quoi
- `a11y.spec.ts` — axe-core scan sur 4 pages (create, plan, library, home)
- `dark-mode.spec.ts` — snapshots `prefers-color-scheme: dark`
- `responsive.spec.ts` — 1440 / 1024 / 414 (aucun overflow)
- `keyboard.spec.ts` — Tab order, Esc, Cmd+S

### Validation
- 0 violation axe critical
- 0 régression visuelle dark mode
- 0 overflow horizontal
- Raccourcis clavier fonctionnels

---

## Phase 7 — Live Instagram (AlFenna Beauty)

### Pourquoi
Le mock garantit que le client UI fonctionne. Le live garantit que la chaîne réelle marche : OAuth Postiz, mapping payload, upload média, post Instagram, callback DB, audit log, cleanup.

### Quoi
**Spec unique** : `e2e/social-publishing/live-instagram-alfenna.spec.ts`
- Marqué `@live`
- Skipped sans `E2E_LIVE_POSTIZ=1`
- Workflow :
  1. Création d'un post test (caption + image FemiGlow brand-safe)
  2. Approve → publish-now sur le compte Postiz AlFenna
  3. Wait Postiz processing (~30s polling)
  4. Vérifications :
     - `content_postiz_delivery.status='sent'` et `postizPostId` non null (via API admin)
     - GET Postiz `/api/public/v1/posts/{postizPostId}` retourne le post avec permalink
     - Audit log `social.publish.published` présent
  5. Cleanup : DELETE Postiz post + audit log `social.publish.cleaned`

Voir `05-live-testing-protocol.md` pour le détail (gates, cleanup, recovery si crash).

### Validation
- Le post test apparaît bien sur Instagram (vérif manuelle ou via permalink)
- 4 assertions passent
- Cleanup réussi

### Risques
- Post visible aux abonnés AlFenna → utiliser caption marquée "TEST AUTOMATIQUE" + image neutre
- Coût Postiz/Instagram API → 1 appel publish + 1 delete = ~$0.02 par run
- Compte temporairement publié → cleanup obligatoire dans les 60s
- Rate limit Instagram → max 1 run / 30min

---

## Phase 8 — Correction loop + coverage

### Pourquoi
Verrouille les acquis. Sans run 3× identique, on n'est pas safe.

### Quoi
1. **Loop** : fix → re-run isolé → module → full ; documenter
2. **Anti-flake** : 3 runs E2E (sans @live) identiques
3. **Coverage** :
   - Composants `/create` + `/plan` : ≥ 85%
   - Services `lib/social-publishing` : ≥ 80%
   - Routes API `app/api/admin/content-studio/posts/*` + `publish-jobs/*` : ≥ 80%
   - Global : ≥ 75%
4. **REGRESSION_NOTES.md** : 1 entrée par fix significatif (avec cause root)

### Validation
- 0 fail global
- 3 runs identiques
- Cibles atteintes

---

## Estimation effort

| Phase | Effort dev (j-h) | Effort QA (j-h) |
|-------|------------------|-----------------|
| 1 | 1.0 | 0.5 |
| 2 | 2.0 | 0.5 |
| 3 | 1.0 | 0.5 |
| 4 | 1.0 | 0.5 |
| 5 | 2.0 | 0.5 |
| 6 | 0.5 | 0.5 |
| 7 | 1.0 | 1.0 |
| 8 | 0.5 | 1.0 |
| **Total** | **9.0** | **5.0** |

Total ≈ 14 jour-personne (≈ 3 semaines à plein temps avec relecture).

---

## Critères de succès du plan global

1. Les 43 features ont chacune au moins 1 test associé
2. Les 20 scénarios métiers passent (mock + 1 live)
3. Couverture composants ≥ 85%, services ≥ 80%
4. 0 régression sur les modules adjacents (chat, emails, kit)
5. Live test sur AlFenna Beauty Instagram : post visible + cleanup OK
6. 3 runs anti-flake identiques
7. PR ouverte avec changelog complet

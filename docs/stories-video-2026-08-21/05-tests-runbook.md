# 05 — Tests & runbook d'exécution

## A. Stratégie de tests

Stack existante : **Vitest + Testing Library + MSW** (unit/interaction), **Playwright** (E2E).
Tests colocalisés `*.test.tsx`. On teste **comportement + tracking + payload + a11y + RTL**.

### A.1 Unitaires / logique
| ID | Cible | Vérifie |
|---|---|---|
| U-01 | `feed.ts` `getStoriesFeed` | join stories→segments→variants, tri `display_order`, `is_active`, feed vide → `{stories:[]}` |
| U-02 | `types`/mapper | webm avant mp4, poster = variant `format='poster'`, durationMs mappé |
| U-03 | `seen.ts` | set/get `fg_stories_seen`, robustesse `localStorage` indispo (try/catch) |
| U-04 | catalogue tracking | `story_*` présents dans `event-catalog.ts` + schémas Zod valides ; `story_cta_click`→`cta_click` à l'ingestion |
| U-05 | feature flag | `STORIES_ENABLED` OFF → `getStoriesFeed`/rendu non appelé côté page |

### A.2 Interaction (composant, RTL, a11y)
| ID | Cible | Vérifie |
|---|---|---|
| I-01 | `StoriesRail` | rend N bulles, posters `lazy`, anneau vu/non-vu, masqué si 0 story |
| I-02 | ouverture | tap bulle → viewer monté (dynamic import résolu), `story_open` émis avec `story_id` |
| I-03 | navigation | tap droite → segment+1 (`story_next`) ; tap gauche → −1 ; fin story → suivante/fermeture |
| I-04 | pause | long-press → `story_pause`, barres figées ; relâche → reprise |
| I-05 | mute/close | toggle mute (`m`), X/Échap/swipe-bas → fermeture, focus rendu à la bulle, `story_close` |
| I-06 | auto-advance | `onEnded`/`video_complete` → segment suivant automatiquement |
| I-07 | CTA | clic CTA → `story_cta_click` + `add_to_cart`, viewer fermé, scroll `#commander-femiglow` |
| I-08 | **RTL (ar)** | tap-droite = **précédent**, ordre bulles + barres miroir (`getLocaleConfig` rtl) |
| I-09 | **a11y** | `role=dialog aria-modal`, focus trap, `progressbar aria-valuenow`, tap-zones = `<button>` |
| I-10 | reduced-motion | pas d'auto-advance, contrôles play/pause visibles |
| I-11 | erreur segment | vidéo `error` → skip segment, pas de crash |

### A.3 Payload (garde-fou anti-surcharge — test clé)
| ID | Vérifie |
|---|---|
| P-01 | Au rendu page : **aucun `<video>`/`<source>` monté**, aucune requête `.mp4/.webm` (seuls posters). |
| P-02 | Bundle : `StoryViewer` **absent** du chunk initial (import dynamique) — vérifié par analyse de build ou test d'absence du module avant ouverture. |
| P-03 | À l'ouverture : **1 seul** `<video>` monté ; segment N+1 = poster préchargé uniquement ; N+2 non chargé. |

### A.4 E2E (Playwright)
| ID | Scénario |
|---|---|
| E-01 | `/kit` (flag ON) : bulles visibles → tap → clip joue muet → tap avance → CTA → wizard focus → remplir → `add_to_cart`/`purchase`. Vérifier les events via interception `/api/track`. |
| E-02 | Fermeture restaure la position de scroll ; anneau passe « vu ». |
| E-03 | `/ar/kit` : navigation inversée fonctionnelle (RTL). |
| E-04 | Flag OFF : aucune bulle, page identique à l'existant (non-régression). |

### A.5 Non-régression
- Suite `/kit` existante verte (layouts V1/V2), typecheck 0, lint 0.
- CSP inchangée (vidéos `'self'`) ; si CDN, host whitelizé.

---

## B. Runbook d'exécution

> Environnement local : Node 22 (`nvm use 22.22.2`) + `corepack pnpm`, DB `femiglow` locale (cf.
> `docs/… project-local-dev-setup`). Toujours sur une **branche dédiée**, flag **OFF** jusqu'à
> validation.

### Étape 0 — préparation
1. `git checkout -b feat/stories-video`
2. `nvm use 22.22.2 && corepack pnpm install`
3. Créer `src/lib/feature-flags/stories.ts` (`STORIES_ENABLED=false` par défaut).

### Étape 1 — P0 socle (data + médias + tracking)
1. Uploader 2–3 stories de vidéos via `/admin/media/upload` ; vérifier `status='ready'` + poster.
2. Migration `media_story`/`media_story_segment` → `pnpm db:validate` → `db:migrate-safe`.
3. Implémenter `types.ts` + `feed.ts` + `seed-stories.ts` ; lancer le seed.
4. Ajouter `story_*` au catalogue + schémas.
5. **Gate** : `vitest run` U-01→U-05 verts ; `getStoriesFeed('fr')` non vide.

### Étape 2 — P1 composant (flag OFF)
1. Créer `StoriesRail`, `StoryViewer`, `StoriesVideo`, `StoriesVideoBound` (+ tests).
2. Registry `kit-stories-video` → `pnpm --filter @femiglow/web sync:components`.
3. Insérer `<StoriesVideoBound/>` dans `KitPageLayoutV2.tsx` (après Hero) sous `STORIES_ENABLED`.
4. i18n `marketing.kit.stories` (fr/ar/en) + `MIGRATED_COMPONENTS`.
5. **Gate** : I-01→I-11 + P-01→P-03 verts ; typecheck 0 ; lint 0.
6. **Preview** : activer le flag en preview (`?layout=v2` + flag) et valider visuellement
   (desktop + mobile + `/ar/kit`).

### Étape 3 — validation & activation progressive
1. E2E Playwright E-01→E-04 verts.
2. Audit perf (Lighthouse mobile) : LCP/CLS inchangés, aucun `.mp4` avant ouverture.
3. Merge derrière flag OFF → déployer (repo/DB) → **activer le flag sur un % / en A/B** (P3).
4. Surveiller le funnel `story_*` dans l'analytics ; comparer conversion vs baseline.

### Étape 4 — itérations
- P2 (admin CRUD + Range), P3 (analytics + A/B position), P4 (durcissement) selon §04.

### Rollback
- Immédiat : passer `STORIES_ENABLED=false` (aucun rebuild si flag runtime, sinon rebuild + restart).
- Code : `git revert` de la PR. La migration `media_story*` est additive (aucune donnée existante
  touchée) — peut rester en place sans effet si le flag est OFF.

### Definition of Done (par phase)
- **P0** : feed non vide + events au catalogue + tests U verts.
- **P1** : rail + viewer jouables en preview, CTA→wizard, payload prouvé léger (P-01→03), flag OFF en prod.
- **P2** : admin CRUD opérationnel + Range/seek OK.
- **P3** : funnel mesuré + A/B position lancé.
- **P4** : perf/a11y/edge-cases validés, dette POC purgée.

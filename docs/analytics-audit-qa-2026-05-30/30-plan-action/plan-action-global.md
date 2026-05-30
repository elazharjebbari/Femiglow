# 30 — Plan d'action global

> Objectif : amener les 4 systèmes analytics au niveau **optimal / précis / correct**, **verrouillé
> par une batterie de tests** orientée opérateur. Approche TDD-orientée : **on écrit d'abord le test
> qui échoue (le finding), puis on corrige, puis on re-vérifie** (boucle du §
> [`boucle-correction-verification.md`](boucle-correction-verification.md)).

## 1. Principe

Deux flux parallèles qui convergent :
- **Flux QA** (gauche) : construire le harnais (fixtures, MSW, helpers) puis les tests par couche.
- **Flux FIX** (droite) : corriger les findings, chaque correctif étant **gardé** par un test rouge→vert.

Ordre de priorité des findings : **P0 (AF-01)** → **P1 (AF-02, AF-03, AF-04, AF-05)** → **P2** (le
reste). Chaque finding ne passe `closed` que lorsque son test de non-régression est **vert**.

## 2. Phases

### Phase 0 — Socle de test (prérequis, ~1 j)
- `src/test/fixtures/analytics/*` : `ev`, `session`, `seedEvents`, `seedComponents`,
  `resetMemoryStore`, builders `funnelData/ctaData/checkoutData/insightsOverview`, personae.
- `src/test/msw/analytics-handlers.ts` : handlers paramétrables (`nominal/empty/error500/highVolume/
  firstRun`).
- Utilitaires Playwright : `loginAsAdmin`, `routeAnalytics`/`routeInsights` (interception), helpers
  d'horloge/fuseau. Matrice CI `TZ=UTC` + `TZ=Africa/Casablanca`.
- **Sortie** : harnais vert à vide ; aucun test métier encore.

### Phase 1 — Verrou P0 : réactivité des filtres (AF-01) (~1–1,5 j)
- Écrire les tests **rouges** : composant (`*Dashboard.refetch.spec.tsx`) + e2e
  (`filters-reactivity.spec.ts`) pour Funnel/CTA/Checkout.
- **Correctif** : aligner les 3 dashboards sur le pattern Insights — lire l'URL via le hook
  (`useAnalyticsFilters`/`useSearchParams`), refetch sur changement, supprimer le double fetch au
  mount (hydrater depuis `initialData`). Ajouter les `data-testid` manquants.
- **Vérifier** : tests passent ; SM-01/SM-02 verts.

### Phase 2 — Verrous P1 : précision (~2–3 j)
- **AF-02 (revenu CTA)** : test rouge (199 MAD), trancher l'unité (cents canoniques), corriger
  l'attribution/format, devise MAD. Vérifier CTA + Insights funnel (F-INS-04).
- **AF-04 (fuseau)** : tests `resolveRange` Casablanca, corriger l'ancrage, exécuter en CI bi-fuseau.
- **AF-03 (modèles funnel)** : décider (clamp+expliquer ou aligner), test progression, mettre à jour
  l'UI/légende.
- **AF-05 (device défaut + double barre Insights)** : décision design (badge « Mobile uniquement »
  ou défaut `all` ; neutraliser/masquer la FilterBar layout sur Insights), tests UI.

### Phase 3 — P2 : justesse fine & robustesse (~2–3 j)
- Findings CTA (topPages F-CTA-02, déterminisme F-CTA-04, libellés F-CTA-03/05).
- Findings Checkout (abandons F-CHK-03/04, libellé F-CHK-02).
- Findings Insights (firstRun F-INS-03, refresh concurrent F-INS-06, refreshedAt F-INS-02, export
  PNG F-INS-05).
- Filtres invalides (F-FLT-01), format semaine/heure (F-FMT-01/02).

### Phase 4 — Perf & sécurité (~2 j)
- Double fetch (F-PERF-03), matviews pour fenêtres longues (F-PERF-01/02), cache court (F-PERF-04).
- Requêtes paramétrées Drizzle (F-SEC-01).
- Bench/integration sur volume (highVolume scenario).

### Phase 5 — Durcissement & a11y (~1–1,5 j)
- axe sur les 4 onglets (+ RTL Insights export). Visual regression optionnelle.
- Stabilité anti-flaky (3× consécutifs). Gate CI bloquante. Couverture aux seuils.

## 3. Estimation & séquencement

| Phase | Sujet | Effort | Bloque |
|---|---|---|---|
| 0 | Socle de test | ~1 j | tout |
| 1 | AF-01 (P0) | ~1–1,5 j | SM-01/02 |
| 2 | AF-02/03/04/05 (P1) | ~2–3 j | précision |
| 3 | P2 justesse | ~2–3 j | — |
| 4 | Perf & sécurité | ~2 j | volume |
| 5 | a11y & durcissement | ~1–1,5 j | gate finale |

**Total indicatif : ~9–12 j-h.** Chemin critique : Phase 0 → 1 → 2. Les Phases 3–5 sont
parallélisables par lots de findings.

## 4. Definition of Done (du chantier complet)

- [ ] 100 % des findings P0/P1 `closed` (test rouge→vert référencé par ID).
- [ ] 100 % des `FN-*` couverts à leur niveau primaire (`matrice-couverture.csv`).
- [ ] Suite analytics (unit+composant+e2e) verte et **stable 3×** en CI bi-fuseau.
- [ ] Couverture `lib/analytics/**` ≥ seuils (`config/coverage-targets.yaml`).
- [ ] Gate CI bloquante active sur les chemins analytics.
- [ ] `findings-register.csv` à jour (statut + lien test).

Détail machine-readable : [`plan-action.csv`](plan-action.csv).

# Journal d'exécution — corrections analytics (2026-05-30)

Branche : `fix/analytics-qa-2026-05` (worktree isolé depuis `master`, sans toucher au WIP i18n).
Stack : Vitest 2.1 (Node 22). Suite analytics complète : **479 tests verts, 47 fichiers, 0 régression**.

## Findings corrigés (rouge → vert)

| Finding | Sév. | Correctif | Fichiers | Tests de non-régression | Statut |
|---|---|---|---|---|---|
| **AF-01** | P0 | Dashboards lisent l'URL (`useAnalyticsFilters`) et refetch sur changement réel ; 1er rendu réutilise `initialData` du RSC | `FunnelDashboard.tsx`, `CtaDashboard.tsx`, `CheckoutDashboard.tsx` | `*Dashboard.refetch.test.tsx` (6) | ✅ closed |
| **AF-02** | P1 | `readValueCents` normalise le revenu en cents (value/amount MAD ×100 ; amount_cents tel quel) | `queries/cta.ts` | `cta.test.ts` (fixtures MAD) | ✅ closed |
| **AF-03** | P1 | Drop-off checkout clampé à 0 + modèle BOOL_OR documenté (progression > 100 % assumée) | `queries/checkout.ts` | `checkout.test.ts` AF-03 | ✅ closed |
| **AF-04** | P1 | `resolveRange`/`startOfDay` ancrés sur `Africa/Casablanca` (au lieu du TZ process) | `filters.ts` | `filters.test.ts` (today/yesterday/AF-04) | ✅ closed |
| **AF-05** | P1 | FilterBar globale masquée sur `/analytics/insights` (qui a sa propre barre) | `primitives/FilterBar.tsx` | `FilterBar.test.tsx` | ✅ closed |
| **F-CTA-05** | P2 | Devise CTA par défaut = **MAD** | `CtaDashboard.tsx` | couvert par cta refetch + format | ✅ closed |
| **F-PERF-03** | P2 | Suppression du double fetch au mount (hydratation depuis `initialData`) | 3 dashboards | `*Dashboard.refetch.test.tsx` (pas de fetch au mount) | ✅ closed |

## Décisions notables

- **AF-02** : confirmé au site d'émission (`use-wizard-mutations.ts:471` → `value: res.totalCents / 100`)
  que le purchase émet `value` en **MAD (unité majeure)**. Les fixtures `cta.test.ts` encodaient
  l'ancienne hypothèse (cents) et ont été mises à jour — pas une régression, une correction de test.
- **AF-03** : modèle non-cumulatif conservé (choix légitime, type GA4) mais drop-off négatif
  supprimé ; l'alignement complet Funnel/Checkout reste une décision produit (non forcée ici).
- **AF-04** : Maroc = UTC+1 hors Ramadan ; l'ancrage via `Intl` (`Africa/Casablanca`) suit
  automatiquement les règles ICU. Tests verts en confirmant l'offset +01:00 en mai.

## Reste ouvert (P2, non bloquant) — pour une itération suivante

F-CTA-02 (topPages vs fallback), F-CTA-03/04 (libellés, déterminisme), F-CHK-02/03/04 (libellé
submissions, bords de fenêtre abandons), F-INS-02..06 (firstRun, refresh concurrent, export PNG),
F-FLT-01 (fallback filtres), F-PERF-01/02/04 (matviews, cache), F-SEC-01 (requêtes paramétrées),
F-FMT-01/02. Voir `00-audit/findings-register.csv` et `30-plan-action/plan-action.csv`.

## Validation locale

```
node_modules/.bin/vitest run src/lib/analytics src/components/admin/analytics
# → 479 passed (47 files)
node_modules/.bin/tsc --noEmit   # aucune erreur sur les fichiers analytics modifiés
```

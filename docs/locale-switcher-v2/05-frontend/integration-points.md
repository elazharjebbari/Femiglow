# Points d'intégration (client + admin)

> Carte précise de **où toucher** le code existant, avec le risque de régression et la parade.

## 1. Fichiers existants impactés

| Fichier | Action | Risque | Parade |
|---|---|---|---|
| `components/i18n/LocaleSwitcher.tsx` | Brancher sur `useLocaleTransition` (au lieu de `router.replace` direct) ; rendre les variantes | Régression switch actuel | Tests Vitest + Playwright avant/après |
| `app/[locale]/layout.tsx` | Monter `LocaleVeil` + `LiveAnnouncer` ; garder le script inline `dir/lang` (load initial) | Double source de `dir` | Le script = **load initial** ; le hook = **au switch**. Pas de conflit. |
| `components/layout/Header.tsx` | Conditionner l'affichage (caché wizard/admin) ; monter `LocaleNudge` | Bascule visibilité | Test INV-5 |
| `components/layout/SommaireOverlay.tsx` | Variante `pills` | — | Visuel + a11y |
| `components/layout/Footer.tsx` | Variante `pills` (redondance) | — | — |
| `lib/i18n/build-switch-url.ts` | Créer/centraliser (UTM-safe) | — | Tests unitaires exhaustifs |
| `i18n.config.ts` | Exposer `DIRECTION` si absent | — | — |

## 2. Nouveaux fichiers

```
components/i18n/
  use-locale-transition.ts
  LocaleVeil.tsx
  LocaleNudge.tsx
  LiveAnnouncer.tsx
  LocaleItem.tsx
lib/i18n/
  build-switch-url.ts
  suggested-locale.ts        (resolveSuggestedLocale)
app/api/i18n/config/route.ts            (public, caché)
app/api/admin/i18n/config/route.ts      (admin, audit)
app/admin/i18n/page.tsx                 (UI admin)
drizzle/migrations/XXXX_i18n_locale_config.sql
```

## 3. Ordre d'intégration (sans casse)

1. **Helpers purs** (`build-switch-url`, `suggested-locale`) + tests → 0 impact UI.
2. **Hook** `useLocaleTransition` + tests → pas encore branché.
3. **Brancher** `LocaleSwitcher` sur le hook **derrière le flag** `localeSwitcherV2` → ancien comportement conservé flag off.
4. `LocaleVeil` + `LiveAnnouncer` montés (inertes par défaut).
5. `LocaleNudge` + détection serveur.
6. **Backend config** + page admin.
7. Bascule du flag après batterie verte.

## 4. Garde-fous de non-régression (à exécuter à chaque étape)

- `pnpm typecheck` (fichiers touchés) ; `pnpm lint`.
- Scanners i18n : `i18n-scan-fr` = 0, `i18n-scan-latin-ar` = 0 (INV-6).
- Build prod vert + pages 200 (FR/AR/EN sur `/`, `/kit`, `/journal`, `/maison`, `/contact`, `/rituel`).
- Wizard checkout : switcher absent, aucun changement (INV-5).

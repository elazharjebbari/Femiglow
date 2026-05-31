# Stratégie de tests — robustesse avant tout

> Principe directeur : **on ne compte pas les tests, on couvre les chemins et les angles.** Un invariant non couvert = un trou. La traçabilité exigence↔test est garantie par `coverage-matrix.csv`.

## 1. Pyramide & responsabilités

| Niveau | Outil | Couvre | % effort |
|---|---|---|---|
| **Unit** | Vitest | helpers purs (`buildSwitchUrl`, `deriveLocale`, validation config, `resolveSuggestedLocale`), logique du hook (modes), réducteurs nudge | 45 % |
| **Intégration** | Vitest + Testing Library + **MSW** | `LocaleSwitcher` rendu/clic, `LocaleNudge` one-shot, config API mockée, fallback-to-defaults | 30 % |
| **E2E** | Playwright (FR/AR/EN, desktop+mobile) | bascule réelle no-reload, RTL flip, scroll, UTM, nudge, admin, wizard caché, clavier | 20 % |
| **A11y** | axe (intégré Playwright/Vitest) | rôles/aria, contraste, focus, reduced-motion | 5 % |
| **Garde-fous** | scripts existants | scanners i18n, build, typecheck, lint | transversal |

## 2. Les 7 angles obligatoires (chaque feature les traverse)

1. **Fonctionnel** — le comportement nominal marche (FR↔AR↔EN).
2. **RTL** — miroir + `dir` correct, aucun état intermédiaire (INV-2).
3. **A11y** — clavier, SR, contraste, reduced-motion (INV-7, INV-10).
4. **Régression** — wizard (INV-5), scanners i18n (INV-6), SEO (INV-9).
5. **Résilience / échec** — config invalide/500 (INV-12), offline (fallback reload), double-clic.
6. **Data** — préservation UTM (INV-4), events payloads exacts (CONTRACT §4).
7. **Perf** — pas de reload (INV-1), scroll préservé (INV-3), pas de fetch bloquant.

## 3. Critères de robustesse (Definition of Robust)

Une fonctionnalité est « robuste » quand :
- **Tous ses invariants** (CONTRACT §6) ont ≥ 1 test qui échoue si on casse l'invariant (test « négatif » vérifié).
- **Chaque chemin** du hook (`vt` / `veil` / `reduced` / `reload`) est exécuté par un test.
- **Chaque mode d'échec** (API down, config invalide, offline, JS off) a un comportement testé et gracieux.
- Les **3 locales** sont couvertes en E2E sur les **6 pages** publiques clés.
- **0 régression** sur la batterie de garde.

## 4. Données de test

- `03-data/fixtures.json` : configs valide/invalide/single/ar-disabled + Accept-Language samples.
- MSW handlers : `07-tests/msw-handlers.md` (config 200/invalide/500, PUT 200/401/422/conflict).

## 5. Exécution

| Commande | Quand |
|---|---|
| `pnpm vitest run <glob>` | à chaque étape du plan (étape locale) |
| `pnpm vitest run` (suite i18n) | fin de lot |
| `pnpm playwright test --grep @locale-switcher` | fin de lot + avant flag on |
| `node scripts/i18n-scan-fr.mjs && node scripts/i18n-scan-latin-ar.mjs` | garde i18n (serveur up) |
| `pnpm typecheck && pnpm lint` | continu |
| `pnpm build` | avant flag on + livraison |

## 6. Boucle test → correction → re-vérification

Voir `09-runbook/test-loop.md`. Règle : **une étape n'avance pas tant que sa cible n'est pas verte ET que la garde de non-régression est verte.**

## 7. Sorties attendues

- `vitest-plan.csv`, `playwright-plan.csv` : plans détaillés (IDs traçables).
- `coverage-matrix.csv` : chaque INV-x et exigence clé → IDs de tests qui la couvrent (aucune ligne vide).
- Rapport de boucle (runbook) : itérations, échecs, corrections, état final vert.
